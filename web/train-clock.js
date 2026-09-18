/* TRAIN CLOCK — the engraving train (docs/TRAIN-CLOCK.md).
 *
 * A train is a trajectory that LEAVES a trajectory. So this is a single bright point
 * that loops a closed path over the whole field, engraving its trail as it goes —
 * a self-contained pocket universe (the story train). It runs ITSELF: no tapping.
 * Its lap IS the clock and OUR SCALE: one loop sets the master period (config.bpm),
 * so the single-tempo spine breathes every spiral and lamp-state off it. Everything
 * pulls on everything: a perpetuum mobile. Slow by design — the room's heartbeat.
 *
 *   • it just runs on load — the point loops, the room breathes.
 *   • t        — toggle the whole tempo train ON / OFF (it's our clock; you can pull it).
 *   • SPACE    — optional: two taps set the lap length by hand (chug faster/slower).
 *   • hardware later: POST {"type":"lap"} to /party/pub — heard on /party/sub, drives a lap.
 *
 * Minimal on purpose: one point, one fading layer. The richness is the states it paces.
 * Each lap fires a window "trainlap" event for a future BANG-on-pass.
 */
(function (root) {
  "use strict";

  var doc = root.document;
  if (!doc) return;

  // A 24 s loop is the slow default — the room breathes at a crawl. Longer lap = slower whole.
  var NOMINAL_LAP = 24.0, NOMINAL_BPM = 16;
  var TAP_WINDOW = 20.0;
  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function now() { return (root.performance && performance.now ? performance.now() : Date.now()) / 1000; }

  var TrainClock = {
    period: NOMINAL_LAP,
    running: true,      // it runs itself — the whole point
    phase: 0,
    _last: 0,
    _raf: 0,
    _cv: null, _ctx: null,
    _lastTap: 0,

    bpmFor: function (period) { return clamp(NOMINAL_BPM * NOMINAL_LAP / period, 12, 200); },

    setPeriod: function (period) {
      this.period = clamp(period, 3.0, 90);
      var bpm = this.bpmFor(this.period);
      if (root.PARTY && root.PARTY.config) root.PARTY.config.bpm = bpm;   // read live by PARTY.tempo()
      this._toast("train · lap " + this.period.toFixed(1) + "s → " + Math.round(bpm) + " bpm");
      return bpm;
    },

    /* The closed path the train rides — a Lissajous that sweeps the whole frame and
       returns to its start every lap. "A pixel that moves over the map." */
    _pos: function (phase, w, h) {
      var cx = w / 2, cy = h / 2, ax = w * 0.44, ay = h * 0.42;
      return [ cx + ax * Math.sin(3 * phase + Math.PI / 2),
               cy + ay * Math.sin(2 * phase) ];
    },

    _ensureCanvas: function () {
      if (this._cv) return;
      var cv = doc.createElement("canvas");
      cv.id = "train-layer";
      cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:5;pointer-events:none";
      (doc.body || doc.documentElement).appendChild(cv);
      this._cv = cv; this._ctx = cv.getContext("2d");
      function fit() { cv.width = root.innerWidth; cv.height = root.innerHeight; }
      fit(); root.addEventListener("resize", fit);
    },

    _frame: function () {
      var self = this;
      this._raf = root.requestAnimationFrame(function () { self._frame(); });
      var t = now(), dt = this._last ? Math.min(t - this._last, 0.1) : 0;
      this._last = t;
      if (!this.running) return;

      // Advance around the loop. A gentle surge near the turns gives the chugga —
      // it pulls, eases, pulls. One period = one full slow lap.
      var rate = (TAU / this.period) * (1 + 0.4 * Math.sin(this.phase * 2));
      this.phase += rate * dt;
      if (this.phase >= TAU) { this.phase -= TAU; this.lap(); }

      if (!this._ctx) return;
      var ctx = this._ctx, w = this._cv.width, h = this._cv.height;

      // Engrave: fade the layer a hair each frame so the slow trajectory lingers as a trail.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(4,5,10,0.03)";
      ctx.fillRect(0, 0, w, h);

      // The train: a bright warm head that adds light onto whatever scene is behind it.
      var p = this._pos(this.phase, w, h);
      ctx.globalCompositeOperation = "lighter";
      var glow = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 13);
      glow.addColorStop(0, "rgba(255,236,190,0.95)");
      glow.addColorStop(1, "rgba(255,150,80,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p[0], p[1], 13, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,250,235,0.95)";
      ctx.beginPath(); ctx.arc(p[0], p[1], 2.1, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    },

    lap: function () {
      try { root.dispatchEvent(new CustomEvent("trainlap", { detail: { period: this.period } })); } catch (e) {}
    },

    /* ── ON / OFF: it's our tempo train, so it can be pulled out entirely ── */
    start: function () {
      if (this.running && this._raf) return;
      if (root.PARTY && root.PARTY.config) root.PARTY.config.bpm = this.bpmFor(this.period);
      this.running = true; this._last = 0;
      var self = this;
      if (!this._raf) this._raf = root.requestAnimationFrame(function () { self._frame(); });
      this._toast("train · on"); this._mark();
    },
    stop: function () {
      this.running = false;
      if (this._raf) { root.cancelAnimationFrame(this._raf); this._raf = 0; }
      if (this._ctx) this._ctx.clearRect(0, 0, this._cv.width, this._cv.height);   // wipe the engraving
      this._toast("train · off");  this._mark();      // room holds its last tempo
    },
    toggle: function () { this.running ? this.stop() : this.start(); },

    tap: function () {
      var t = now(), gap = t - this._lastTap;
      this._lastTap = t;
      if (gap > 0 && gap <= TAP_WINDOW) this.setPeriod(gap);
      else this._toast("train · tap again to set the lap…");
    },

    _toast: function (label) {
      var lane = doc.getElementById("toasts");
      if (!lane) return;
      var el = doc.createElement("div");
      el.className = "toast"; el.textContent = label;
      lane.appendChild(el);
      requestAnimationFrame(function () { el.classList.add("show"); });
      setTimeout(function () {
        el.classList.remove("show");
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
      }, 1500);
    },
    _mark: function () {
      var b = doc.getElementById("train-badge");
      if (b) { b.classList.toggle("on", this.running); b.textContent = this.running ? "◉ train" : "○ train"; }
    }
  };

  function boot() {
    TrainClock._ensureCanvas();
    TrainClock.start();   // self-running from the first frame — no tap required
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  doc.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.key === " " || e.code === "Space") { e.preventDefault(); TrainClock.tap(); }
    else if (e.key === "t" || e.key === "T") { TrainClock.toggle(); }
  });

  // Hardware plug-and-play: a lap POSTed to /party/pub reaches /party/sub subscribers.
  try {
    var es = new EventSource("/party/sub");
    es.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (x) { return; }
      if (m && m.type === "lap") TrainClock.tap();
    };
    es.onerror = function () {};
  } catch (e) {}

  root.TrainClock = TrainClock;
})(typeof window !== "undefined" ? window : globalThis);
