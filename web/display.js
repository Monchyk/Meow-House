/* display.js — passive display view (display.html).
 *
 * Zero input, zero API calls. Listens on the BroadcastChannel for state
 * from the master window (house.html) and renders a full-bleed visual for
 * the current room, plus the feeling word and the Guide's line. Open one
 * per extra screen; they all stay in step with the master.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("viz");
  const feelingWord = document.getElementById("feeling-word");
  const guideLine = document.getElementById("guide");
  const waiting = document.getElementById("waiting");
  const roomTag = document.getElementById("room-tag");

  function fit() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener("resize", fit);
  fit();

  const viz = {
    field: null, ulam: null, eq: null, decks: null, active: null,
    use(name) {
      if (!name) { this.active = null; }
      if (name === "field") { this.field = this.field || new FeelingField(canvas); this.active = this.field; }
      if (name === "ulam")  { this.ulam = this.ulam || new UlamSpiral(canvas); this.active = this.ulam; }
      if (name === "eq")    { this.eq = this.eq || new Equations(canvas); this.active = this.eq; }
      if (name === "decks") { this.decks = this.decks || new DecksViz(canvas); this.active = this.decks; }
    }
  };

  let state = null;
  let lastPing = 0;
  const TAGS = { field: "", decks: "the decks", boot: "" };

  /* THE FIELD, mirrored. The layout is deterministic, so this window rebuilds
   * the identical constellation from the same seed and only has to be told
   * which star the master is standing on. No input, no selection ring — this
   * is the same place seen from another room. */
  const F = { ready: false, g: null, L: null, nav: null, R: null };
  fetch("constellation.json").then(r => r.json()).then(doc => {
    F.g = new FieldGraph(doc);
    F.L = new FieldLayout(F.g, FIELD_CFG.layout);
    F.nav = new FieldNav(F.g, F.L, FIELD_CFG.nav);
    F.R = new FieldRender(F.g, F.L, F.nav, FIELD_CFG.render);
    F.nav.start();
    PHASES.init(FIELD_CFG.phases);
    F.ready = true;
  }).catch(() => { /* no field data: fall back to the feeling viz */ });

  function apply(s) {
    state = s;
    const room = s.room === "boot" ? "field" : s.room;
    if (room === "decks") viz.use("decks");
    else viz.use(null);                       // the field owns the canvas

    if (F.ready && s.fieldNode && s.fieldNode !== F.nav.current) {
      F.nav.travel(s.fieldNode);              // glide to wherever the master went
    }
    if (F.ready && s.fieldPhase) PHASES.phase = s.fieldPhase;

    const f = s.feeling;
    if (viz.active === viz.decks) viz.decks.setTempo(s.bpm, s.beatEpoch);

    feelingWord.textContent = (s.fieldMode === "feel" && f) ? f.feeling : "";
    if (f) feelingWord.style.color = f.hex;
    roomTag.textContent = TAGS[room] || "";
    if (s.guideLine) guideLine.textContent = s.guideLine;
  }

  if ("BroadcastChannel" in window) {
    const ch = new BroadcastChannel("pkb-sync");
    ch.onmessage = ev => {
      const m = ev.data;
      lastPing = Date.now();
      if (m.type === "state") apply(m.state);
      if (m.type === "ping") { /* liveness only */ }
      if (m.type === "guide") guideLine.textContent = m.line;
      if (m.type === "beat" && viz.decks) viz.decks.setTempo(m.bpm, m.epoch);
    };
  }

  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    waiting.style.display = (Date.now() - lastPing > 6000) ? "flex" : "none";
    if (viz.active) { viz.active.draw(dt); }
    else if (F.ready) {
      F.L.frame(dt); F.nav.frame(dt);
      const c = canvas.getContext("2d");
      F.R.draw(c, canvas.width, canvas.height, dt, {
        weights: PHASES.weights(), progress: null, highlight: null,
        hops: 2, fade: 0.22
      });
    }
    requestAnimationFrame(loop);
  }
  viz.use("field"); // idle drift while waiting for the master
  requestAnimationFrame(loop);
})();
