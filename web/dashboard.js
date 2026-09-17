/* dashboard.js — the party curator's control surface (thin client).
 *
 * Runs on any device on the same network (phone/laptop). It never runs the
 * engine — it mirrors state snapshots from /party.html and sends commands, both
 * relayed through serve.py's /party/sub (SSE) + /party/pub (POST). The master
 * (party-main.js) is the single source of truth; this just reflects + nudges it.
 */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var conn = document.getElementById("conn");
  var state = null, quietUntil = 0, lastKey = "", pressing = false;

  function send(o) { o.from = "dash"; try { fetch("/party/pub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }); } catch (e) {} }
  function cmd(o) { o.type = "cmd"; send(o); }

  // Explicit retry: EventSource gives up permanently after an HTTP error status
  // (e.g. a 404 from a stale serve.py), so we must reconnect ourselves.
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
      // Rebuild ONLY when the structure changes — a 4Hz innerHTML rebuild destroys
      // buttons between mousedown and mouseup, which silently eats every click.
      // NB: only mark the key consumed when we actually rebuild, else a blocked
      // render would leave the UI permanently stale.
      var key = structKey(state);
      // Consume the key only AFTER render() returns. The old order marked it consumed
      // first, so ANY throw inside render() wedged the dashboard permanently stale —
      // the symptom being "clicking a nucleus card doesn't move the sliders", which
      // makes building a preset on top of a card impossible. Now a failed render is
      // retried on the next snapshot and the error keeps surfacing instead of hiding.
      if (key !== lastKey && !pressing && Date.now() >= quietUntil) { render(); lastKey = key; }
      refresh();                                    // live numbers update in place
    };
  }
  connect(1000);
  send({ type: "hello" }); // also ask immediately in case SSE opens slowly

  /* ── render ────────────────────────────────────────────────────────────── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sw(hex) { return '<i class="sw" style="background:#' + esc(hex) + '"></i>'; }
  function swatches(pal) { return (pal || []).map(sw).join(""); }

  /* ── the tuning desk ───────────────────────────────────────────────────────
     Grouped and explained, because this is operated live in a dark room by someone
     who did not write it (and by K. months from now). The flat list of twelve was
     already hard to read in engine vocabulary — "swing range", "contrast floor" —
     and the nucleus adds nineteen more.

     RULE FOR `h`: describe the ROOM, not the maths. "how quickly it sinks back to
     rest", never "decayRate, per second". If a line can only be understood by first
     reading party.js, it is the wrong line.

     `Lo`/`Hi` pairs are the two ends of the σ swing — chaos and order — so each part
     of the bloom can be set independently at the scattered and the resolved end. */
  // The tuning-desk metadata now lives in the shared tune-meta.js so the synth
  // patchbay (synth.js) renders the same knobs from ONE source of truth. Loaded the
  // way party.js loads palettes.js: the browser sets window.TUNE via a <script> tag
  // (see dashboard.html), and a bare node test falls back to require(). No dash.test.js
  // change is needed — and that suite would red immediately if this ever returned nothing.
  var TUNE = (typeof window !== "undefined" && window.TUNE) ? window.TUNE
           : (typeof require !== "undefined") ? require("./tune-meta.js") : [];

  function plColumn(title, mode, list, cursor, lightsMeta) {
    var h = '<div class="col"><h3>' + title + ' <em>' + list.length + '</em></h3>';
    if (!list.length) h += '<p class="small">empty — add from the catalog</p>';
    list.forEach(function (id, i) {
      var pal = "";
      if (lightsMeta) { var m = lightsMeta.filter(function (x) { return x.id === id; })[0]; if (m) pal = swatches(m.palette); }
      h += '<div class="item' + (i === cursor ? " cur" : "") + '">' + pal + '<span class="nm">' + esc(id) + '</span>' +
        '<button data-cmd="reorder" data-mode="' + mode + '" data-from="' + i + '" data-to="' + (i - 1) + '"' + (i === 0 ? " disabled" : "") + '>▲</button>' +
        '<button data-cmd="reorder" data-mode="' + mode + '" data-from="' + i + '" data-to="' + (i + 1) + '"' + (i === list.length - 1 ? " disabled" : "") + '>▼</button>' +
        '<button data-cmd="removeFromPlaylist" data-mode="' + mode + '" data-index="' + i + '">✕</button></div>';
    });
    return h + "</div>";
  }

  function catList(mode, items, activeId) {
    return items.map(function (x) {
      var pal = x.palette ? swatches(x.palette) : "";
      var lock = x.u ? "" : ' <span class="lock">🔒</span>';
      // The veto toggle. An off entry stays listed and re-enableable — hiding it would
      // make "where did Mandelbrot go" a mystery — but greys out and loses show/add.
      var veto = '<button data-cmd="off" data-mode="' + mode + '" data-id="' + esc(x.id) + '">' +
                 (x.off ? "on" : "off") + '</button>';
      // Overlap veto — separate from `off`. Shown only for spirals, since only
      // exhibits layer. "⧉" = allowed to be layered, struck = never layered.
      var ovl = (mode === "spiral")
        ? '<button data-cmd="ovl" data-mode="spiral" data-id="' + esc(x.id) + '" title="' +
          (x.ovl === false ? "never layered" : "may be layered") + '">' +
          (x.ovl === false ? "⧄" : "⧉") + '</button>'
        : "";
      return '<div class="cat' + (x.id === activeId ? " active" : "") + (x.off ? " vetoed" : "") + '">' +
        pal + '<span class="nm">' + esc(x.id) + lock + '</span>' +
        (x.u && !x.off ? '<button data-cmd="setActive" data-mode="' + mode + '" data-id="' + esc(x.id) + '">show</button>' +
               '<button data-cmd="addToPlaylist" data-mode="' + mode + '" data-id="' + esc(x.id) + '">add</button>' : "") +
        veto + ovl + '</div>';
    }).join("");
  }

  // Says, in plain words, what the zoom row is doing RIGHT NOW. Read live in a dark
  // room by whoever is operating — so it names the current state, not the controls.
  // One function, used by both render() and refresh(), so the pinned figure stays
  // truthful while the fader is being dragged.
  function zoomHint(s) {
    var pin = s.zoomManual == null
      ? "pendulum drives the dive — drag to pin it"
      : "PINNED at ×" + (+s.zoomManual).toFixed(2) + " — “auto” gives it back";
    var when = "deepest " + (s.config.zoomInvert ? "in the chaos" : "at symmetry");
    if (!s.config.zoomOffscreen) {
      // in-frame: the picture breathes in scale, never crosses the edge. centre/uniform
      // and spread do nothing here, so the hint doesn't mention them.
      return pin + " · " + when + " · stays in frame (shrinks & fills, never past the edge)";
    }
    return pin + " · " + when
      + " · OFF-SCREEN, " + (s.config.zoomMode ? "whole frame swells" : "only the middle swells");
  }

  // Everything that changes the page's SHAPE. Volatile numbers deliberately excluded.
  function structKey(s) {
    return JSON.stringify([s.mode, s.spiralPlaylist, s.lightPlaylist, s.spiralCursor, s.lightCursor,
      s.activeSpiralId, s.activeLightId, s.zoomManual == null, s.auto,
      (s.mods || []).map(function (m) { return m.key + m.src; }),
      // Setting or clearing a dice leash swaps the row's controls, so it is SHAPE.
      s.diceLimits || {},
      s.buttonMap || {},           // remapping a button redraws its row's selection
      (s.presets || []).map(function (p) { return p.id; }),
      // `off` belongs in the SHAPE key: vetoing an entry swaps its buttons, so without
      // it the toggle would flip in the state and never redraw.
      s.spirals.map(function (x) { return x.id + (x.u ? "1" : "0") + (x.off ? "x" : "") + (x.ovl === false ? "n" : ""); }),
      s.lights.map(function (x) { return x.id + (x.u ? "1" : "0") + (x.off ? "x" : ""); }),
      s.config]);
  }

  // Live values patched in place — no DOM teardown, so clicks always land.
  function refresh() {
    if (!state) return;
    var m = app.querySelector(".meter i");
    if (m) m.style.width = Math.round(state.business * 100) + "%";
    var sm = app.querySelector(".live .small");
    if (sm) sm.textContent = "→ lamp energy " + state.effectiveEnergy.toFixed(2) + " · σ " + state.tune.toFixed(2) +
      " · zoom ×" + (state.zoom == null ? 1 : state.zoom).toFixed(2);
    if (Date.now() >= quietUntil) {
      var b = app.querySelector("input[data-biz]");
      if (b && document.activeElement !== b) b.value = state.business;
      // On auto, the slider tracks the pendulum so grabbing it starts from where the
      // dive already is. Pinned, it's the operator's value — leave it alone.
      var z = app.querySelector("input[data-zoom]");
      if (z && document.activeElement !== z && state.zoomManual == null && state.zoom != null) z.value = state.zoom;
    }
    // The pinned figure in the hint would otherwise sit stale until the next
    // structural rebuild — and dragging the fader is exactly when it's read.
    var zh = app.querySelector(".zoomhint");
    if (zh) zh.textContent = zoomHint(state);
  }

  function render() {
    if (Date.now() < quietUntil) return;              // don't fight a slider mid-drag
    if (!state) { app.innerHTML = '<p class="wait">waiting for the party… is /party.html open?</p>'; return; }
    var s = state, h = "";
    h += '<section class="live"><div class="row"><b>mode</b> <span class="pill ' + s.mode + '">' + s.mode + '</span>' +
      '<button data-cmd="mode">toggle</button></div>';
    // Attract mode: the room running itself. "skip" jumps to the next cycle without
    // waiting out the 25–45 s dwell — the only way to audition shapes at any speed.
    h += '<div class="row"><b>attract</b> <span class="pill ' + (s.auto ? "spiral" : "light") + '">' +
      (s.auto ? "auto · #" + s.autoStep : "manual") + '</span>' +
      '<button data-cmd="auto">' + (s.auto ? "stop" : "start") + '</button>' +
      '<button data-cmd="skip"' + (s.auto ? "" : " disabled") + '>skip ⇥</button></div>';
    // Overlap: two exhibits in one frame. The button cycles off -> transition ->
    // persistent, showing the state it is IN (same convention as the zoom row).
    var OVL = ["off", "transition", "persistent"];
    h += '<div class="row"><b>overlap</b> <span class="pill ' + (s.config.overlapMode ? "spiral" : "light") + '">' +
      OVL[s.config.overlapMode || 0] + '</span>' +
      '<button data-cmd="overlapMode">next</button></div>';
    // The dwell. Cycled like overlap rather than given a slider, because it is four
    // named states and not a continuum. Length lives on "pause at the end" in The spiral.
    var DWL = ["off", "at chaos", "at symmetry", "at both ends"];
    h += '<div class="row"><b>pause at</b> <span class="pill ' +
      ((s.config.dwellMode || 0) ? "spiral" : "light") + '">' +
      DWL[s.config.dwellMode || 0] + '</span>' +
      '<button data-cmd="dwellMode">next</button></div>';
    h += '<div class="small">' + esc(
      (s.config.dwellMode || 0) === 0
        ? "the swing runs straight through both ends without stopping"
        : "holds still for " + (s.config.dwellSeconds == null ? 4 : s.config.dwellSeconds) +
          "s on arriving, then re-enters motion — the dive freezes with it") + '</div>';
    h += '<div class="small">' + esc(
      (s.config.overlapMode || 0) === 0 ? "one exhibit at a time"
      : (s.config.overlapMode === 1 ? "the previous shape fades out behind the new one"
                                    : "the previous shape stays behind the new one")) + '</div>';
    h += '<div class="row biz"><b>business</b><input type="range" min="0" max="1" step="0.01" value="' + s.business + '" data-biz></div>';
    h += '<div class="meter"><i style="width:' + Math.round(s.business * 100) + '%"></i></div>';
    h += '<div class="small">→ lamp energy ' + s.effectiveEnergy.toFixed(2) + ' · σ ' + s.tune.toFixed(2) +
      ' · zoom ×' + (s.zoom == null ? 1 : s.zoom).toFixed(2) + '</div>';
    /* ── zoom row ────────────────────────────────────────────────────────────
       Four controls, and the hint line under them says in plain words what each
       one is currently doing — this dashboard is operated live, in a dark room,
       by someone who did not write it (and by K. months from now).

         fader     pins the zoom by hand (sending `zoom` with a value)
         auto      releases it back to the pendulum (`zoom` with no value);
                   disabled while already on auto, so the state is readable
         resolve/  which end of the σ swing the deepest dive lands on —
          dissolve resolve = deepest as the pattern RESOLVES into symmetry,
                   dissolve = deepest in the chaos, surfacing into order
         centre/   HOW the zoom is applied: centre magnifies the middle and
          uniform  leaves the frame edge alone (the default — a uniform scale
                   read as harsh); uniform scales the whole frame, the original.

       Each button shows the state it is IN, not the state it would switch to. */
    h += '<div class="row zoom"><b>zoom</b><input type="range" min="1" max="6" step="0.05" value="' +
      (s.zoomManual == null ? (s.zoom == null ? 1 : s.zoom) : s.zoomManual) + '" data-zoom>' +
      '<button data-cmd="zoom"' + (s.zoomManual == null ? " disabled" : "") + '>auto</button>' +
      '<button data-cmd="zoomInvert">' + (s.config.zoomInvert ? "dissolve" : "resolve") + '</button>' +
      // the frame toggle. "in frame" (default) = the picture stays fully visible;
      // "off screen" = the dive may magnify past the edge, which re-enables centre/uniform.
      '<button data-cmd="zoomOffscreen">' + (s.config.zoomOffscreen ? "off screen" : "in frame") + '</button>' +
      // centre/uniform only bites off-screen; disabled (greyed) in-frame so it's clearly inert
      '<button data-cmd="zoomMode"' + (s.config.zoomOffscreen ? "" : " disabled") + '>' +
        (s.config.zoomMode ? "uniform" : "centre") + '</button></div>';
    h += '<div class="small zoomhint">' + esc(zoomHint(s)) + '</div>';
    h += '<div class="row"><button data-cmd="cycle">cycle ▸</button><button data-cmd="commit">commit ✓</button></div></section>';

    h += '<section class="cols">' +
      plColumn("Spirals", "spiral", s.spiralPlaylist, s.spiralCursor) +
      plColumn("Lights", "light", s.lightPlaylist, s.lightCursor, s.lights) + '</section>';

    h += '<section><h3>Spiral catalog</h3>' + catList("spiral", s.spirals, s.activeSpiralId) + '</section>';
    // Ambient light-scenes and colour cards are DIFFERENT things and get separate
    // sections. A card is a deliberate performance mode (a hue walk, a fire flicker),
    // not ambient wallpaper — mixing them into one list is what made the fast cards
    // feel like they had wandered into the calm rotation. Attract mode only ever runs
    // the ambient scenes; a card is something you switch to by hand.
    var ambient = s.lights.filter(function (x) { return !x.card; });
    var cards = s.lights.filter(function (x) { return x.card; });
    h += '<section><h3>Light catalog <em>ambient</em></h3>' + catList("light", ambient, s.activeLightId) + '</section>';
    if (cards.length) {
      h += '<section><h3>Colour modes <em>manual</em></h3>' +
        '<div class="small">deliberate colour behaviours — not part of the ambient rotation</div>' +
        catList("light", cards, s.activeLightId) + '</section>';
    }

    /* ── presets ───────────────────────────────────────────────────────────
       Above the tuning desk on purpose: this is the panel you use, and the thirty
       sliders below it are what you reach for only when none of these is right.
       Each carries its own explanation because the whole point is choosing one
       without reading the desk. */
    // An older master relays a snapshot with no `presets` at all — and would also
    // ignore `setConfigMany`. Hiding the panel in that case is a silent failure and
    // a dead randomise button: two mysteries with one cause. Say the cause instead.
    if (!s.presets) {
      h += '<section class="presets"><h3>Presets</h3><div class="small stale">' +
        'the master is running an older <code>party.js</code> — presets and “randomise all” ' +
        'will do nothing until <b>/party.html</b> is hard-reloaded (Ctrl+Shift+R). ' +
        'Reloading this page does not help; the master is the one that runs the engine.' +
        '</div></section>';
    } else if (s.presets.length) {
      // Three families, and the split is the explanation: THE ROOM is how the machine
      // behaves (how hard it can be driven, how fast it forgets), THE SPIRAL is what
      // the picture does, YOURS is whatever K. saved. A room preset and a look compose,
      // which only reads as obvious if they are not in one list.
      var FAM = [
        { g: "room",   t: "The room",   d: "how the installation behaves — driveability, memory, ceiling. Set once at the start of an evening." },
        { g: "spiral", t: "The spiral", d: "what the picture does. Each touches only its own handful of settings, so two can be stacked." },
        { g: "nucleus", t: "The nucleus", d: "SNAP POINTS. Unlike the others these set all nineteen bloom sliders at once, " +
                                            "spread far apart on purpose — press one to land somewhere legible, push it around from there, " +
                                            "then “save section” at the nucleus heading below keeps what you found." },
        { g: "saved",  t: "Yours",      d: "saved from this desk. A whole-desk save sets everything; a section save only touches its own settings." },
      ];
      h += '<section class="presets"><h3>Presets <em>set and forget</em></h3>';
      FAM.forEach(function (f) {
        var list = s.presets.filter(function (p) { return (p.g || "spiral") === f.g; });
        if (!list.length) return;
        h += '<h4>' + esc(f.t) + '</h4><div class="small">' + esc(f.d) + '</div>';
        list.forEach(function (p) {
          h += '<div class="preset' + (p.user ? " mine" : "") + '">' +
            '<button data-cmd="preset" data-id="' + esc(p.id) + '">' + esc(p.id) + '</button>' +
            '<i class="help">' + esc(p.why) + '</i>' +
            (p.user ? '<button data-cmd="deletePreset" data-id="' + esc(p.id) + '" title="forget this one">✕</button>' : "") +
            '</div>';
        });
      });
      h += '<div class="row"><button data-cmd="savePreset">save the desk as a preset…</button></div></section>';
    }

    // Grouped, each slider carrying its plain-language line. A knob whose key is
    // missing from the snapshot is skipped rather than rendered dead — an older
    // master relaying an older config shouldn't paint sliders that drive nothing.
    var group = null;
    /* ── the buttons ───────────────────────────────────────────────────────
       K.: "I want to be able to tweak some of its mapping at the party itself if I deem
       something better." Each row is one gesture on the physical remote; pick what it
       does. Takes effect on the very next press — no restart, no laptop. An older master
       relays no buttonMap at all, so the whole section stays hidden rather than showing
       dropdowns that would post into nothing. */
    if (s.buttonMap) {
      var GEST = [
        ["power.short", "power · tap"],
        ["power.long",  "power · hold"],
        ["up.press",    "▲ · hold"],
        ["up.short",    "▲ · tap"],
        ["down.press",  "▼ · hold"],
        ["down.short",  "▼ · tap"],
        ["hue.short",   "hue · tap"],
        ["hue.long",    "hue · hold"],
      ];
      var acts = s.buttonActions || ["none"];
      h += '<section class="buttons"><h3>The buttons <em>remap live</em></h3>';
      GEST.forEach(function (g) {
        var cur = s.buttonMap[g[0]] || "none";
        h += '<label class="tune"><span>' + esc(g[1]) + '</span><select data-gesture="' + g[0] + '">' +
          acts.map(function (a) {
            return '<option value="' + esc(a) + '"' + (a === cur ? " selected" : "") + '>' + esc(a) + '</option>';
          }).join("") + '</select></label>';
      });
      h += '<div class="small">tap = press and let go · hold = the long press. ' +
        '“driveUp/driveDown” are the hold-to-drive pair; anything else fires once. ' +
        'the remote sends the gesture, the room decides what it means</div></section>';
    }
    h += '<section class="tuning">';
    TUNE.forEach(function (t) {
      var v = s.config[t.k]; if (v == null) return;
      // Each section carries its own factory reset — "put the room back" should not
      // also throw away an hour of work on the nucleus.
      if (t.g !== group) {
        group = t.g;
        h += '<h3>' + esc(group) +
          ' <button class="grpreset" data-cmd="resetGroup" data-group="' + esc(group) + '" ' +
          'title="put this section back to its original values">↺ factory</button>' +
          '<button class="grpreset" data-cmd="saveGroup" data-group="' + esc(group) + '" ' +
          'title="keep this section as a preset of your own">save section</button></h3>';
      }
      // LFO patch: "~" cycles which running clock drives this setting. A patched
      // slider shows the source and a depth control instead of its help line — the
      // slider itself then reads the MODULATED value, which is why the base is kept
      // separately in the engine.
      var mod = (s.mods || []).filter(function (m) { return m.key === t.k; })[0];
      // Dice leash: "🎲" pins how far THIS slider may be re-rolled. Off by default, so
      // the page looks exactly as it did until a leash is set. When set, the row shows
      // two mini faders (floor/ceiling) in the same slot the patch depth control uses —
      // one borrowed idiom instead of a new one. Tap the 🎲 again to remove the leash.
      var lim = (s.diceLimits || {})[t.k];
      h += '<label class="tune' + (mod ? " modded" : "") + (lim ? " diced" : "") + '"><span>' + esc(t.t) + '</span>' +
        '<input type="range" min="' + t.min + '" max="' + t.max + '" step="' + t.st + '" value="' + v + '" data-key="' + t.k + '">' +
        '<em>' + (+v).toFixed(3) + '</em>' +
        '<button data-cmd="patchnext" data-modkey="' + t.k + '" title="patch to a clock">' +
          (mod ? "~" + mod.src : "~") + '</button>' +
        '<button data-cmd="dicetoggle" data-dicekey="' + t.k + '" ' +
          'title="' + (lim ? 'remove the dice leash' : 'limit how far the dice may move this') + '">' +
          (lim ? "🎲✓" : "🎲") + '</button>' +
        (lim
          ? '<i class="help">dice between ' +
            '<input type="range" class="depth" min="' + t.min + '" max="' + t.max + '" step="' + t.st +
            '" value="' + lim[0] + '" data-dicelo="' + t.k + '">' +
            '<input type="range" class="depth" min="' + t.min + '" max="' + t.max + '" step="' + t.st +
            '" value="' + lim[1] + '" data-dicehi="' + t.k + '"> ' +
            (+lim[0]).toFixed(3) + ' … ' + (+lim[1]).toFixed(3) + '</i>'
          : mod
          ? '<i class="help">depth <input type="range" class="depth" min="0.05" max="1" step="0.05" value="' +
            mod.depth + '" data-depth="' + t.k + '" data-src="' + mod.src + '"> ±' +
            Math.round(mod.depth * 100) + '% on the ' + esc(mod.src) + ' clock</i>'
          : '<i class="help">' + esc(t.h) + '</i>') +
        '</label>';
    });
    // Dice and undo, side by side on purpose: the roll is only worth taking if the
    // way back is one button away.
    h += '<div class="row"><button data-cmd="randomiseAll">randomise all 🎲</button>' +
      '<button data-cmd="resetConfig">reset to original</button>' +
      '<button data-cmd="unlockAll">unlock all</button></div>' +
      '<div class="small">the dice roll every slider on this page — reset puts them all back</div></section>';
    app.innerHTML = h;
  }

  /* ── input (event delegation) ────────────────────────────────────────────── */
  // No rebuild while a finger/mouse is down — that's the window where a rebuild
  // would destroy the button before its click fires. Released → rebuild immediately.
  app.addEventListener("pointerdown", function () { pressing = true; });
  window.addEventListener("pointerup", function () { pressing = false; });
  window.addEventListener("pointercancel", function () { pressing = false; });

  // The clocks a setting can be patched onto, in the order "~" cycles them.
  var MOD_SRCS = [null, "swing", "zoom", "business", "cycle", "breath"];

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-cmd]") : null;
    if (!b) return;
    // Dice leash on/off. A fresh leash opens as a narrow window around wherever the
    // slider is standing — the common case is "keep it near this", and starting at the
    // full range would mean dragging both ends in before it did anything useful.
    if (b.getAttribute("data-cmd") === "dicetoggle") {
      if (!state) return;
      var dk = b.getAttribute("data-dicekey");
      if ((state.diceLimits || {})[dk]) { cmd({ cmd: "diceClear", key: dk }); return; }
      var td = null;
      TUNE.forEach(function (x) { if (x.k === dk) td = x; });
      if (!td) return;
      var c0 = state.config[dk], pad = (td.max - td.min) * 0.1;
      cmd({ cmd: "diceLimit", key: dk,
            lo: Math.max(td.min, c0 - pad), hi: Math.min(td.max, c0 + pad) });
      return;
    }
    if (b.getAttribute("data-cmd") === "patchnext") {
      var key = b.getAttribute("data-modkey");
      var cur = (state && state.mods || []).filter(function (m) { return m.key === key; })[0];
      var i = MOD_SRCS.indexOf(cur ? cur.src : null);
      var next = MOD_SRCS[(i + 1) % MOD_SRCS.length];
      cmd({ cmd: "patch", key: key, src: next, depth: cur ? cur.depth : 0.3 });
      return;
    }
    // Per-section factory reset. The group→keys mapping lives here for the same reason
    // the dice do: TUNE is where a setting's section is written down.
    if (b.getAttribute("data-cmd") === "resetGroup") {
      var g = b.getAttribute("data-group");
      cmd({ cmd: "resetConfig", keys: TUNE.filter(function (t) { return t.g === g; }).map(function (t) { return t.k; }) });
      return;
    }
    if (b.getAttribute("data-cmd") === "saveGroup") {
      var sg = b.getAttribute("data-group");
      var sname = window.prompt("Name this " + sg.replace(/^The /, "") + " setting");
      if (sname && sname.trim()) cmd({ cmd: "savePreset", name: sname.trim(), group: sg,
        keys: TUNE.filter(function (t) { return t.g === sg; }).map(function (t) { return t.k; }) });
      return;
    }
    if (b.getAttribute("data-cmd") === "savePreset") {
      // prompt() blocks the mirror for as long as it is open; the master keeps
      // running, and the snapshot is taken there when the command lands, so the
      // saved look is the room at OK, not at the moment the button was pressed.
      var name = window.prompt("Name this look");
      if (name && name.trim()) cmd({ cmd: "savePreset", name: name.trim() });
      return;
    }
    // Randomise: thrown here, where the min/max/step of every slider is already
    // written down, and sent as ONE message — thirty setConfigs would arrive
    // interleaved with state pushes and repaint the page mid-roll.
    if (b.getAttribute("data-cmd") === "randomiseAll") {
      if (!state) return;
      // Same stale-master case as the presets panel: the command would post and land
      // on nothing. A button that posts into the void must say so.
      if (!state.presets) { b.textContent = "reload /party.html first"; return; }
      // `randomiseSpread` limits how far the dice may travel. At 1 this is the original
      // uniform roll across the whole min..max. Below 1 the window is that fraction of
      // the range centred on the CURRENT value and clamped to the ends — so a roll
      // varies the look on screen instead of replacing it, which is what makes building
      // a preset on top of a nucleus card possible.
      var sp = state.config.randomiseSpread;
      if (sp == null) sp = 1;                              // older master: full range
      var limits = state.diceLimits || {};
      var vals = {};
      TUNE.forEach(function (t) {
        var cur = state.config[t.k];
        if (cur == null) return;
        if (t.k === "randomiseSpread") return;             // the dice must not reroll their own leash
        var lo = t.min, hi = t.max;
        if (limits[t.k]) {
          // An explicit per-slider leash wins outright over the global reach: it is a
          // decision K. already made about this setting, and the dice do not get to
          // second-guess it.
          lo = Math.max(t.min, limits[t.k][0]);
          hi = Math.min(t.max, limits[t.k][1]);
        } else if (sp < 1) {
          var half = (t.max - t.min) * sp / 2;
          lo = Math.max(t.min, cur - half);
          hi = Math.min(t.max, cur + half);
        }
        var n = Math.max(0, Math.round((hi - lo) / t.st));
        var v = lo + Math.round(Math.random() * n) * t.st;
        vals[t.k] = Math.round(Math.min(hi, v) * 1e6) / 1e6;  // kill float dust from the step walk
      });
      cmd({ cmd: "setConfigMany", values: vals });
      return;
    }
    var o = { cmd: b.getAttribute("data-cmd") };
    ["mode", "id", "index", "from", "to"].forEach(function (k) {
      var v = b.getAttribute("data-" + k);
      if (v != null) o[k] = (k === "index" || k === "from" || k === "to") ? +v : v;
    });
    cmd(o);
  });
  // <select> fires "change", not "input" — and a dropdown has no drag to protect, so
  // it deliberately does NOT set quietUntil.
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute("data-gesture")) {
      cmd({ cmd: "buttonMap", gesture: t.getAttribute("data-gesture"), action: t.value });
    }
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    quietUntil = Date.now() + 700;                    // pause mirror while dragging
    if (t.hasAttribute("data-biz")) cmd({ cmd: "business", value: +t.value });
    else if (t.hasAttribute("data-zoom")) cmd({ cmd: "zoom", value: +t.value });
    // Depth is checked BEFORE data-key: a depth slider carries neither, but ordering
    // matters if one ever gains both.
    else if (t.hasAttribute("data-depth")) cmd({ cmd: "patch", key: t.getAttribute("data-depth"),
                                                 src: t.getAttribute("data-src"), depth: +t.value });
    // Both ends of a dice leash travel together in one message — the engine swaps them
    // if they are dragged past each other, so crossing the faders is harmless.
    else if (t.hasAttribute("data-dicelo") || t.hasAttribute("data-dicehi")) {
      var dkey = t.getAttribute("data-dicelo") || t.getAttribute("data-dicehi");
      var loEl = app.querySelector('input[data-dicelo="' + dkey + '"]');
      var hiEl = app.querySelector('input[data-dicehi="' + dkey + '"]');
      if (loEl && hiEl) cmd({ cmd: "diceLimit", key: dkey, lo: +loEl.value, hi: +hiEl.value });
    }
    else if (t.hasAttribute("data-key")) cmd({ cmd: "setConfig", key: t.getAttribute("data-key"), value: +t.value });
  });
})();
