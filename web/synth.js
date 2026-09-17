/* synth.js — the synth patchbay (thin client, like dashboard.js).
 *
 * A signal-flow MAP of the party organism: modules (clocks / envelopes / outputs) as
 * nodes, the engine couplings as cords that glow with the live value they carry. Click
 * anything — a module, a cord, a knob, an exhibit — for a teaching card (plain → math →
 * code). Editing a knob reuses the same /party relay as the dashboard.
 *
 * Reuses (does NOT reinvent): the relay + reconnect (send/cmd/connect), the drag-safe
 * live-update split (a synth-specific structKey + refresh), and the setConfig / patch
 * commands — all identical to dashboard.js so the master can't tell the two apart.
 *
 * The teaching content + the patch→cord model live in synth-cards.js (pure, tested).
 */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var conn = document.getElementById("conn");
  var SC = (typeof window !== "undefined" && window.SYNTHCARDS) || null;
  var TUNE = (typeof window !== "undefined" && window.TUNE) || [];
  var state = null, quietUntil = 0, lastKey = "", pressing = false;
  var curCords = [], openId = null;   // openId = "type:id" of the map-side card currently shown
  var selectedExhibit = null;          // which pattern the reader is showing

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  /* ── relay (lifted verbatim from dashboard.js) ───────────────────────────── */
  function send(o) { o.from = "dash"; try { fetch("/party/pub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }); } catch (e) {} }
  function cmd(o) { o.type = "cmd"; send(o); }
  function connect(delay) {
    var es = new EventSource("/party/sub");
    es.onopen = function () { conn.textContent = "● live"; conn.className = "on"; delay = 1000; send({ type: "hello" }); };
    es.onerror = function () {
      conn.textContent = "○ reconnecting…"; conn.className = "off";
      try { es.close(); } catch (e) {}
      setTimeout(function () { connect(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
    };
    es.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (!m || m.from !== "master" || m.type !== "state") return;
      state = m.snap;
      var key = structKey(state);
      if (key !== lastKey && !pressing && Date.now() >= quietUntil) { render(); lastKey = key; }
      refresh();
    };
  }
  connect(1000);
  send({ type: "hello" });

  /* ── live values ─────────────────────────────────────────────────────────
     A cord/node's `live` names a snapshot field (business/tune/zoom/effectiveEnergy) or,
     for a patch cord, a modSource key (swing/zoom/…). fieldFor() maps a source key to the
     snapshot field it reads; liveVal() normalizes to 0..1 for glow. */
  var SRC_FIELD = { swing: "tune", zoom: "zoom", business: "business", cycle: null, breath: null };
  function fieldFor(live) { return (live in SRC_FIELD) ? SRC_FIELD[live] : live; }
  function liveVal(field) {
    if (!field || !state) return null;
    switch (field) {
      case "business": return clamp(state.business, 0, 1);
      case "tune": return clamp(state.tune, 0, 1);
      case "effectiveEnergy": return clamp(state.effectiveEnergy, 0, 1);
      case "zoom": { var z = state.zoom == null ? 1 : state.zoom; return clamp((z - 1) / 5, 0, 1); }
      default: return null;
    }
  }

  /* ── node positions — nodePos(idOrKey) is the zero-rework hinge (fable #1/#3):
     it resolves a MODULE id OR a config key to a point, so a fixed cord and a live patch
     cord place their endpoints the same way. A config key lands at the knobs panel node;
     a future per-knob port only has to add its own case here. */
  var MODMAP = {}; if (SC) SC.MODULES.forEach(function (m) { MODMAP[m.id] = m; });
  function nodePos(idOrKey) {
    if (MODMAP[idOrKey]) return MODMAP[idOrKey].pos;
    if (MODMAP.knobs) return MODMAP.knobs.pos;   // any config key → the knob panel anchor
    return null;
  }
  var KIND_CLASS = { clock: "clock", envelope: "env", output: "out", panel: "panel" };

  /* ── the patch bay — the interactive routing surface ──────────────────────────
     The map above is the PICTURE of how things connect; this is where you CHANGE it.
     The engine's fixed couplings are hard wiring and stay read-only, but any of its
     clocks (swing / zoom / business / cycle / breath) can be patched onto any knob —
     that IS the re-routable "sequence of connections". Each row is one live patch
     {src → knob, depth}: change the source, change the destination, drag the depth, or
     unplug. Everything flows through the same `patch` command the engine already has
     (party.js:1012), and a new patch immediately draws itself as a cord on the map. */
  function srcOptions(cur) {
    return SC.MODSOURCE_KEYS.map(function (s) {
      var lbl = MODMAP[s] ? MODMAP[s].label : s;
      return '<option value="' + esc(s) + '"' + (s === cur ? " selected" : "") + ">" + esc(lbl) + "</option>";
    }).join("");
  }
  // knob <option>s, grouped by TUNE group; knobs already driven by another patch are
  // marked "• in use" (picking one replaces that patch — one clock per knob, by design).
  function knobOptions(cur, includePrompt) {
    var occupied = {}; (state.mods || []).forEach(function (m) { occupied[m.key] = m.src; });
    var out = includePrompt ? '<option value="">choose a knob…</option>' : "", group = null;
    TUNE.forEach(function (t) {
      if (!state.config || state.config[t.k] == null) return;
      if (t.g !== group) { if (group !== null) out += "</optgroup>"; group = t.g; out += '<optgroup label="' + esc(group) + '">'; }
      var busy = occupied[t.k] && t.k !== cur;
      out += '<option value="' + esc(t.k) + '"' + (t.k === cur ? " selected" : "") + ">" +
        esc(t.t) + (busy ? " • in use" : "") + "</option>";
    });
    if (group !== null) out += "</optgroup>";
    return out;
  }
  function patchbayHtml() {
    var mods = (state.mods || []).slice().sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    var h = '<section class="patchbay"><h3>The patch bay — rewire the room</h3>' +
      '<p class="hint">Connect any clock to any knob and it starts driving that knob, live. ' +
      'Change either end, drag the depth, or unplug to hand the knob back. Each connection also ' +
      'appears as a glowing cord on the map above.</p>';
    // draggable source jacks — grab one and drop it on any knob below to wire it.
    h += '<div class="jacks"><span class="jlbl">drag a clock onto any knob ↓</span>';
    SC.MODSOURCE_KEYS.forEach(function (s) {
      var lbl = MODMAP[s] ? MODMAP[s].label : s;
      h += '<span class="jack" draggable="true" data-src="' + esc(s) + '" title="drag onto a knob">⠿ ' + esc(lbl) + "</span>";
    });
    h += "</div>";
    if (!mods.length) h += '<p class="none">No patches yet — the room runs on its fixed wiring. Add one below.</p>';
    mods.forEach(function (m) {
      h += '<div class="prow" data-row="' + esc(m.key) + '">' +
        '<select class="psrc" data-row="' + esc(m.key) + '">' + srcOptions(m.src) + "</select>" +
        '<span class="arrow">→</span>' +
        '<select class="pdst" data-row="' + esc(m.key) + '">' + knobOptions(m.key, false) + "</select>" +
        '<input type="range" class="pdepth" data-row="' + esc(m.key) + '" min="0" max="1" step="0.01" value="' + m.depth + '">' +
        '<em class="pdv" data-row="' + esc(m.key) + '">±' + Math.round(m.depth * 100) + "%</em>" +
        '<button data-unplug="' + esc(m.key) + '" title="unplug">✕</button>' +
        "</div>";
    });
    h += '<div class="prow add">' +
      '<select id="addsrc">' + srcOptions("breath") + "</select>" +
      '<span class="arrow">→</span>' +
      '<select id="adddst">' + knobOptions(null, true) + "</select>" +
      '<button id="addpatch">connect</button></div></section>';
    return h;
  }

  // Trim a cord to the two node edges (nodes are ~20×9) so the arrowhead sits just
  // outside the target box instead of hiding under it.
  function edge(a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L;
    function t(hw, hh) { return Math.min(ux ? hw / Math.abs(ux) : 1e9, uy ? hh / Math.abs(uy) : 1e9); }
    var ta = t(9.5, 4), tb = t(10.2, 4.4);
    return [[a[0] + ux * ta, a[1] + uy * ta], [b[0] - ux * tb, b[1] - uy * tb]];
  }

  /* ── structure key — rebuild only when the SHAPE changes (which patches exist, which
     config keys are present). Live numbers ride refresh(). NOT dashboard's structKey. */
  function structKey(s) {
    if (!s) return "";
    return JSON.stringify([
      (s.mods || []).map(function (m) { return m.key + ">" + m.src; }).sort(),
      Object.keys(s.config || {}).sort(),
    ]);
  }

  /* ── render (build the whole page from state; gated by structKey) ────────── */
  function render() {
    if (Date.now() < quietUntil) return;
    if (!state) { app.innerHTML = '<p class="wait">waiting for the party… is /party.html open?</p>'; return; }
    if (!SC) { app.innerHTML = '<p class="wait">synth-cards.js failed to load.</p>'; return; }

    curCords = SC.cordsFromState(state);

    var svg = "";
    // arrowhead (fixed size; fill follows each cord's own colour via context-stroke)
    svg += '<defs><marker id="arw" markerUnits="userSpaceOnUse" markerWidth="5" markerHeight="5" refX="3.6" refY="2" orient="auto">' +
           '<path d="M0,0 L4,2 L0,4 Z" fill="context-stroke"/></marker></defs>';
    // column headers — left → right IS the direction signal flows
    var COLX = { drivers: 18, clocks: 50, outputs: 82 };
    Object.keys(COLX).forEach(function (k) {
      svg += '<text class="collabel" x="' + COLX[k] + '" y="9">' + k.toUpperCase() + '</text>';
    });
    // cords first (under the nodes), trimmed to the node edges so the arrowhead shows
    curCords.forEach(function (c, i) {
      var a = nodePos(c.from), b = nodePos(c.to); if (!a || !b) return;
      var e = edge(a, b), a2 = e[0], b2 = e[1];
      var kind = c.kind === "patch" ? " patch" : c.kind === "auto" ? " auto" : c.kind === "latent" ? " latent" : "";
      svg += '<line class="cord' + kind + '" marker-end="url(#arw)" data-live="' + esc(c.live || "") +
        '" x1="' + a2[0] + '" y1="' + a2[1] + '" x2="' + b2[0] + '" y2="' + b2[1] + '"/>';
      svg += '<line class="cordhit" data-cordidx="' + i + '" x1="' + a2[0] + '" y1="' + a2[1] + '" x2="' + b2[0] + '" y2="' + b2[1] + '"/>';
    });
    // nodes
    SC.MODULES.forEach(function (m) {
      var x = m.pos[0], y = m.pos[1], cls = "node " + (KIND_CLASS[m.kind] || "");
      svg += '<g class="' + cls + '" data-node="' + esc(m.id) + '">';
      svg += '<rect class="glow" data-live="' + esc(m.live || "") + '" x="' + (x - 9.5) + '" y="' + (y - 4) + '" width="19" height="8" rx="1.7"/>';
      svg += '<rect x="' + (x - 9) + '" y="' + (y - 3.5) + '" width="18" height="7" rx="1.4"/>';
      svg += '<text x="' + x + '" y="' + (y - 0.3) + '">' + esc(m.label) + '</text>';
      if (m.live) svg += '<text class="val" data-live="' + esc(m.live) + '" x="' + x + '" y="' + (y + 2.3) + '"></text>';
      svg += '</g>';
    });

    // top row: the map (left, wide) + the card panel (right)
    var h = '<div class="grid"><div class="left"><section><h3>The patch</h3>' +
      '<svg class="map" viewBox="0 0 100 54" preserveAspectRatio="xMidYMid meet">' + svg + '</svg>' +
      '<div class="legend">' +
        '<b class="clock">clocks</b> swing on their own · <b class="env">envelopes</b> rise &amp; fall · ' +
        '<b class="out">outputs</b> the room sees · <b class="patch">patch</b> = a knob driven by a clock. ' +
        'Cords glow with the value flowing through them — drive business on /party.html and watch.</div></section></div>' +
      '<aside class="right"><section class="card" id="card">' + cardHtml(openId) + '</section></aside></div>';

    h += patchbayHtml();

    // full width: the knobs, spread across the page (grouped; group headers span a row).
    // Kept directly under the patch bay so the drag jacks and their drop targets share a
    // screen — you can wire a clock onto a knob without scrolling past the patterns.
    h += '<section><h3>The knobs</h3><div class="knobgrid">';
    var group = null;
    TUNE.forEach(function (t) {
      var v = state.config ? state.config[t.k] : null; if (v == null) return;
      if (t.g !== group) { group = t.g; h += '<div class="kgroup">' + esc(group) + '</div>'; }
      var mod = (state.mods || []).filter(function (m) { return m.key === t.k; })[0];
      h += '<div class="knob' + (mod ? " modded" : "") + '" data-drop="' + esc(t.k) + '">' +
        '<span class="nm" data-knobcard="' + esc(t.k) + '" title="what does this do?">' +
          esc(t.t) + ' ⓘ</span>' +
        '<input type="range" min="' + t.min + '" max="' + t.max + '" step="' + t.st + '" value="' + v + '" data-key="' + esc(t.k) + '">' +
        '<em class="v" data-vk="' + esc(t.k) + '">' + (+v).toFixed(3) + '</em>' +
        (mod ? '<span class="patchtag">driven by the ' + esc(mod.src) + ' clock (±' + Math.round(mod.depth * 100) +
               '%) <button data-unplug="' + esc(t.k) + '">unplug</button></span>' : '') +
        '</div>';
    });
    h += '</div></section>';

    // full width: the patterns — a browseable index (left) + a roomy reader (right)
    h += '<section class="patterns"><h3>The patterns</h3><div class="playout"><div class="plist">';
    var ptag = null;
    Object.keys(SC.EXHIBIT_CARDS).forEach(function (t) {
      var tg = SC.EXHIBIT_CARDS[t].tag || "pattern";
      if (tg !== ptag) { ptag = tg; h += '<div class="ptag-h">' + esc(tg) + '</div>'; }
      h += '<button class="ptile' + (t === selectedExhibit ? " sel" : "") + '" data-exhibit="' + esc(t) + '">' + esc(t) + '</button>';
    });
    h += '</div><div class="preader" id="preader">' + readerHtml(selectedExhibit) + '</div></div>' +
      '<div class="legend">' + Object.keys(SC.EXHIBIT_CARDS).length + ' of 38 so far — the rest arrive next.</div></section>';

    app.innerHTML = h;
  }

  /* ── the card panel ──────────────────────────────────────────────────────── */
  function levels(parts) {
    var h = "";
    if (parts.eli5) h += '<div class="lvl eli5">🟢 ' + esc(parts.eli5) + '</div>';
    if (parts.math) h += '<div class="lvl math">🔵 ' + esc(parts.math) + '</div>';
    if (parts.code) h += '<div class="lvl code">⚙️ ' + esc(parts.code) + '</div>';
    return h;
  }
  function cardHtml(id) {
    if (!id || !SC) return '<span class="empty">Click a module, a cord, a knob or a pattern to learn what it does.</span>';
    var close = '<button class="close" data-cmd="closecard">✕</button>';
    var p = id.split(":"), type = p[0], key = p.slice(1).join(":");
    if (type === "module") {
      var m = MODMAP[key]; if (!m) return cardHtml(null);
      return close + '<span class="tag">' + esc(m.kind) + (m.patchSource ? " · patch source" : "") + '</span>' +
        '<h2>' + esc(m.label) + '</h2>' + levels({ eli5: m.eli5 });
    }
    if (type === "cord") {
      var c = curCords[+key]; if (!c) return cardHtml(null);
      var title = (MODMAP[c.from] ? MODMAP[c.from].label : c.from) + " → " + (MODMAP[c.to] ? MODMAP[c.to].label : c.to);
      return close + '<span class="tag">' + (c.kind === "patch" ? "live LFO patch" : "coupling") + '</span>' +
        '<h2>' + esc(title) + '</h2>' + levels(c);
    }
    if (type === "knob") {
      var meta = TUNE.filter(function (t) { return t.k === key; })[0];
      var card = SC.KNOB_CARDS[key];
      var label = meta ? meta.t : key;
      if (card) return close + '<span class="tag">knob</span><h2>' + esc(label) + '</h2>' + levels(card);
      return close + '<span class="tag">knob</span><h2>' + esc(label) + '</h2>' +
        levels({ eli5: meta ? meta.h : "", code: "" }) +
        '<div class="lvl code">deeper card coming in the next batch.</div>';
    }
    if (type === "exhibit") {
      var e = SC.EXHIBIT_CARDS[key]; if (!e) return cardHtml(null);
      return close + '<span class="tag">pattern</span><h2>' + esc(key) + '</h2>' +
        levels({ eli5: e.eli5, math: e.formula, code: e.code });
    }
    return cardHtml(null);
  }
  function openCard(id) {
    openId = id;
    var el = document.getElementById("card");
    if (el) el.innerHTML = cardHtml(id);
  }

  /* ── the info bulletin — a real pop-up for a slider title ──────────────────
     Clicking a knob name used to only refresh the tiny side card up top, so a
     click far down the knob grid looked like it did nothing. This pops a modal
     right in the middle: plain words first, then (if we have them) the maths and
     a pointer into the code. Lives OUTSIDE #app so render()'s innerHTML rewrite
     can't wipe it. */
  var pop = document.createElement("div");
  pop.className = "popwrap";
  document.body.appendChild(pop);
  function closePop() { pop.classList.remove("on"); pop.innerHTML = ""; }
  function openKnobPop(key) {
    var meta = TUNE.filter(function (t) { return t.k === key; })[0];
    var card = SC.KNOB_CARDS[key];
    var label = meta ? meta.t : key;
    // prefer the deep card's plain line; always fall back to the room-language hint
    var eli5 = (card && card.eli5) || (meta && meta.h) || "";
    var h = '<div class="pop"><button class="close" data-cmd="closepop">✕</button>' +
      '<span class="tag">slider</span><h2>' + esc(label) + '</h2>' +
      '<div class="eli5">' + esc(eli5) + '</div>';
    if (card && card.math) h += '<div class="math">' + esc(card.math) + '</div>';
    if (card && card.code) h += '<div class="code">in the code: ' + esc(card.code) + '</div>';
    h += "</div>";
    pop.innerHTML = h;
    pop.classList.add("on");
  }
  pop.addEventListener("click", function (e) {
    // click the dark backdrop or the ✕ to dismiss; clicks inside the card do nothing
    if (e.target === pop || (e.target.closest && e.target.closest("[data-cmd='closepop']"))) closePop();
  });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });

  /* ── the patterns reader (roomy; NOT the cramped side card) ──────────────── */
  function readerHtml(title) {
    if (!SC || !title || !SC.EXHIBIT_CARDS[title]) {
      return '<div class="prompt">Pick a pattern on the left to read how it works — plain words first, then the maths, then a line straight to the code.</div>';
    }
    var e = SC.EXHIBIT_CARDS[title], h = '<div class="measure">';
    h += '<span class="tag">' + esc(e.tag || "pattern") + '</span><h2>' + esc(title) + '</h2>';
    h += '<div class="lvl eli5">🟢 ' + esc(e.eli5) + '</div>';
    if (e.more) h += '<div class="lvl more"><b>going deeper</b><br>' + esc(e.more) + '</div>';
    h += '<div class="lvl math">🔵 ' + esc(e.formula) + '</div>';
    if (e.mathPlain) h += '<div class="lvl mathplain"><b>…in plain words</b><br>' + esc(e.mathPlain) + '</div>';
    h += '<div class="lvl code">⚙️ ' + esc(e.code) + '</div></div>';
    return h;
  }
  function selectExhibit(title) {
    selectedExhibit = title;
    var rd = document.getElementById("preader");
    if (rd) rd.innerHTML = readerHtml(title);
    app.querySelectorAll(".ptile").forEach(function (el) {
      el.classList.toggle("sel", el.getAttribute("data-exhibit") === title);
    });
  }

  /* ── live refresh (no rebuild) ───────────────────────────────────────────── */
  function refresh() {
    if (!state) return;
    // cord glow
    app.querySelectorAll(".cord[data-live]").forEach(function (el) {
      var g = liveVal(fieldFor(el.getAttribute("data-live")));
      if (g == null) { el.style.strokeOpacity = 0.32; el.style.strokeWidth = 0.55; return; }
      el.style.strokeOpacity = (0.12 + 0.8 * g).toFixed(3);
      el.style.strokeWidth = (0.4 + 1.9 * g).toFixed(3);
    });
    // node glow ring + value text
    app.querySelectorAll(".glow[data-live]").forEach(function (el) {
      var g = liveVal(fieldFor(el.getAttribute("data-live")));
      el.style.strokeWidth = g == null ? 0 : (0.3 + 1.7 * g).toFixed(3);
    });
    app.querySelectorAll(".val[data-live]").forEach(function (el) {
      var f = fieldFor(el.getAttribute("data-live"));
      var raw = f === "zoom" ? (state.zoom == null ? 1 : state.zoom) : state[f];
      el.textContent = raw == null ? "" : (f === "zoom" ? "×" + (+raw).toFixed(2) : (+raw).toFixed(2));
    });
    // knob live values (leave the one being dragged alone)
    if (Date.now() >= quietUntil) {
      TUNE.forEach(function (t) {
        var v = state.config ? state.config[t.k] : null; if (v == null) return;
        var inp = app.querySelector('input[data-key="' + t.k + '"]');
        if (inp && document.activeElement !== inp) inp.value = v;
        var em = app.querySelector('em[data-vk="' + t.k + '"]');
        if (em) em.textContent = (+v).toFixed(3);
      });
    }
  }

  /* ── input (event delegation) ────────────────────────────────────────────── */
  app.addEventListener("pointerdown", function () { pressing = true; });
  window.addEventListener("pointerup", function () { pressing = false; });
  window.addEventListener("pointercancel", function () { pressing = false; });

  app.addEventListener("click", function (e) {
    var t = e.target;
    var closer = t.closest ? t.closest("[data-cmd='closecard']") : null;
    if (closer) { openCard(null); return; }
    var unplug = t.closest ? t.closest("[data-unplug]") : null;
    if (unplug) { cmd({ cmd: "patch", key: unplug.getAttribute("data-unplug"), src: null, depth: 0 }); return; }
    var knob = t.closest ? t.closest("[data-knobcard]") : null;
    if (knob) { openKnobPop(knob.getAttribute("data-knobcard")); return; }
    var tile = t.closest ? t.closest("button.ptile") : null;
    if (tile) { selectExhibit(tile.getAttribute("data-exhibit")); return; }
    var cord = t.closest ? t.closest("[data-cordidx]") : null;
    if (cord) { openCard("cord:" + cord.getAttribute("data-cordidx")); return; }
    var addbtn = t.closest ? t.closest("#addpatch") : null;
    if (addbtn) {
      var s = document.getElementById("addsrc"), d = document.getElementById("adddst");
      if (s && d && d.value) { quietUntil = Date.now() + 400; cmd({ cmd: "patch", key: d.value, src: s.value, depth: 0.3 }); }
      return;
    }
    var node = t.closest ? t.closest("[data-node]") : null;
    if (node) { openCard("module:" + node.getAttribute("data-node")); return; }
  });

  // re-route a patch: changing the SOURCE re-sources in place; changing the DESTINATION
  // unplugs the old knob and patches the new one (one clock per knob). The depth carried
  // over is read live from the row's own slider.
  function rowDepth(key) {
    var r = app.querySelector('.pdepth[data-row="' + key + '"]');
    return r ? +r.value : 0.3;
  }
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (!t.getAttribute) return;
    var srcRow = t.classList && t.classList.contains("psrc") ? t.getAttribute("data-row") : null;
    if (srcRow) { quietUntil = Date.now() + 400; cmd({ cmd: "patch", key: srcRow, src: t.value, depth: rowDepth(srcRow) }); return; }
    var dstRow = t.classList && t.classList.contains("pdst") ? t.getAttribute("data-row") : null;
    if (dstRow && t.value && t.value !== dstRow) {
      var srcSel = app.querySelector('.psrc[data-row="' + dstRow + '"]');
      var src = srcSel ? srcSel.value : "breath", depth = rowDepth(dstRow);
      quietUntil = Date.now() + 400;
      cmd({ cmd: "patch", key: dstRow, src: null, depth: 0 });    // free the old knob
      cmd({ cmd: "patch", key: t.value, src: src, depth: depth }); // patch the new one
      return;
    }
  });

  /* ── drag-and-drop patching: grab a clock jack, drop it on a knob ──────────── */
  app.addEventListener("dragstart", function (e) {
    var j = e.target.closest ? e.target.closest("[data-src]") : null;
    if (!j || !e.dataTransfer) return;
    e.dataTransfer.setData("text/plain", j.getAttribute("data-src"));
    e.dataTransfer.effectAllowed = "copy";
    j.classList.add("dragging");
  });
  app.addEventListener("dragend", function (e) {
    var j = e.target.closest ? e.target.closest("[data-src]") : null; if (j) j.classList.remove("dragging");
    app.querySelectorAll(".knob.dropok").forEach(function (el) { el.classList.remove("dropok"); });
  });
  app.addEventListener("dragover", function (e) {
    var d = e.target.closest ? e.target.closest("[data-drop]") : null;
    if (!d) return;
    e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    d.classList.add("dropok");
  });
  app.addEventListener("dragleave", function (e) {
    var d = e.target.closest ? e.target.closest("[data-drop]") : null;
    if (d && !d.contains(e.relatedTarget)) d.classList.remove("dropok");
  });
  app.addEventListener("drop", function (e) {
    var d = e.target.closest ? e.target.closest("[data-drop]") : null;
    if (!d) return;
    e.preventDefault(); d.classList.remove("dropok");
    var src = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
    if (!src) return;
    var key = d.getAttribute("data-drop");
    // keep an existing depth if the knob is already driven, else a sensible default
    var cur = (state.mods || []).filter(function (m) { return m.key === key; })[0];
    quietUntil = Date.now() + 400;
    cmd({ cmd: "patch", key: key, src: src, depth: cur ? cur.depth : 0.3 });
  });

  app.addEventListener("input", function (e) {
    var t = e.target;
    // patch-bay depth slider — retune the connection's depth live (no rebuild: depth is
    // not part of structKey, so the slider keeps its grip while you drag).
    if (t.classList && t.classList.contains("pdepth")) {
      var pkey = t.getAttribute("data-row");
      quietUntil = Date.now() + 700;
      var pdv = app.querySelector('.pdv[data-row="' + pkey + '"]');
      if (pdv) pdv.textContent = "±" + Math.round(+t.value * 100) + "%";
      var ss = app.querySelector('.psrc[data-row="' + pkey + '"]');
      cmd({ cmd: "patch", key: pkey, src: ss ? ss.value : "breath", depth: +t.value });
      return;
    }
    if (!t.hasAttribute || !t.hasAttribute("data-key")) return;
    quietUntil = Date.now() + 700;
    var em = app.querySelector('em[data-vk="' + t.getAttribute("data-key") + '"]');
    if (em) em.textContent = (+t.value).toFixed(3);
    cmd({ cmd: "setConfig", key: t.getAttribute("data-key"), value: +t.value });
  });
})();
