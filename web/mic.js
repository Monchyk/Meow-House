/* mic.js — the mic desk (thin client for mic-sync.js on the display machine).
 *
 * Mirrors the dashboard's shape: it never captures audio itself. It subscribes to
 * serve.py's /party relay, reads {type:"mic"} telemetry published ~20 Hz by mic-sync,
 * paints a live scope, and sends {type:"miccmd"} to arm/disarm and tune every
 * parameter. The display machine's mic-sync is the single source of truth.
 */
(function () {
  "use strict";
  var conn = document.getElementById("conn");
  var armBtn = document.getElementById("arm");
  var stateEl = document.getElementById("state");
  var beatDot = document.getElementById("beat");
  var controls = document.getElementById("controls");
  var scope = document.getElementById("scope");
  var g = scope.getContext("2d");

  // error banner, inserted under the arm row
  var errEl = document.createElement("div");
  errEl.className = "small";
  errEl.style.cssText = "display:none;margin-top:8px;color:#ffb0a0;line-height:1.4;";
  armBtn.closest("section").appendChild(errEl);

  var tel = null;          // latest telemetry
  var lastParamKey = "";   // rebuild faders only when the param set changes
  var dragging = false;    // don't rebuild mid-drag

  // Smoothed view values so a 20 Hz feed animates cleanly at 60 fps.
  var sLevel = 0, sBiz = 0, sBands = [0, 0, 0], peak = 0, peakAt = 0, sBeat = 0;

  function send(o) {
    o.type = "miccmd"; o.from = "micdesk";
    try { fetch("/party/pub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }); } catch (e) {}
  }

  /* ── relay: subscribe, with the dashboard's explicit-retry discipline ─────── */
  function connect(delay) {
    var es = new EventSource("/party/sub");
    es.onopen = function () { conn.textContent = "● live"; conn.className = "on"; delay = 1000; send({ cmd: "hello" }); };
    es.onerror = function () {
      conn.textContent = "○ reconnecting…"; conn.className = "off";
      try { es.close(); } catch (e) {}
      setTimeout(function () { connect(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
    };
    es.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (!m || m.type !== "mic") return;
      tel = m;
      armBtn.textContent = m.armed ? "disarm mic" : (m.starting ? "starting…" : "arm mic");
      armBtn.className = m.armed ? "on" : "";
      stateEl.textContent = m.armed ? "● live" : (m.starting ? "starting…" : "idle");
      stateEl.className = "state " + (m.armed ? "live" : "idle");
      errEl.textContent = m.error || "";
      errEl.style.display = m.error ? "block" : "none";
      // Rebuild the desk when the device list, selection, or param set changes.
      var key = (m.params ? Object.keys(m.params).join(",") : "") + "|" +
                (m.devices || []).map(function (d) { return d.id; }).join(",") + "|" + (m.deviceId || "");
      if (key !== lastParamKey && !dragging) { renderControls(m); lastParamKey = key; }
    };
  }
  connect(1000);
  send({ cmd: "hello" });

  armBtn.addEventListener("click", function () {
    var live = tel && tel.armed;
    send({ cmd: live ? "disarm" : "arm" });
  });

  /* ── the faders ──────────────────────────────────────────────────────────── */
  var SPEC = [
    { k: "gain",     t: "sensitivity", min: 0.1, max: 10, st: 0.1,  h: "input multiplier — how hard the room drives the envelope" },
    { k: "depth",    t: "ripple depth", min: 0,  max: 1,  st: 0.01, h: "how far business swings above its resting floor" },
    { k: "floor",    t: "floor",       min: 0,   max: 1,  st: 0.01, h: "resting business level between hits" },
    { k: "attack",   t: "attack",      min: 0.05, max: 1, st: 0.01, h: "how fast the meter rises toward a louder sample" },
    { k: "release",  t: "release",     min: 0.01, max: 0.5, st: 0.01, h: "how slowly it falls back — the pump lives here" },
    { k: "beatSens", t: "beat sens",   min: 0.05, max: 1.5, st: 0.05, h: "how far the bass must jump over its baseline to count as a beat" },
    { k: "beatPunch", t: "beat punch", min: 0,   max: 1,  st: 0.01, h: "how hard a detected beat kicks business" }
  ];

  function renderControls(m) {
    var params = m && m.params;
    if (!params) { controls.innerHTML = '<p class="wait">arm the mic to tune it</p>'; return; }
    var h = "";
    // device picker — labels only appear once the mic has been granted once, so before
    // the first arm this may be a single unnamed default.
    var devs = m.devices || [];
    h += '<div class="tune"><span>microphone</span>' +
      '<select id="dev" style="flex:1;min-width:140px;min-height:40px;background:#1c2740;color:var(--fg);border:1px solid var(--line);border-radius:8px;">' +
      '<option value=""' + (!m.deviceId ? " selected" : "") + '>system default</option>' +
      devs.map(function (d) {
        var sel = (d.id === m.deviceId) ? " selected" : "";
        return '<option value="' + d.id.replace(/"/g, "") + '"' + sel + '>' +
          String(d.label).replace(/[<>]/g, "") + '</option>';
      }).join("") +
      '</select><button id="rescan" style="flex:0 0 auto;min-height:40px;">rescan</button>' +
      '<i class="help">which input to listen on. Arm once to reveal device names; rescan after plugging one in.</i></div>';
    // drive-source segmented toggle
    h += '<div class="tune"><span>drive from</span><div class="seg">' +
      '<button data-src="full" class="' + (params.source === "full" ? "sel" : "") + '">full spectrum</button>' +
      '<button data-src="bass" class="' + (params.source === "bass" ? "sel" : "") + '">bass only</button>' +
      '</div><i class="help">what feeds the envelope — the whole mix, or the low end for a kick-led pump</i></div>';
    SPEC.forEach(function (s) {
      var v = params[s.k]; if (v == null) return;
      h += '<label class="tune"><span>' + s.t + '</span>' +
        '<input type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.st + '" value="' + v + '" data-key="' + s.k + '">' +
        '<em data-val="' + s.k + '">' + (+v).toFixed(2) + '</em>' +
        '<i class="help">' + s.h + '</i></label>';
    });
    controls.innerHTML = h;
  }

  controls.addEventListener("pointerdown", function () { dragging = true; });
  window.addEventListener("pointerup", function () { dragging = false; });
  window.addEventListener("pointercancel", function () { dragging = false; });

  controls.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-src]") : null;
    if (!b) return;
    send({ cmd: "set", key: "source", value: b.getAttribute("data-src") });
  });
  controls.addEventListener("change", function (e) {
    if (e.target && e.target.id === "dev") send({ cmd: "device", value: e.target.value });
  });
  controls.addEventListener("click", function (e) {
    if (e.target && e.target.id === "rescan") send({ cmd: "enumerate" });
  });
  controls.addEventListener("input", function (e) {
    var t = e.target;
    if (!t.hasAttribute || !t.hasAttribute("data-key")) return;
    var k = t.getAttribute("data-key");
    var val = controls.querySelector('[data-val="' + k + '"]');
    if (val) val.textContent = (+t.value).toFixed(2);
    send({ cmd: "set", key: k, value: +t.value });
  });

  /* ── the scope ───────────────────────────────────────────────────────────── */
  var BAND_COLS = ["#ff7a9c", "#7fe0a0", "#8fb8ff"];   // bass / mid / high
  function draw() {
    var w = scope.width, hgt = scope.height;
    // ease view values toward the latest telemetry
    if (tel) {
      sLevel += ((tel.level || 0) - sLevel) * 0.35;
      sBiz   += ((tel.business || 0) - sBiz) * 0.35;
      sBeat   = Math.max(sBeat * 0.8, tel.beat || 0);
      for (var i = 0; i < 3; i++) sBands[i] += (((tel.bands || [])[i] || 0) - sBands[i]) * 0.4;
    }
    var now = performance.now();
    if (sLevel >= peak) { peak = sLevel; peakAt = now; }
    else if (now - peakAt > 700) peak += (sLevel - peak) * 0.08;   // peak-hold, then bleed down

    g.clearRect(0, 0, w, hgt);

    // envelope bar (green) with peak-hold marker
    var padL = 8, barW = w * 0.52 - padL, x0 = padL;
    g.fillStyle = "#0e1424"; g.fillRect(x0, 8, barW, hgt - 16);
    var lv = Math.min(1, sLevel);
    var grd = g.createLinearGradient(x0, 0, x0 + barW, 0);
    grd.addColorStop(0, "#2a6"); grd.addColorStop(0.7, "#6cf"); grd.addColorStop(1, "#ff5a7a");
    g.fillStyle = grd; g.fillRect(x0, 8, barW * lv, hgt - 16);
    g.fillStyle = "#fff"; g.fillRect(x0 + barW * Math.min(1, peak) - 2, 8, 2, hgt - 16);
    // business marker (thin line where mic sets the room)
    g.fillStyle = "rgba(255,216,144,0.9)";
    g.fillRect(x0 + barW * Math.min(1, sBiz) - 1, 4, 2, hgt - 8);

    // three band columns on the right
    var bx = w * 0.58, bw = (w - bx - 8) / 3 - 6;
    for (var j = 0; j < 3; j++) {
      var cx = bx + j * (bw + 6);
      g.fillStyle = "#0e1424"; g.fillRect(cx, 8, bw, hgt - 16);
      var bh = (hgt - 16) * Math.min(1, sBands[j]);
      g.fillStyle = BAND_COLS[j];
      g.fillRect(cx, 8 + (hgt - 16) - bh, bw, bh);
    }

    // beat dot + BPM
    beatDot.className = "beat" + (sBeat > 0.4 ? " hit" : "");
    var bpmEl = document.getElementById("bpm");
    if (bpmEl) bpmEl.textContent = (tel && tel.bpm) ? (Math.round(tel.bpm) + " BPM") : "— BPM";

    // numeric readouts
    setNum("nLevel", sLevel); setNum("nBiz", sBiz);
    setNum("nRms", tel ? tel.rms : 0);
    setNum("nBass", sBands[0]); setNum("nMid", sBands[1]); setNum("nHigh", sBands[2]);

    requestAnimationFrame(draw);
  }
  function setNum(id, v) { var el = document.getElementById(id); if (el) el.textContent = (v || 0).toFixed(2); }
  requestAnimationFrame(draw);
})();
