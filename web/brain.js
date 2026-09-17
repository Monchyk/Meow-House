/* brain.js — Deep House: master window logic.
 *
 * Node graph + navigation + multi-display sync (BroadcastChannel) + tempo
 * engine + Hue orchestration. Runs in house.html only; display.html runs
 * display.js and just listens.
 *
 * Input abstraction: everything is 4 actions — up / down / select / back —
 * whether it arrives from the keyboard, number keys, or the physical Hue
 * remote relayed through controller/listen.py → serve.py → /nav/stream.
 */
(function () {
  "use strict";

  console.log(
    "%cDEEP HOUSE",
    "font-size:22px;font-weight:700;color:#F2C94C;text-shadow:0 0 12px #F2C94C;"
  );

  /* ── state ─────────────────────────────────────────────────────────── */
  const S = {
    room: "boot",            // boot | field | decks   (the lobby is gone)
    feelingIndex: 0,
    selectedFeeling: null,   // last APPLIED feeling (lights follow this)
    bpm: 120,
    beatEpoch: Date.now(),
    bpmSource: "tap",        // tap | mic
    micActive: false,
    lightsOnline: null
  };

  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("pkb-sync") : null;
  function broadcast(type, payload) {
    if (channel) channel.postMessage({ type, ...payload });
  }
  function shareState() {
    broadcast("state", {
      state: {
        room: S.room,
        // the second screen rebuilds the SAME field locally (the layout is
        // deterministic), so it only needs to know where we are standing.
        fieldNode: (window.FIELD && FIELD.ready) ? FIELD.nav.current : null,
        fieldMode: (window.FIELD && FIELD.ready) ? FIELD.mode : null,
        fieldPhase: window.PHASES ? PHASES.phase : 1,
        feeling: previewFeeling(),
        selectedFeeling: S.selectedFeeling,
        bpm: S.bpm,
        beatEpoch: S.beatEpoch,
        lightsOnline: S.lightsOnline,
        guideLine: guide.current
      }
    });
  }
  setInterval(() => { broadcast("ping", {}); shareState(); }, 2000);

  function previewFeeling() {
    // the "name it" instrument previews live while you scroll the ten feelings
    if (S.room === "field" && window.FIELD && FIELD.ready && FIELD.mode === "feel")
      return EMOTIONS[FIELD.feelIndex];
    return S.selectedFeeling;
  }

  /* ── DOM handles ───────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const stage = $("stage");
  const roomTitle = $("room-title");
  const hints = $("hints");
  const lightsDot = $("lights-dot");
  const lightsLabel = $("lights-label");

  /* ── the Guide (typewriter line at the bottom) ─────────────────────── */
  const guide = {
    el: $("guide"),
    current: "",
    _timer: null,
    say(line) {
      if (!line) return;
      this.current = line;
      clearInterval(this._timer);
      this.el.textContent = "";
      let i = 0;
      this._timer = setInterval(() => {
        i += 2;
        this.el.textContent = line.slice(0, i);
        if (i >= line.length) clearInterval(this._timer);
      }, 18);
      broadcast("guide", { line });
    },
    sayFrom(list) { this.say(GUIDE.pick(list)); }
  };

  /* ── viz host: an always-on ambient background + a per-room foreground ── */
  const canvas = $("viz");
  const ambientCanvas = $("ambient");
  const ambient = new AmbientDirector(ambientCanvas);   // the living background, everywhere
  function fitCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (viz.active && viz.active.ownsCanvas && viz.active.reset) viz.active.reset();
  }
  window.addEventListener("resize", fitCanvas);

  const viz = {
    field: null, ulam: null, eq: null, decks: null, gallery: null,
    active: null,
    use(name) {
      if (name === "none")  { this.active = null; }       // clear #viz → ambient shows through
      if (name === "field") { this.field = this.field || new FeelingField(canvas); this.active = this.field; }
      if (name === "ulam")  { this.ulam = new UlamSpiral(canvas); this.active = this.ulam; }
      if (name === "eq")    { this.eq = new Equations(canvas); this.active = this.eq; }
      if (name === "decks") { this.decks = this.decks || new DecksViz(canvas); this.active = this.decks; }
      if (name === "gallery") { this.gallery = this.gallery || new SymmetryGallery(canvas); this.gallery.reset(); this.active = this.gallery; }
    }
  };

  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    // the organism advances every frame — physics + pulse always; the endocrine
    // lights only drive rooms that don't take direct control of the lamps
    // (Feelings = you pick, Decks = beat-synced — those own the lights themselves).
    HOUSE.tick(dt);
    HOUSE.pulse(dt);
    HOUSE.hue.decay(dt);                     // rapport fades when you stop pressing Hue
    if (S.room !== "decks" && S.room !== "feelings") HOUSE.emitLights(dt);

    // the always-on living background, tinted by what the lamps are "secreting"
    const endo = HOUSE.endocrine();
    ambient.setTint(endoHex(endo.outward));
    ambient.draw(dt);

    // THE FIELD: the constellation is the map. It advances and draws itself.
    if (S.room === "field" && window.FIELD && FIELD.ready) {
      FIELD.frame(dt, HOUSE.state);
      const fc = canvas.getContext("2d");
      if (FIELD.mode === "develop" && viz.gallery) {
        viz.gallery.draw(dt);                 // the star's portrait, full canvas
      } else {
        FIELD.draw(fc, canvas.width, canvas.height, dt);
      }
    } else if (viz.active) {
      if (viz.active === viz.field) {
        viz.field.setFeeling(previewFeeling(), 0.55);
      }
      if (viz.active === viz.decks) {
        viz.decks.setTempo(S.bpm, S.beatEpoch);
        viz.decks.setSpectrum(mic.active ? mic.spectrum : null);
      }
      viz.active.draw(dt);
    } else {
      // no foreground viz this room → clear #viz so the ambient shows through
      const c = canvas.getContext("2d");
      c.clearRect(0, 0, canvas.width, canvas.height);
    }

    // the Gallery is an ORGAN: its order σ writes back into the house, and a
    // stressed house makes symmetry harder to hold (agency + everything leaks).
    if (S.room === "field" && window.FIELD && FIELD.mode === "develop" && viz.gallery) {
      const g = viz.gallery, sig = g.sigma();
      HOUSE.state.symmetry = sig;                       // σ IS the house's symmetry
      HOUSE.push("regulation", (sig - 0.5) * dt * 0.6);
      HOUSE.push("entropy", (0.5 - sig) * dt * 0.4);
      HOUSE.push("narrativeCertainty", (sig - 0.5) * dt * 0.3);
      // leak back: sensory load / fatigue drag the tuning toward chaos
      const drag = (HOUSE.get("sensoryLoad") * 0.6 + HOUSE.get("fatigue") * 0.3) * dt * 0.25;
      if (drag > 0) g.tune = Math.max(-1, g.tune - drag);
      // the lock reward: reaching symmetry DEVELOPS the star. Once per star,
      // not once per exhibit — field-room.js owns the record, we own the payout.
      if (sig > 0.9 && !g.locked) { g.locked = true; galleryLock(); }
    }

    requestAnimationFrame(loop);
  }

  // endocrine affect → a hex the ambient can tint toward (warm+bright = regulated)
  function endoHex(o) {
    const v = (o.v + 1) / 2;                       // 0..1
    const r = Math.round(90 + v * 150 + o.bright * 15);
    const g = Math.round(90 + v * 110 + o.sat * 20);
    const b = Math.round(150 - v * 30 + (1 - o.sat) * 40);
    const cl = x => Math.max(0, Math.min(255, x));
    return "#" + [cl(r), cl(g), cl(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  // Reaching symmetry: a dopamine burst, and the calm LEAKS into the Archive
  // (a clue fragment surfaces + narrative gets clearer for a moment).
  /* The state pushes for a resolve now live in web/field/moments.js — the one
   * reward funnel — so this only does the screen/guide side. Leaving the old
   * pushes here would double every payoff. */
  function galleryLock() {
    guide.sayFrom(GUIDE.gallery ? GUIDE.gallery.locked : ["Symmetry. The house exhales — and somewhere a locked thing loosens."]);
  }

  /* ── room rendering ────────────────────────────────────────────────── */
  const TITLES = { field: "", decks: "THE DECKS" };
  const HINTS = { decks: "Space tap tempo · Enter mic on/off · ↑ ↓ nudge BPM · Esc field" };

  function render() {
    roomTitle.textContent = (S.room === "field" && window.FIELD && FIELD.ready)
      ? FIELD.title() : (TITLES[S.room] || "");
    hints.textContent = (S.room === "field" && window.FIELD && FIELD.ready)
      ? FIELD.hint() : (HINTS[S.room] || "");
    stage.innerHTML = "";
    stage.className = "room-" + S.room;

    // THE FIELD draws itself on the canvas. The only DOM it needs is the small
    // contextual tray for the star you are standing on — not a menu, an
    // instrument list scoped to one node.
    if (S.room === "field" && window.FIELD && FIELD.ready) {
      if (FIELD.mode === "instrument") {
        const ul = document.createElement("ul");
        ul.className = "menu";
        FIELD.instruments().forEach((it, i) => {
          const li = document.createElement("li");
          li.textContent = it.label;
          li.className = i === FIELD.instrumentIndex ? "focus" : "";
          ul.appendChild(li);
        });
        stage.appendChild(ul);
      }
      if (FIELD.mode === "feel") {
        const wrap = document.createElement("div");
        wrap.className = "feelings";
        EMOTIONS.forEach((f, i) => {
          const node = document.createElement("div");
          node.className = "feeling-node" + (i === FIELD.feelIndex ? " focus" : "");
          node.style.setProperty("--hue", f.hex);
          node.textContent = f.feeling;
          wrap.appendChild(node);
        });
        stage.appendChild(wrap);
        requestAnimationFrame(() => {
          const el = wrap.querySelector(".focus");
          if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
      if (FIELD.mode === "cases") {
        const ul = document.createElement("ul");
        ul.className = "menu threads";
        const list = window.CASES.suggest();
        list.forEach((c, i) => {
          const li = document.createElement("li");
          li.className = i === (FIELD.caseIndex % Math.max(1, list.length)) ? "focus" : "";
          li.innerHTML = `<span class="t-title">${c.title}</span>` +
                         `<span class="t-sub">${c.seen} / ${c.total} seen</span>`;
          ul.appendChild(li);
        });
        stage.appendChild(ul);
      }
    }

    if (S.room === "decks") {
      const d = document.createElement("div");
      d.className = "decks-hud";
      d.innerHTML = `<span class="src ${S.bpmSource === "mic" && S.micActive ? "on" : ""}">` +
        (S.micActive ? "● mic listening" : "○ tap mode") + `</span>`;
      stage.appendChild(d);
    }

    shareState();
  }

  /* ── room transitions ──────────────────────────────────────────────── */
  async function enterRoom(id) {
    const leaving = S.room;
    if (leaving === "decks" && id !== "decks") {
      mic.stop();
      Hue.stop();
      Hue.energy(0.3);
      // hand the lights back to the last chosen feeling, or a neutral sky
      if (S.selectedFeeling) Hue.applyFeeling(S.selectedFeeling);
      else Hue.mood("Clouds");
    }
    S.room = id;
    document.body.dataset.room = id;
    if (window.HOUSE) HOUSE.observe.room(id);    // the house notices you moved

    // re-trigger the room crossfade
    stage.style.animation = "none";
    void stage.offsetWidth;
    stage.style.animation = "";

    if (id === "field") {
      viz.use("none");                            // FIELD draws the canvas itself
      guide.sayFrom(GUIDE.field ? GUIDE.field.intro : GUIDE.lobby);
    }
    if (id === "decks") {
      viz.use("decks");
      guide.sayFrom(GUIDE.decks.intro);
      Hue.energy(0.7);
      Hue.bpm(S.bpm);
      // LivingColor base + BeatPulse locked to the global BPM
      Hue.runEffect({
        AmbientType: "LivingColor",
        AmbientParams: {},
        EffectType: "BeatPulse",
        EffectParams: { syncBpm: "true" },
        DurationSeconds: 3600
      });
    }
    render();
  }

  /* ── the 4-action input handler ────────────────────────────────────── */
  function act(action) {
    if (S.room === "boot") { boot.skip(); return; }
    if (window.HOUSE) HOUSE.observe.input(action);   // dwell / hesitation / backtracking → weather

    // The Hue button (Dimmer's bottom key) is universal — it stirs the organism
    // everywhere. Never a dead press: micro-juice always, reality-slips rarely.
    if (action === "hue") { huePress(); return; }

    // Universal juice: no press is ever dead. Every button kicks the organism —
    // a dopamine flick (→ the lamps brighten), ▲/▼ swing the house's arousal, the
    // screen snaps, and the superfluid bloom flares outward. Navigation and
    // pressing-on-the-house become the same gesture; the room reacts to being touched.
    juice(action);

    // THE FIELD. All four verbs are handled by the field controller; brain.js
    // only forwards. See web/field/field-room.js for the mode machine.
    if (S.room === "field") {
      if (window.FIELD && FIELD.ready) {
        const before = FIELD.mode;
        FIELD.act(action);
        render();
        if (before !== FIELD.mode && FIELD.mode === "develop") viz.use("gallery");
      }
      return;
    }

    if (S.room === "decks") {
      if (action === "up")   setBpm(S.bpm + 1, "tap");
      if (action === "down") setBpm(S.bpm - 1, "tap");
      if (action === "select") mic.toggle();
      if (action === "back") enterRoom("field");
      return;
    }

  }

  /* The universal press juice — called for every non-Hue button, in every room.
   * Real, not cosmetic: it moves House state (so the lamps + endocrine field
   * respond) and flares the on-screen superfluid bloom. ▲/▼ also nudge the house
   * along the arousal axis, so mashing up heats the room and down settles it. */
  function juice(action) {
    if (window.HOUSE) {
      HOUSE.burstDopamine(0.16);                        // brief brighten → lamps flick, bloom warms
      if (action === "up")   HOUSE.push("sensoryLoad",  0.04);   // ▲ stirs arousal up (busier)
      if (action === "down") HOUSE.push("sensoryLoad", -0.04);   // ▼ settles it (calmer, cooler)
    }
    if (stage) { stage.classList.remove("act-pop"); void stage.offsetWidth; stage.classList.add("act-pop"); }
    if (viz.active && viz.active.pop) viz.active.pop(0.6);        // flare the foreground bloom (Gallery)
    if (ambient && ambient.pop) ambient.pop(0.5);                // and the always-on background bloom
  }

  /* A stable key for "where" the player is, so the Hue engine's warmer/colder
   * field has a location to drift around. Room + the room's local focus. */
  function hueSpotKey() {
    if (S.room === "field" && window.FIELD && FIELD.ready) return FIELD.spotKey();
    return S.room;
  }

  /* The Hue press: engine decides the outcome, the UI dresses it up. Every press
   * gets micro-juice; slips/pokes escalate. Dopamine + entropy are pushed inside
   * the engine, so the endocrine lights already respond — we only add the screen. */
  function huePress() {
    if (!window.HOUSE) return;
    HOUSE.hue.setContext(hueSpotKey());
    const out = HOUSE.hue.press();
    // micro-juice: a quick pop on the stage, warmth tightens/brightens the pop
    stage.classList.remove("hue-pop"); void stage.offsetWidth; // restart the anim
    stage.style.setProperty("--hue-warm", out.warmth.toFixed(2));
    stage.classList.add("hue-pop");
    if (out.kind === "slip") realitySlip(out);
    else if (out.kind === "poke") {
      // the house pokes back: a heavier glitch, unbidden
      stage.classList.remove("hue-slip"); void stage.offsetWidth;
      stage.classList.add("hue-slip");
      guide.sayFrom(GUIDE.hue ? GUIDE.hue.poke : []);   // optional, silent if absent
    }
  }

  /* A "reality slip": something on screen is quietly, briefly WRONG — nobody is
   * told. Kept to safe, self-reverting surface mutations; NEVER touches the seven
   * hidden fragments or any firewall'd content. This is the extension point where
   * richer slips (a changed date, a smiling picture) get added per room. */
  function realitySlip(out) {
    stage.classList.remove("hue-slip"); void stage.offsetWidth;
    stage.classList.add("hue-slip");
    // pick a visible line and jitter one glyph for a beat, then restore. Avoid the
    // guide element (it's mid-typewriter) — mutate the passive hint/title only.
    const target = hints || roomTitle;
    if (target && target.textContent && target.textContent.length > 2) {
      const original = target.textContent;
      const i = Math.floor(Math.random() * original.length);
      const swap = original.slice(0, i) + "̵" + original.charAt(i) + original.slice(i + 1);
      target.textContent = swap;
      setTimeout(() => { if (target.textContent === swap) target.textContent = original; }, 900);
    }
  }


  /* THIS SURFACE'S MAPPING of the wire vocabulary. The vocabulary itself is documented
     in exactly ONE place — controller/serve.py, above publish_input(). brain.js reads it
     DIFFERENTLY from the two Part Game shells, deliberately and by ruling: Enter is
     `select` here (not `enter`), Escape is `back` (not `exit`), and it is the only
     surface that uses the fifth action, `hue`, the probability organ. Meaning is decided
     at the surface; a shared wire vocabulary would be the same premature collapse that
     put the meaning inside listen.py. Divergence is fine — undiscoverable divergence is
     not, which is why this block exists.
       up→up  down→down  select→select  back→back  hue→hue  tap→tap-tempo (in The Decks) */
  const NAV_OWNER = "brain";

  /* keyboard: arrows + Enter/Escape, digits 1-4 mirror the 4-button remote */
  const KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", Enter: "select", Escape: "back",
    Digit1: "up", Digit2: "down", Digit3: "select", Digit4: "back",
    Numpad1: "up", Numpad2: "down", Numpad3: "select", Numpad4: "back",
    // Hue Dimmer's bottom button — the probability organ. Keyboard: H or 5.
    KeyH: "hue", Digit5: "hue", Numpad5: "hue"
  };
  window.addEventListener("keydown", e => {
    if (e.repeat && (e.code === "Enter" || e.code === "Escape")) return;
    // boot screen says "any key to enter" — honor that literally
    if (S.room === "boot" && !["Tab", "MetaLeft", "MetaRight", "AltLeft", "AltRight"].includes(e.code)) {
      boot.skip();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (S.room === "decks") tap.hit();
      else if (S.room === "boot") boot.skip();
      return;
    }
    const a = KEYMAP[e.code];
    if (a) { e.preventDefault(); act(a); }
  });

  /* physical remote relay: listen.py → POST /input → serve.py stamps the focus owner
     → SSE /nav/stream. One filter line: an event addressed to another surface is not
     ours to act on. Without it, one press moved this room AND whatever else was open. */
  (function connectNav() {
    if (!("EventSource" in window)) return;
    try {
      const es = new EventSource("/nav/stream?owner=" + NAV_OWNER);
      es.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data);
          if (m.focus && m.focus !== NAV_OWNER) return;   // not addressed to us
          if (m.action === "tap" && S.room === "decks") tap.hit();
          else if (m.action) act(m.action);
        } catch (e) {}
      };
      es.onerror = () => { /* serve.py not running as origin (e.g. file://) — keyboard still works */ };
    } catch (e) {}
  })();

  /* the Operator (Basement console): the-basement.html → POST /op → SSE /op/stream.
     The operator is the house's puppeteer — never a scripted cutscene, just
     perturbations of the same weather. Everything is a HOUSE.push / pulseEvent,
     so physics (inertia, decay, threshold leaks) does the rest. */
  (function connectOp() {
    if (!("EventSource" in window) || !window.HOUSE) return;
    try {
      const es = new EventSource("/op/stream");
      es.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data);
          if (m.kind === "push" && typeof m.var === "string") {
            HOUSE.push(m.var, +m.delta || 0);
          } else if (m.kind === "event" && typeof m.name === "string") {
            HOUSE.pulseEvent(m.name);
          }
        } catch (e) {}
      };
      es.onerror = () => {};
    } catch (e) {}
  })();

  /* ── tempo: tap ────────────────────────────────────────────────────── */
  const tap = {
    times: [],
    hit() {
      const now = Date.now();
      if (this.times.length && now - this.times[this.times.length - 1] > 2500) this.times = [];
      this.times.push(now);
      if (this.times.length > 8) this.times.shift();
      S.beatEpoch = now;
      broadcast("beat", { epoch: now, bpm: S.bpm });
      if (this.times.length >= 3) {
        const gaps = [];
        for (let i = 1; i < this.times.length; i++) gaps.push(this.times[i] - this.times[i - 1]);
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        setBpm(60000 / avg, "tap");
      }
      if (Math.random() < 0.15) guide.sayFrom(GUIDE.decks.tap);
    }
  };

  let lastPostedBpm = 0, lastPostT = 0;
  function setBpm(bpm, source) {
    S.bpm = Math.max(40, Math.min(240, bpm));
    S.bpmSource = source;
    // a faster beat raises intensity + sensory load; the house feels the room
    if (window.HOUSE) {
      HOUSE.state.musicIntensity = Math.max(0, Math.min(1, (S.bpm - 60) / 120));
      HOUSE.push("sensoryLoad", ((S.bpm - 120) / 120) * 0.02);
      HOUSE.push("flow", 0.01);
    }
    const now = Date.now();
    // throttle POSTs: at most every 1.5s, only if it moved ≥ 2 BPM
    if (Math.abs(S.bpm - lastPostedBpm) >= 2 && now - lastPostT > 1500) {
      lastPostedBpm = S.bpm; lastPostT = now;
      Hue.bpm(S.bpm);
    }
    shareState();
  }

  /* ── tempo: microphone (Web Audio FFT onset detection) ─────────────── */
  const mic = {
    active: false,
    ctx: null, analyser: null, stream: null,
    spectrum: null,
    energyHist: [],
    lastOnset: 0,
    onsets: [],
    async toggle() { this.active ? this.stop() : this.start(); },
    async start() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } catch (e) {
        guide.sayFrom(GUIDE.decks.micDenied);
        return;
      }
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.4;
      src.connect(this.analyser);
      this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
      this.active = true;
      S.micActive = true; S.bpmSource = "mic";
      guide.sayFrom(GUIDE.decks.micOn);
      this._pump();
      render();
    },
    stop() {
      this.active = false;
      S.micActive = false;
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      this.spectrum = null;
      render();
    },
    _pump() {
      if (!this.active) return;
      this.analyser.getByteFrequencyData(this.spectrum);
      // low-band energy (~20–160 Hz: kick drum territory)
      const binHz = this.ctx.sampleRate / this.analyser.fftSize;
      const lo = Math.max(1, Math.floor(20 / binHz));
      const hi = Math.min(this.spectrum.length - 1, Math.ceil(160 / binHz));
      let e = 0;
      for (let i = lo; i <= hi; i++) e += this.spectrum[i];
      e /= (hi - lo + 1);

      const now = Date.now();
      this.energyHist.push(e);
      if (this.energyHist.length > 43) this.energyHist.shift(); // ~0.7s @60fps
      const avg = this.energyHist.reduce((a, b) => a + b, 0) / this.energyHist.length;

      // onset: energy pops above the rolling average, with a refractory gap
      if (e > avg * 1.45 && e > 30 && now - this.lastOnset > 240) {
        this.lastOnset = now;
        this.onsets.push(now);
        if (this.onsets.length > 24) this.onsets.shift();
        this._estimate();
      }
      requestAnimationFrame(() => this._pump());
    },
    _estimate() {
      if (this.onsets.length < 6) return;
      // fold inter-onset intervals into the 70–180 BPM window, take median
      const bpms = [];
      for (let i = 1; i < this.onsets.length; i++) {
        let gap = this.onsets[i] - this.onsets[i - 1];
        if (gap < 200 || gap > 2200) continue;
        let bpm = 60000 / gap;
        while (bpm < 70) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        bpms.push(bpm);
      }
      if (bpms.length < 4) return;
      bpms.sort((a, b) => a - b);
      const med = bpms[Math.floor(bpms.length / 2)];
      // only re-anchor the visual beat epoch on confident updates
      S.beatEpoch = this.lastOnset;
      broadcast("beat", { epoch: this.lastOnset, bpm: med });
      setBpm(med, "mic");
    }
  };

  /* ── lights status indicator ───────────────────────────────────────────
   * three states: API down (red) / API up but bridge stream disconnected
   * (amber — the app answers, the lamps won't move) / fully live (green). */
  const bootTime = Date.now();
  let lastLive = null;
  Hue.onStatus((online, bridgeConnected) => {
    const live = online && bridgeConnected;
    S.lightsOnline = live;
    lightsDot.className = "dot " + (!online ? "off" : (bridgeConnected ? "on" : "mid"));
    lightsLabel.textContent = !online ? "lights offline" : (bridgeConnected ? "lights" : "bridge offline");
    // announce changes, but not the settling-in flurry right after boot
    if (lastLive !== null && live !== lastLive && Date.now() - bootTime > 8000) {
      guide.sayFrom(live ? GUIDE.lightsBack : GUIDE.lightsLost);
    }
    lastLive = live;
    shareState();
  });

  /* ── boot sequence ─────────────────────────────────────────────────── */
  const boot = {
    i: 0,
    _timer: null,
    start() {
      viz.use("none");                       // the ambient greets you before you enter
      roomTitle.textContent = "DEEP HOUSE";
      hints.textContent = "any key to enter";
      const next = () => {
        if (S.room !== "boot") return;
        guide.say(GUIDE.boot[this.i]);
        this.i++;
        if (this.i < GUIDE.boot.length) this._timer = setTimeout(next, 4200);
        else this._timer = setTimeout(() => this.skip(), 4200);
      };
      next();
    },
    skip() {
      clearTimeout(this._timer);
      if (S.room === "boot") enterRoom("field");
    }
  };

  /* ── the field: boot the constellation and wire the house's initiative ── */
  (function bootField() {
    if (!window.FIELD) return;
    // the gallery is created up front: it is every star's portrait now
    viz.gallery = viz.gallery || new SymmetryGallery(canvas);
    FIELD.boot(canvas, viz.gallery, {
      bpm: () => S.bpm,

      onArrive(id, novel) {
        if (novel) guide.sayFrom(GUIDE.field ? GUIDE.field.arrive : GUIDE.lobby);
        render();
      },

      onDevelop(node) {
        // a star resolves. The payout the old galleryLock() comment always
        // claimed, now actually attached to a thing that is remembered.
        galleryLock();
        render();
      },

      onReading(node, feeling, match) {
        // No failure state: a mismatch is a different reading, not a wrong one.
        guide.sayFrom(GUIDE.field
          ? (match ? GUIDE.field.readMatch : GUIDE.field.readMiss)
          : GUIDE.lobby);
      },

      onCaseWalked(caseId) {
        HOUSE.push("narrativeCertainty", 0.15);
        guide.sayFrom(GUIDE.field ? GUIDE.field.caseWalked : GUIDE.lobby);
      },

      onPhase(now, before) {
        // The arc turns. Nothing is announced; the field itself is the message.
        HOUSE.push("regulation", 0.1);
        if (GUIDE.field && GUIDE.field.phase && GUIDE.field.phase[now])
          guide.sayFrom(GUIDE.field.phase[now]);
      },

      // AGENCY: the house acting on its own. Music intents drift the tempo.
      driftBpm(strength) {
        setBpm(S.bpm + (Math.random() < 0.5 ? -1 : 1) * (2 + strength * 6), "house");
      },

      onAgency(intent) {
        // Never narrated. The house does not explain itself; provenance lives
        // in intent.because for debugging only.
        if (FIELD_CFG.debug.showAgency) console.log("[agency]", intent);
      }
    }).then(() => render());
  })();

  /* ── go ────────────────────────────────────────────────────────────── */
  fitCanvas();
  if (window.HOUSE) {
    HOUSE.loadMemory();                                   // the house remembers the last visit
    window.addEventListener("beforeunload", () => HOUSE.saveMemory());
    setInterval(() => HOUSE.saveMemory(), 15000);         // and doesn't lose it if the tab dies
  }
  Hue.startStatusPoll();
  boot.start();
  requestAnimationFrame(loop);
})();
