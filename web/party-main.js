/* party-main.js — host loop for the party installation.
 *
 * Ties the PARTY organism to the two surfaces:
 *   • screen — the AmbientDirector spiral (symmetry.js), which already reads
 *     PARTY.activeSpiral() for its palette + σ (business).
 *   • lamps  — pushed via hue.js: business→GlobalEnergy every tick (throttled,
 *     on-change), and a scene switch whenever the light playlist advances.
 *
 * Input: keyboard always works (additive). The physical Hue remote arrives via
 * serve.py's /nav SSE — mapped loosely here until listen.py emits the party's
 * own 8-signal vocabulary (Power/Bright-hold/Hue short+long).
 *
 * NOTE (remaining wire): per-tick COLOUR override to the lamps needs a C#
 * /api/effects/params endpoint (wired to ILiveTunable). Until then the lamps
 * show the C# scene's own palette + atlas-driven energy; the screen carries the
 * full atlas colour. See docs/PARTY-BRIEF.md Phase 5.
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  var canvas = document.getElementById("stage");
  function fit() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  fit(); window.addEventListener("resize", fit);

  // { full: true } — all 66 exhibits, not the calm 13 curated for sitting behind menu
  // text in brain.js. Here the director IS the projection, so the loud ones belong.
  var director = new window.AmbientDirector(canvas, { full: true });
  // Here the director IS the whole projection — nothing on top of it — so the zoom
  // pendulum is welcome. Off by default because the same class is also the dim
  // background behind readable text in brain.js. See PARTY-BRIEF §17.
  director.zoom = true;

  /* ── dev tools (URL params + toggleable HUD; OFF by default, firewall-safe) ──
     ?fast   — shortens the decay so the wind-down is playtestable in seconds
     ?debug  — shows the HUD on load (also toggle any time with the D key)
     ?manual — start in manual instead of attract mode
     ?org=amount,syn,slime,fluid,vicsek[,place,placeMode,possess,glow] — deep-link an organism mix ─ */
  var params = new URLSearchParams(window.location.search || "");

  // Attract mode ON by default: there is no working remote, so an unattended screen
  // would otherwise sit on one shape forever. `?manual` or the dashboard turns it off,
  // and driving the business keys (↑/↓) always overrides it for as long as you hold.
  PARTY.auto = !params.has("manual");
  if (params.has("fast")) { PARTY.config.decayRate = 0.02; PARTY.config.recoverRate = 0.01; }
  // ?org=amount,syn,slime,fluid,vicsek[,place,placeMode,possess] — start with an organism mix
  // already up. Same idea as organisms.html's ?w= share link; each value 0..1 (placeMode 0..3),
  // missing ones keep their default.
  if (params.has("org")) {
    var ov = (params.get("org") || "").split(",").map(Number);
    var oks = ["orgAmount", "orgSyn", "orgSlime", "orgFluid", "orgVicsek", "orgPlace", "orgPlaceMode", "orgPossess", "orgGlow", "orgWiring"];
    oks.forEach(function (k, i) {
      if (i >= ov.length || !isFinite(ov[i])) return;
      PARTY.config[k] = (k === "orgPlaceMode") ? Math.max(0, Math.min(3, Math.round(ov[i]))) : Math.max(0, Math.min(1, ov[i]));
    });
  }

  // ?substrate — PROTOTYPE (neon-cat Option A, 2026-09-11): dial the organism ONTO your own
  // picture instead of the procedural spiral. A local file → blob URL is same-origin, so the
  // possession sampler's getImageData is not tainted. Also accepts ?substrate=<path under web/>
  // for a same-origin URL. No param = nothing created, the installation is untouched.
  if (params.has("substrate")) {
    var subIn = document.createElement("input");
    subIn.type = "file"; subIn.accept = "image/*";
    subIn.title = "load a spiral / cat image for the organism to possess";
    subIn.style.cssText = "position:fixed;top:8px;left:8px;z-index:21;font:12px system-ui;color:#cfe;" +
      "background:rgba(6,9,18,0.7);border:1px solid rgba(140,160,210,0.3);border-radius:8px;padding:6px;";
    subIn.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var im = new Image();
      im.onload = function () { director.substrate = im; };
      im.src = URL.createObjectURL(f);
    });
    document.body.appendChild(subIn);
    var sUrl = params.get("substrate");
    if (sUrl && sUrl !== "1" && sUrl !== "pick") {   // a direct same-origin URL, if given
      var im0 = new Image(); im0.onload = function () { director.substrate = im0; }; im0.src = sUrl;
    }
    // Turn a possessing organism ON by default — otherwise ?substrate is just an image on
    // screen with nothing drawn over it (the "basic html" trap). A visible mix so the attach
    // is self-evident the moment an image loads; the dashboard still overrides live.
    if (!(PARTY.config.orgAmount > 0)) {
      PARTY.config.orgAmount = 1; PARTY.config.orgSlime = 0.85; PARTY.config.orgSyn = 0.6;
      PARTY.config.orgFluid = 0.35; PARTY.config.orgPossess = 0.95; PARTY.config.orgGlow = 0.9;
      PARTY.config.orgPlace = 0; PARTY.config.orgPlaceMode = 0;
    }
  }

  var hud = null, hudOn = params.has("debug");
  function ensureHud() {
    if (hud) return hud;
    hud = document.createElement("div");
    hud.style.cssText = "position:fixed;top:8px;left:8px;z-index:20;pointer-events:none;" +
      "font:12px/1.5 'Cascadia Code',Consolas,monospace;color:#cfe;white-space:pre;" +
      "background:rgba(6,9,18,0.6);padding:8px 12px;border-radius:8px;border:1px solid rgba(140,160,210,0.2);";
    document.body.appendChild(hud);
    return hud;
  }
  function bar(v) { var n = Math.round(v * 12); return "[" + "#".repeat(n) + "-".repeat(12 - n) + "]"; }
  function updateHud() {
    if (!hudOn) { if (hud) hud.style.display = "none"; return; }
    var el = ensureHud(); el.style.display = "block";
    var L = PARTY.activeLight(), S = PARTY.activeSpiral();
    var online = window.Hue ? (window.Hue.online === true ? "online" : window.Hue.online === false ? "OFFLINE" : "…") : "no-Hue";
    el.textContent =
      "mode     : " + PARTY.mode + "\n" +
      "business : " + bar(PARTY.business) + " " + PARTY.business.toFixed(2) + "\n" +
      "→ lamp E : " + PARTY.effectiveEnergy().toFixed(2) + "   swing " + PARTY.spiralAngle().toFixed(2) + "rad\n" +
      "spiral   : " + S.id + (PARTY.auto ? "   [auto #" + PARTY._autoStep + "]" : "") + "\n" +
      "light    : " + L.id + "   " + (L.palette ? L.palette.join(" ") : "") + "\n" +
      "idle     : " + PARTY.idle.toFixed(0) + "s" +
        (PARTY.attention() > 0 ? "   attention " + PARTY.attention().toFixed(2) : "") +
        (PARTY.isDead() ? "   [STANDSTILL]" : "") + "\n" +
      "lamps    : " + online + "\n" +
      "keys     : ↑↓ drive · P mode · H cycle · ⇧H commit · D hud";
  }

  /* ── lamp push: throttled, only-on-change (mirrors house.js emitLights) ─── */
  var lastEnergyPush = 0, started = false, lastPalettePush = 0;
  var PUSH_MS = 140; // ~7Hz ceiling

  // The lamps run ONE Superfluid flood, recoloured by the active atlas palette and
  // sped by business — "superfluid motion, atlas colour". Only Superfluid is
  // live-tunable on this branch, and it's the calm hero layer anyway. (Per-scene
  // C# layer variety is a later step; see docs/PARTY-BRIEF.md.)
  var sent = { e: -1, color: "", speed: "", flow: "", palette: "", drift: "",
               span: "", spread: "", bband: "" };
  function clampNum(v, lo, hi) { v = +v; return !isFinite(v) ? lo : v < lo ? lo : v > hi ? hi : v; }

  /* The lamp-flow dial as a plain multiplier — the sibling of PARTY.tempo(), and
     deliberately NOT derived from it. Tempo = how fast the light moves; this = how
     much light is moving. One accessor so a missing/garbage config key can't quietly
     dim the room. */
  function lampFlow() {
    var f = PARTY.config.lampFlow;
    return clampNum(f == null ? 1 : f, 0, 2);
  }

  // 14.1 — motion lives in COLOUR, not brightness. A lamp moving up and down reads as
  // blinking however slowly it does it, so the lamps hold a near-steady level and the
  // atlas scheme travels across the room instead (screen → corners).
  //
  // Order is a there-and-back — primary → bridge → secondary → bridge — because the C#
  // SamplePalette loops from the last entry straight back to the first; a plain
  // p/s/b list would put a hard hue jump at the wrap. ACCENT IS DELIBERATELY ABSENT:
  // the atlas rule is only one colour screams at once, and the scream belongs to events.
  function lampPalette(light) {
    var p = light.palette || [];
    if (p.length < 3) return p.join(",");
    return [p[0], p[2], p[1], p[2]].join(",");
  }

  // ?nolamps=1 — the beamer half of the colored-shadow rig (docs/COLORED-SHADOWS.md).
  // When a human light tech owns the lamps directly over the Hue API, this page must not
  // also write to them: two writers fight over one Superfluid layer and the complement
  // fill loses to the screen palette. Gating pushLamps covers EVERY lamp write on this
  // page — the runEffect init, the params patch, and Hue.energy — since all three live
  // inside it. Screen output is untouched. Drop the param to hand the lamps back.
  var LAMPS_EXTERNAL = /[?&]nolamps=1/.test(location.search);

  function pushLamps(now) {
    if (LAMPS_EXTERNAL) return;
    if (!window.Hue) return;
    // If the lamp API is known-down, back right off. Otherwise every push sits on the
    // proxy timeout holding one of the browser's ~6 per-origin connection slots, which
    // starves the SSE streams (dashboard stuck "connecting") and aborts sockets.
    var light = PARTY.activeLight();
    var primary = (light.palette && light.palette[0]) || "00BFFF";
    var biz = PARTY.business;
    if (!started) {                                        // init immediately, never gated
      started = true;
      // Wide spread = neighbouring lamps overlap, so the tide reads as a swell moving
      // through the room rather than a band switching lamps on and off.
      window.Hue.runEffect({ AmbientType: "Superfluid",
        AmbientParams: { color: primary, palette: lampPalette(light),
                         speed: "0.12", spread: "0.60",
                         flowIntensity: clampNum(0.75 * lampFlow(), 0, 1).toFixed(3),
                         colorSpan: "1.0", colorDrift: "0.02",
                         brightBand: String(PARTY.config.lampBrightBand != null
                                            ? PARTY.config.lampBrightBand : 0.30) } });
      sent.color = primary; sent.palette = lampPalette(light); lastEnergyPush = now;
      return;
    }
    var interval = (window.Hue.online === false) ? 3000 : PUSH_MS;
    if (now - lastEnergyPush < interval) return;
    lastEnergyPush = now;
    // Only send what actually changed — an idle room should be silent on the wire.
    var e = +PARTY.effectiveEnergy().toFixed(3);
    if (Math.abs(e - sent.e) > 0.004) { window.Hue.energy(e); sent.e = e; }

    // Deliberately narrow ranges: a full tide cycle stays between ~16s and ~78s, and
    // brightness never swings wide. Dynamic, never flashy.
    // …and the master tempo scales the lamp RATES, so the light in the room slows
    // with the wall rather than drifting out of step with it. One organism.
    // It does NOT scale flowIntensity: that is how much light is being pushed, not
    // how fast, and welding it to tempo meant turning the room slow also turned it
    // dark. Flow has its own dial (config.lampFlow) so slow-and-bright is reachable.
    var tempo = PARTY.tempo(), flowScale = lampFlow();
    var speedN = (0.08 + biz * 0.32) * tempo, flowN = (0.55 + biz * 0.35) * flowScale;

    // Neglect (Phase 9): as attention rises the room breathes SLOWER and DEEPER —
    // a long swell that recedes and returns. It asks; it never shouts. This is one of
    // the two sanctioned exceptions to "no motion spikes" (see PARTY-BRIEF §5).
    var att = PARTY.attention();
    if (att > 0) {
      var breath = 0.5 + 0.5 * Math.sin(now / 2200);     // ~14s swell
      flowN *= 1 - 0.45 * att * (1 - breath);
      speedN *= 1 - 0.40 * att;
    }
    var speed = Math.max(0.05, speedN).toFixed(3);
    var flow = Math.max(0.05, Math.min(1, flowN)).toFixed(3);

    // Colour drift: how fast the scheme travels through the room. Deliberately tiny —
    // a full pass takes ~50 s calm, ~13 s busy. Business changes how fast colour MOVES,
    // never how hard the lamps swing. Neglect slows it with everything else.
    var driftN = (0.02 + biz * 0.06) * tempo;
    if (att > 0) driftN *= 1 - 0.40 * att;
    var drift = driftN.toFixed(3);
    var palette = lampPalette(light);

    // During a colour drift the palette changes every frame, so the change-gate below
    // would fire at its full 7Hz for the whole fade. Bounded, but "an idle room is
    // silent on the wire" (invariant 5) shouldn't quietly become "a drifting room
    // shouts" — ~3Hz is plenty for an 8s glide and the C# layer interpolates anyway.
    if (PARTY.fading && PARTY.fading()) {
      var hz = PARTY.config.palettePushHz;
      if (!(hz > 0)) hz = 3;                          // 0 or nonsense = the old rate
      if (now - (lastPalettePush || 0) < 1000 / hz) return;
      lastPalettePush = now;
    }
    /* A colour CARD is a light-scene that is a behaviour, so it also ships lamp
       parameters — Runner narrows `spread` to a travelling band, Ember shoves `speed`
       and `flowIntensity` on a flare. The card's values win over the business-derived
       ones for the keys it names, and it names only keys that exist: /api/effects/params
       silently ignores anything else and still answers softUpdate:true, so a typo here
       would look like it worked and change nothing. Ranges are from docs/HUE-API.md and
       are NOT clamped by the endpoint — clamp on the way out. */
    var cp = light.params || null;
    if (cp) {
      // Tempo-scaled BEFORE the clamp: a card must not be able to smuggle full speed
      // past the master dial just because it names the key itself.
      if (cp.speed != null)         speed = clampNum(cp.speed * tempo, 0.05, 3).toFixed(3);
      if (cp.flowIntensity != null) flow  = clampNum(cp.flowIntensity * flowScale, 0, 1).toFixed(3);
      if (cp.colorDrift != null)    drift = clampNum(cp.colorDrift * tempo, 0, 1).toFixed(3);
    }
    var span   = cp && cp.colorSpan  != null ? clampNum(cp.colorSpan, 0.1, 4).toFixed(2)  : "1.0";
    var spread = cp && cp.spread     != null ? clampNum(cp.spread, 0.05, 1).toFixed(2)    : "0.60";
    // A card may name its own band; otherwise the room's knob decides. Not a hardcoded
    // 0.30 any more — see config.lampBrightBand for why that number was the argument.
    var bandDefault = PARTY.config.lampBrightBand;
    if (!(bandDefault >= 0)) bandDefault = 0.30;
    var bband  = clampNum(cp && cp.brightBand != null ? cp.brightBand : bandDefault, 0, 1).toFixed(2);

    if (primary !== sent.color || speed !== sent.speed || flow !== sent.flow ||
        palette !== sent.palette || drift !== sent.drift ||
        span !== sent.span || spread !== sent.spread || bband !== sent.bband) {
      /* ⚠ THE ROOM CAN GO PERMANENTLY DARK WITHOUT THIS. `started` is a latch: the
         Superfluid layer is created ONCE, and every push after that is a PARAMS patch,
         which only patches a layer that is already running. Restart the C# app with this
         page still open and there is no layer any more — so every push here patches
         nothing, forever, while energy and params both keep answering 200 and the HUD
         keeps showing a healthy connection. The room is simply dead and nothing says so.
         Cost most of an evening on 2026-07-26; see docs/TASTE-SESSION.md §11.
         The endpoint now reports whether it ACTUALLY patched a layer (it used to answer
         softUpdate:true unconditionally, which is why this could not be detected before).
         A false means the layer is gone: drop the latch and let the next tick rebuild. */
      window.Hue.runEffectParams({ Params: {
        color: primary, palette: palette, speed: speed,
        flowIntensity: flow, colorDrift: drift,
        colorSpan: span, spread: spread, brightBand: bband } })
        .then(function (r) {
          // Only a definite `false` counts. A network failure gives data:null, and the
          // offline back-off already handles that — re-running the effect at every
          // failed push while the app is down would hammer a dead endpoint.
          if (r && r.data && r.data.softUpdate === false) {
            started = false;
            sent.color = sent.palette = sent.speed = sent.flow = sent.drift = "";
            sent.span = sent.spread = sent.bband = ""; sent.e = -1;
          }
        }, function () {});
      sent.color = primary; sent.speed = speed; sent.flow = flow;
      sent.palette = palette; sent.drift = drift;
      sent.span = span; sent.spread = spread; sent.bband = bband;
    }
  }

  /* ── toasts: ephemeral, decay after a few seconds (display firewall: cues
     only — mode words + unlock names, never prose) ───────────────────────── */
  var toastBox = document.getElementById("toasts");
  PARTY.onToast(function (text) {
    if (!toastBox) return;
    var el = document.createElement("div");
    el.className = "toast"; el.textContent = text;
    toastBox.appendChild(el);
    // force reflow then fade in/out
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () { el.classList.remove("show"); }, 2200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2900);
  });

  /* ── attention: when neglected, the room starts asking for someone ─────────
     On screen that's the inward bloom pull (drawSuperfluidBloom's flare), firing
     more often the longer it's been left. The physical inward-flash across the
     lamps needs mapped positions + roles — see PARTY-BRIEF Phase 9. */
  var lastPull = 0;
  function attentionCue(now) {
    var a = PARTY.attention();
    if (a <= 0) return;
    var every = 6000 - a * 4000;                 // 6s apart → 2s as it gets insistent
    if (now - lastPull < every) return;
    lastPull = now;
    director.pop(0.35 + a * 0.65);
  }

  /* ── dashboard sync: master side (cross-device via serve.py /party relay) ─
     Publishes state snapshots; applies commands from the dashboard. The dashboard
     is a thin client — it never runs the engine, just mirrors state + sends cmds. */
  function pub(obj) {
    try { fetch("/party/pub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }); } catch (e) {}
  }
  // EventSource does NOT retry after an HTTP error status (e.g. a 404 from a server
  // that hasn't got the route yet) — it closes for good. Without an explicit retry a
  // single serve.py restart leaves this page deaf to the dashboard forever, while it
  // keeps publishing state (a plain POST), so everything *looks* connected.
  // Who this page is to the server-side nav arbiter. The party is the DEFAULT owner:
  // with nobody playing, every gesture is stamped `party` and the installation behaves
  // exactly as it did before any arbitration existed. See serve.py for the focus rules.
  var NAV_OWNER = "party";
  var partySub = null;
  function connectParty(delay) {
    try {
      partySub = new EventSource("/party/sub");
      partySub.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (!m || m.from === "master") return;                     // ignore our own broadcasts
        if (m.type === "hello") { pub({ from: "master", type: "state", snap: PARTY.snapshot() }); }
        else if (m.type === "cmd") {
          // One filter line, the same rule every surface follows: a remote gesture
          // addressed to another owner is not ours to act on. Only REMOTE events carry
          // `focus` — the dashboard's own commands never do, so a phone stays in
          // control of the desk no matter who currently holds the physical remote.
          if (m.from === "remote" && m.focus && m.focus !== NAV_OWNER) return;
          PARTY.apply(m); pub({ from: "master", type: "state", snap: PARTY.snapshot() });
        }
      };
      partySub.onopen = function () { delay = 1000; };              // reset backoff on success
      partySub.onerror = function () {
        try { partySub.close(); } catch (e) {}
        setTimeout(function () { connectParty(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
      };
    } catch (e) {
      setTimeout(function () { connectParty(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
    }
  }
  connectParty(1000);
  var lastStatePub = 0, lastSnapJson = "";
  function maybePubState(now) {
    if (now - lastStatePub < 250) return;                          // ~4 Hz ceiling
    var snap = PARTY.snapshot(), j = JSON.stringify(snap);
    if (j === lastSnapJson && now - lastStatePub < 1000) return;   // idle → 1 Hz heartbeat only
    lastStatePub = now; lastSnapJson = j;
    pub({ from: "master", type: "state", snap: snap });
  }

  /* ── main loop ───────────────────────────────────────────────────────── */
  var lastT = performance.now();
  function loop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    PARTY.tick(dt);
    // The master tempo reaches the screen HERE, once. Scaling the dt handed to the
    // director flows into base().update in symmetry.js — every exhibit's _t, every
    // private _ct, every _sub(dt) — so all 38 shapes slow together with no per-exhibit
    // edits. PARTY.tick takes the unscaled dt: it scales its own motion clocks and
    // deliberately keeps the business envelope on wall-clock.
    director.draw(dt * PARTY.tempo());
    pushLamps(t);
    attentionCue(t);
    updateHud();
    maybePubState(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ── keyboard controls (always available) ────────────────────────────────
     ↑/↓ hold = drive business · P = toggle mode · H = cycle · Shift+H = commit
     (Power-hold / playlist-wipe stays intentionally unbound — reserved.) ──── */
  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.key === "ArrowUp")   { PARTY.holdBright(1);  e.preventDefault(); }
    else if (e.key === "ArrowDown") { PARTY.holdBright(-1); e.preventDefault(); }
    else if (e.key === "p" || e.key === "P") { PARTY.toggleMode(); }
    else if (e.key === "h") { PARTY.cycle(); }
    else if (e.key === "H") { PARTY.commit(); director.pop(0.8); }
    else if (e.key === "d" || e.key === "D") { hudOn = !hudOn; }
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") PARTY.holdBright(0);
  });

  /* ── the physical remote ──────────────────────────────────────────────────
     GONE FROM HERE, and that is the point. This used to subscribe to /nav/stream and
     fake a hold with a 450ms `momentaryDrive` timer, because the discrete nav channel
     had no release event — a hack labelled INTERIM from the day it was written.
     listen.py now posts the raw gesture and serve.py fans it to /party/sub, so REAL
     press / repeat / release arrive on the channel this page already reads above
     (connectParty → PARTY.apply → PARTY.button → the room-owned buttonMap). Holding ↑
     ramps for as long as the finger is down, and stops when it lifts, because that is
     what the events now say rather than what a timer guessed.

     This surface's reading of the wire vocabulary is therefore the buttonMap in
     web/party.js, not a nav-action switch. The vocabulary itself is documented in
     exactly one place — controller/serve.py, above publish_input(). */
})();
