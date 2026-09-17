/* hue.js — thin, guarded client for the local Hue server.
 *
 * All calls go to /api/* on the SAME origin; controller/serve.py reverse-
 * proxies them to http://localhost:5000 (the C# Hue app). Nothing here ever
 * throws to the caller: every request is wrapped, timed out, and resolves to
 * { ok, status, data } — if the lights are unreachable the experience keeps
 * running and Hue.online flips to false so the UI can show its little
 * "lights offline" dot.
 */
(function () {
  "use strict";

  const TIMEOUT_MS = 4000;

  const Hue = {
    online: null,               // null = unknown; true = API reachable
    bridgeConnected: false,     // true = the Hue app's bridge stream is up
    statusText: "",
    _listeners: [],

    onStatus(fn) { this._listeners.push(fn); },

    _notify() { this._listeners.forEach(fn => { try { fn(this.online, this.bridgeConnected); } catch (e) {} }); },

    _setOnline(v, text) {
      const changed = this.online !== v;
      this.online = v;
      this.statusText = text || "";
      if (changed) {
        if (!v) this.bridgeConnected = false;
        this._notify();
      }
    },

    /* Core guarded request. Never rejects. */
    async req(path, opts = {}) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch("/api" + path, {
          method: opts.method || "GET",
          headers: opts.body ? { "Content-Type": "application/json" } : undefined,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: ctrl.signal
        });
        clearTimeout(t);
        // 502 is serve.py telling us the Hue app itself is down.
        if (res.status === 502) { this._setOnline(false, "hue app down"); return { ok: false, status: 502, data: null }; }
        this._setOnline(true);
        let data = null;
        try { data = await res.json(); } catch (e) { /* many endpoints return empty 200 */ }
        return { ok: res.ok, status: res.status, data };
      } catch (e) {
        clearTimeout(t);
        this._setOnline(false, "unreachable");
        return { ok: false, status: 0, data: null };
      }
    },

    /* ---- endpoints (see docs/HUE-API.md) ---- */

    status()            { return this.req("/status"); },
    scene(name)         { return this.req("/scenes/" + encodeURIComponent(name), { method: "POST" }); },
    mood(name)          { return this.req("/mood/" + encodeURIComponent(name), { method: "POST" }); },

    /* valence -1..1, arousal 0..1 (NOTE: the API's arousal axis is 0..1,
       our PAD data is -1..1 — callers must remap: (pad.a + 1) / 2). */
    checkin(valence, arousal) {
      return this.req("/checkin", { method: "POST", body: { Valence: valence, Arousal: arousal } });
    },

    bpm(value)          { return this.req("/bpm/" + Math.round(Math.max(40, Math.min(240, value))), { method: "POST" }); },
    energy(value)       { return this.req("/energy/" + Math.max(0, Math.min(1, value)), { method: "POST" }); },
    brightness(value)   { return this.req("/brightness/" + Math.max(0, Math.min(1, value)), { method: "POST" }); },
    runEffect(request)  { return this.req("/effects/run", { method: "POST", body: request }); },

    /* Soft update: patches the currently-running ambient layer's params in place
       (color/speed/spread/...) instead of hard-switching to a fresh effect instance.
       Falls back server-side to a full switch if the ambient type actually changed —
       always safe to call. */
    /* Fire a short-lived effect layer OVER the running scene. Unlike runEffect
     * this never rebuilds the scene, so the Superfluid tide keeps its phase and
     * skips its 3s attack ramp — the difference between a punch and a dip.
     * Needs the C# app on feature/transient-effects (or later). */
    pulse(effectType, params, seconds) {
      return this.req("/effects/pulse", {
        method: "POST",
        body: { EffectType: effectType, EffectParams: params || {},
                DurationSeconds: seconds || 2.5 }
      });
    },

    /* Sustained beds — long-lived layers whose PRESENCE is modulated instead of
     * switched. Upsert: creates on first call, patches thereafter, no rebuild.
     * Needs the C# app on feature/transient-effects (or later). */
    sustain(id, effectType, params, alpha, priority, slew) {
      return this.req("/effects/sustain", {
        method: "POST",
        body: {
          Id: id, EffectType: effectType, EffectParams: params || {},
          Alpha: alpha, Priority: priority, Slew: slew
        }
      });
    },
    unsustain(id, fade) {
      return this.req("/effects/sustain/" + encodeURIComponent(id) +
                      (fade !== undefined ? "?fade=" + fade : ""), { method: "DELETE" });
    },

    runEffectParams(request) { return this.req("/effects/params", { method: "POST", body: request }); },
    stop()              { return this.req("/stop", { method: "POST" }); },

    /* Apply a feeling: curated scene first, /api/checkin as fallback so the
       lights still respond even if a scene name drifts out of the catalog. */
    async applyFeeling(f) {
      const r = await this.scene(f.scene);
      if (r.ok) return r;
      if (r.status === 404) return this.checkin(f.pad.v, (f.pad.a + 1) / 2);
      return r;
    },

    /* Background health poll so the offline dot self-heals. Also tracks
       whether the Hue app's bridge/entertainment stream is actually up —
       the API can be reachable while the lamps themselves aren't. */
    startStatusPoll(intervalMs = 6000) {
      const tick = async () => {
        const r = await this.status();
        const bc = !!(r.ok && r.data && r.data.connected);
        if (bc !== this.bridgeConnected) { this.bridgeConnected = bc; this._notify(); }
      };
      tick();
      setInterval(tick, intervalMs);
    }
  };

  window.Hue = Hue;
})();
