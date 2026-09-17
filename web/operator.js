/* operator.js — the Basement console (the house's puppeteer).
 *
 * Loaded only by the-basement.html, an UNLINKED, no-PIN page. Whoever knows
 * the URL is the Dungeon Master: they don't script scenes, they lean on the
 * house's weather and let the Emotional Physics engine (house.js) carry it.
 *
 * Every control is a HOUSE.push or a HOUSE.pulseEvent, relayed to the master
 * window through serve.py:  POST /op  ->  SSE /op/stream  ->  brain.js.
 * Nothing here sets state directly; the operator applies *pressure*, physics
 * owns the rest (inertia, decay, threshold leaks). No cutscenes.
 */
(function () {
  "use strict";

  async function send(obj) {
    try {
      const r = await fetch("/op", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj)
      });
      flash(r.status === 204);
    } catch (e) {
      flash(false);
    }
  }

  const dot = document.getElementById("link-dot");
  const log = document.getElementById("log");
  function flash(ok) {
    if (dot) dot.className = "dot " + (ok ? "ok" : "bad");
  }
  function note(txt) {
    if (!log) return;
    const line = document.createElement("div");
    line.textContent = txt;
    log.prepend(line);
    while (log.childElementCount > 6) log.lastElementChild.remove();
  }

  /* ── sliders: pressure, not position ───────────────────────────────────
     A slider is a valve. Dragging it emits the *delta* from where it was as a
     push, then re-centres — so the house feels a nudge, not a hard set, and
     its own physics decides how far it actually moves. */
  const SLIDERS = [
    { var: "trust",       label: "Trust",       hint: "slow to earn, fast to lose" },
    { var: "mask",        label: "Mask",        hint: "outside diverges from inside" },
    { var: "sensoryLoad", label: "Overload",    hint: "rises fast, falls slow" },
    { var: "fatigue",     label: "Fatigue",     hint: "desaturates everything" },
    { var: "hope",        label: "Warmth",      hint: "valence of the room" },
    { var: "curiosity",   label: "Curiosity",   hint: "pulls toward doors" },
    { var: "regulation",  label: "Regulation",  hint: "the house settling" }
  ];

  const wrap = document.getElementById("sliders");
  SLIDERS.forEach(s => {
    const row = document.createElement("div");
    row.className = "slider";
    row.innerHTML =
      '<div class="lab"><span>' + s.label + '</span><em>' + s.hint + '</em></div>';
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0"; input.max = "100"; input.value = "50";
    let last = 50;
    const push = () => {
      const now = +input.value;
      const delta = (now - last) / 100;      // -1..1 pressure
      if (delta) {
        send({ kind: "push", var: s.var, delta: delta });
        note((delta > 0 ? "▲ " : "▼ ") + s.label + " " + (delta > 0 ? "+" : "") + delta.toFixed(2));
      }
      last = now;
    };
    // recentre after release so the valve is always ready to push either way
    const recentre = () => { input.value = "50"; last = 50; };
    input.addEventListener("input", push);
    input.addEventListener("change", recentre);
    row.appendChild(input);
    wrap.appendChild(row);
  });

  /* ── scene cards: one-tap perturbations → HOUSE.pulseEvent ──────────────
     These are the improv deck. Each is a real-world jolt; the house reacts
     with physics and recovers on its own clock (decay, not snap-back). */
  const CARDS = [
    { name: "fire-alarm",     label: "Fire alarm",        sub: "spikes overload, drops safety" },
    { name: "compliment",     label: "A compliment",      sub: "trust + a dopamine bump" },
    { name: "favourite-song", label: "Their song comes on", sub: "flow + a bright burst" },
    { name: "someone-laughs", label: "Laughter downstairs", sub: "novelty, a little safety" },
    { name: "sudden-silence", label: "Sudden silence",    sub: "load falls, rumination rises" },
    { name: "interrupted",    label: "Interrupted",       sub: "flow breaks, memory drops" },
    { name: "phone-notif",    label: "Phone buzzes",      sub: "small load, small novelty" }
  ];

  const deck = document.getElementById("cards");
  CARDS.forEach(c => {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = "<strong>" + c.label + "</strong><span>" + c.sub + "</span>";
    b.addEventListener("click", () => {
      send({ kind: "event", name: c.name });
      note("✦ " + c.label);
      b.classList.add("fired");
      setTimeout(() => b.classList.remove("fired"), 300);
    });
    deck.appendChild(b);
  });

  /* ── mirror: read the house's public broadcasts (room / beat) ───────────
     Same BroadcastChannel the displays use — only works if the operator page
     is on the same origin as an open master window (same laptop). Read-only. */
  const mirror = document.getElementById("mirror");
  if ("BroadcastChannel" in window && mirror) {
    const ch = new BroadcastChannel("pkb-sync");
    ch.onmessage = ev => {
      const m = ev.data || {};
      if (m.type === "room" && m.room) mirror.textContent = "explorer in: " + m.room;
      else if (m.type === "beat" && m.bpm) mirror.textContent = "tempo: " + Math.round(m.bpm) + " bpm";
    };
  }
})();
