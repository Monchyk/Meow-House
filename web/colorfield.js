/* colorfield.js — the colour-commanding floorplan (NOT web/field/, which is the spatial
 * field-room system; this drives the C# FieldProjectionLayer over /api/effects/field).
 *
 * K., 2026-09-04: "I want my hue lights projected onto the visuals... a red spiral with a
 * blue and a green light pointed on it makes for a really cool shadow effect. I want a
 * whole roster of these." (docs/COLORED-SHADOWS.md)
 *
 * This is the driver for the C# FieldProjectionLayer: drop COLOURED POINTS onto the room,
 * each lamp takes the additive blend of the points that reach it. Two opponent points
 * (red left, cyan right) = the colored-shadow rig; a person between them and the wall
 * casts a coloured shadow. Presets drop a starting roster; you tune from there.
 *
 * WHY ITS OWN PAGE (same reasoning as lights.js): the dashboard rebuilds its DOM behind a
 * guard that eats canvas clicks; a pointer-drag surface wants its own quiet page.
 *
 * The top half is PURE and node-tested (tools/party-tests/field-map.test.js). Crucially it
 * MIRRORS the C# FieldProjectionLayer.Update blend — if the two drift, the map lies about
 * what the room will do. The mirror maths is pinned by that test against hand-computed
 * values; if it fails after a layer change, THIS is what needs updating, not the test.
 */
(function () {
  "use strict";

  /* ── pure core ─────────────────────────────────────────────────────────── */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothStep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  // Top-down plan, identical framing to lights.js so the two maps read the same room:
  // x left→right, y=+1 drawn at the TOP (the screen wall).
  function roomToCanvas(x, y, w, h, pad) {
    pad = pad || 0;
    return { cx: pad + (x + 1) / 2 * (w - 2 * pad), cy: pad + (1 - y) / 2 * (h - 2 * pad) };
  }
  function canvasToRoom(cx, cy, w, h, pad) {
    pad = pad || 0;
    var x = (cx - pad) / (w - 2 * pad) * 2 - 1;
    var y = 1 - (cy - pad) / (h - 2 * pad) * 2;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  function hexToRgb(h) {
    h = String(h).replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(c) {
    function b(v) { v = Math.round(clamp(v, 0, 255)); return (v < 16 ? "0" : "") + v.toString(16); }
    return (b(c.r) + b(c.g) + b(c.b)).toUpperCase();
  }
  function dist2d(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  // ── THE MIRROR of FieldProjectionLayer.Weight (C#) ──────────────────────────
  // 1 inside the flat core radius·(1−falloff), smoothstepping to 0 at the radius.
  function weight(d, radius, falloff) {
    if (radius <= 1e-6) return 0;
    if (d >= radius) return 0;                    // radius boundary first: with falloff 0,
    var inner = radius * (1 - clamp01(falloff));  // inner == radius, so this must win the tie
    if (d <= inner) return 1;
    return smoothStep((radius - d) / (radius - inner));
  }

  // ── THE MIRROR of FieldProjectionLayer.Update blend (C#) ────────────────────
  // Additive light in linear RGB (0..1), then split into a normalised hue + a brightness
  // magnitude — exactly what the layer sends the bulb. Returns null when no point reaches
  // this lamp (it falls through to the ambient in the room, and is drawn un-lit here).
  // Point colours are hex strings; master is the global 0..1 multiplier.
  function blendLampColor(lampX, lampY, points, master) {
    if (master == null) master = 1;
    var sumR = 0, sumG = 0, sumB = 0, totalW = 0;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var w = weight(dist2d(lampX, lampY, p.x, p.y), p.radius, p.falloff);
      if (w <= 0) continue;
      var wgt = w * clamp01(p.intensity == null ? 1 : p.intensity);
      var c = hexToRgb(p.color);
      sumR += wgt * (c.r / 255); sumG += wgt * (c.g / 255); sumB += wgt * (c.b / 255);
      totalW += wgt;
    }
    if (totalW < 1e-4) return null;                 // unreached → ambient shows through
    var m = Math.max(sumR, Math.max(sumG, sumB));
    var col = m > 1e-6 ? { r: sumR / m, g: sumG / m, b: sumB / m } : { r: 0, g: 0, b: 0 };
    return { r: col.r, g: col.g, b: col.b, bri: clamp01(m) * clamp01(master) };  // r,g,b + bri all 0..1
  }

  // What that predicted lamp looks like on the map: the normalised colour scaled by its
  // brightness (a dim lamp reads dim), as 0..255 for a fillStyle.
  function displayRgb(pred) {
    if (!pred) return null;
    return { r: Math.round(pred.r * pred.bri * 255), g: Math.round(pred.g * pred.bri * 255), b: Math.round(pred.b * pred.bri * 255) };
  }

  // A point: {x,y in [-1,1], color hex, radius, falloff, intensity}.
  function makePoint(x, y, color, radius, falloff, intensity) {
    return {
      x: clamp(x, -1, 1), y: clamp(y, -1, 1), color: color || "FFFFFF",
      radius: radius == null ? 0.7 : radius, falloff: falloff == null ? 0.6 : falloff,
      intensity: intensity == null ? 1 : intensity
    };
  }

  // ── PRESETS: the roster from docs/COLORED-SHADOWS.md as starting point-sets ──
  // Opponent split (1.3): two opponent hues left/right — the cheapest coloured shadow.
  // CMY fan (1.1, the Eliasson baseline): three points summing toward white across the room.
  // Complement reveal (1.2): one saturated complement fill; project its complement, cast a shadow.
  var PRESETS = {
    opponent: {
      name: "Opponent split", hint: "Two opponent hues, left & right. Cheapest coloured shadow (roster 1.3).",
      points: function () { return [makePoint(-0.6, 0.1, "FF2D2D", 0.8, 0.7, 1), makePoint(0.6, 0.1, "00E5E5", 0.8, 0.7, 1)]; }
    },
    cmy: {
      name: "CMY fan", hint: "Three lights summing to ~white — the Eliasson fan (roster 1.1). Start here.",
      points: function () {
        return [makePoint(-0.7, 0.0, "FF2D2D", 0.9, 0.7, 1), makePoint(0.0, 0.5, "28C76F", 0.9, 0.7, 1), makePoint(0.7, 0.0, "2D7DFF", 0.9, 0.7, 1)];
      }
    },
    reveal: {
      name: "Complement reveal", hint: "One cyan fill — project a RED spiral, cast a shadow, the spiral blazes inside it (roster 1.2).",
      points: function () { return [makePoint(0.0, 0.1, "00E5E5", 1.4, 0.8, 0.9)]; }
    },
    warm: {
      name: "Warm/cool split", hint: "Filmic orange & teal — the cinema grade (roster 1.3 variant).",
      points: function () { return [makePoint(-0.6, 0.1, "FF7A1A", 0.8, 0.7, 1), makePoint(0.6, 0.1, "1AC7C7", 0.8, 0.7, 1)]; }
    }
  };

  // Body sent to POST /api/effects/field. Rounded so a drag doesn't spam full-precision noise.
  function buildFieldBody(points, master) {
    function r3(v) { return Math.round(v * 1000) / 1000; }
    return {
      intensity: r3(clamp01(master == null ? 1 : master)),
      points: points.map(function (p) {
        return { x: r3(p.x), y: r3(p.y), color: p.color, radius: r3(p.radius), falloff: r3(p.falloff), intensity: r3(p.intensity) };
      })
    };
  }

  var CORE = {
    clamp: clamp, clamp01: clamp01, smoothStep: smoothStep,
    roomToCanvas: roomToCanvas, canvasToRoom: canvasToRoom,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, dist2d: dist2d,
    weight: weight, blendLampColor: blendLampColor, displayRgb: displayRgb,
    makePoint: makePoint, buildFieldBody: buildFieldBody, PRESETS: PRESETS
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = CORE; return; }

  /* ── browser ───────────────────────────────────────────────────────────── */

  var $ = function (id) { return document.getElementById(id); };
  var PAD = 26;
  var state = {
    lights: [], status: null, room: [520, 430, 240],
    points: [], master: 1, sel: -1, applied: null, pushTimer: 0
  };

  function api(path, opts) {
    return fetch(path, opts || {}).then(function (r) {
      if (!r.ok) throw new Error(path + " -> " + r.status);
      return r.text().then(function (t) { var s = String(t).trim(); return s ? JSON.parse(s) : null; });
    });
  }

  function refresh() {
    return api("/api/lights").then(function (res) {
      if (res) {
        state.lights = res.lights || [];
        state.room = res.roomDimensions || state.room;
      }
      return api("/api/status").catch(function () { return null; });
    }).then(function (st) { state.status = st; render(); }).catch(function () { render(); });
  }

  // Debounced push: a drag fires many moves, but the room only needs the latest.
  function pushField() {
    if (state.pushTimer) clearTimeout(state.pushTimer);
    state.pushTimer = setTimeout(function () {
      state.pushTimer = 0;
      var body = buildFieldBody(state.points, state.master);
      api("/api/effects/field", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      }).then(function (res) {
        state.applied = res && res.applied;
        say(res && res.applied ? state.points.length + " points live on the lamps"
          : "sent — but nothing is rendering yet. Start an ambient (party) first, then re-apply.");
      }).catch(function (e) { say("push failed: " + e.message); });
    }, 120);
  }

  function say(t) { var s = $("say"); if (s) s.textContent = t; }

  /* ── render ──────────────────────────────────────────────────────────────── */

  function render() { renderBanner(); renderPresets(); renderInspector(); draw(); }

  function renderBanner() {
    var b = $("banner"), s = state.status;
    if (s && s.connected && s.streaming < s.lights) {
      b.style.display = "block"; b.className = "banner warn";
      b.textContent = (s.lights - s.streaming) + " of " + s.lights + " lamps are not in the entertainment area — " +
        "they receive no colour and won't join the field. Add them in the Hue app + reconnect.";
    } else if (s && !s.connected) {
      b.style.display = "block"; b.className = "banner bad";
      b.textContent = "The Hue app isn't streaming — nothing here reaches a lamp. Start it + reconnect.";
    } else if (state.applied === false) {
      b.style.display = "block"; b.className = "banner warn";
      b.textContent = "Points are set but no ambient is running to attach to. Open the party (an ambient), then re-apply.";
    } else { b.style.display = "none"; }
  }

  function renderPresets() {
    var box = $("presets"); if (!box) return; box.innerHTML = "";
    Object.keys(PRESETS).forEach(function (k) {
      var pr = PRESETS[k];
      var btn = document.createElement("button");
      btn.textContent = pr.name; btn.title = pr.hint;
      btn.onclick = function () {
        state.points = pr.points(); state.sel = state.points.length ? 0 : -1;
        say(pr.hint); render(); pushField();
      };
      box.appendChild(btn);
    });
  }

  function renderInspector() {
    var box = $("inspector"); if (!box) return; box.innerHTML = "";
    // Master intensity.
    box.appendChild(labeledRange("master", "Master intensity", 0, 1, 0.05, state.master, function (v) {
      state.master = v; draw(); pushField();
    }));

    if (state.sel < 0 || state.sel >= state.points.length) {
      box.appendChild(el("p", "small", "Tap the map to add a coloured point, or pick a preset above. Tap a point to select it."));
      return;
    }
    var p = state.points[state.sel];
    box.appendChild(el("p", "lampname", "Point " + (state.sel + 1) + " of " + state.points.length));

    var color = document.createElement("input");
    color.type = "color"; color.value = "#" + p.color;
    color.oninput = function () { p.color = color.value.replace("#", "").toUpperCase(); draw(); pushField(); };
    box.appendChild(labeled("Colour", color));

    box.appendChild(labeledRange("radius", "Radius (reach)", 0.1, 2.5, 0.05, p.radius, function (v) { p.radius = v; draw(); pushField(); }));
    box.appendChild(labeledRange("falloff", "Falloff (edge softness)", 0, 1, 0.05, p.falloff, function (v) { p.falloff = v; draw(); pushField(); }));
    box.appendChild(labeledRange("intensity", "Intensity", 0, 1, 0.05, p.intensity, function (v) { p.intensity = v; draw(); pushField(); }));

    var del = document.createElement("button");
    del.className = "ghost"; del.textContent = "remove this point";
    del.onclick = function () {
      state.points.splice(state.sel, 1); state.sel = state.points.length ? 0 : -1; render(); pushField();
    };
    box.appendChild(del);
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function labeled(name, control) {
    var row = el("label", "row"); row.appendChild(el("span", "lab", name)); row.appendChild(control); return row;
  }
  function labeledRange(id, name, min, max, step, val, onInput) {
    var row = el("label", "row");
    row.appendChild(el("span", "lab", name));
    var r = document.createElement("input");
    r.type = "range"; r.min = min; r.max = max; r.step = step; r.value = val;
    var out = el("span", "val", (+val).toFixed(2));
    r.oninput = function () { out.textContent = (+r.value).toFixed(2); onInput(+r.value); };
    row.appendChild(r); row.appendChild(out); return row;
  }

  /* ── the floorplan ───────────────────────────────────────────────────────── */

  function mappedLamps() {
    return state.lights.filter(function (l) {
      return l.positioned !== false && l.x != null && !(Math.abs(l.x) < 1e-6 && Math.abs(l.y) < 1e-6);
    });
  }

  function draw() {
    var cv = $("plan"); if (!cv) return;
    var w = cv.width = cv.clientWidth, h = cv.height = Math.round(cv.clientWidth * 0.72);
    var g = cv.getContext("2d");
    g.clearRect(0, 0, w, h);

    g.strokeStyle = "rgba(150,170,220,0.28)"; g.lineWidth = 1;
    g.strokeRect(PAD, PAD, w - 2 * PAD, h - 2 * PAD);
    g.fillStyle = "rgba(90,170,220,0.5)"; g.fillRect(PAD, PAD - 6, w - 2 * PAD, 4);
    g.fillStyle = "#8b9ac0"; g.font = "11px ui-monospace, monospace";
    g.fillText("SCREEN / TV", PAD, PAD - 11);

    // Point influence rings, drawn under the lamps so the dots sit on top.
    state.points.forEach(function (p, i) {
      var c = roomToCanvas(p.x, p.y, w, h, PAD);
      var rgb = hexToRgb(p.color);
      var rPix = p.radius / 2 * (w - 2 * PAD); // radius is in room half-extents (0..1 ≈ half the plan)
      var grd = g.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, Math.max(4, rPix));
      grd.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + (0.10 + 0.25 * clamp01(p.intensity)).toFixed(3) + ")");
      grd.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
      g.fillStyle = grd; g.beginPath(); g.arc(c.cx, c.cy, Math.max(4, rPix), 0, Math.PI * 2); g.fill();
    });

    // Lamp dots, coloured by the PREDICTED blend — the whole point: you see the rig without
    // needing the room. A lamp no point reaches is drawn hollow (it stays on the ambient).
    mappedLamps().forEach(function (l) {
      var pt = roomToCanvas(l.x, l.y, w, h, PAD);
      var pred = blendLampColor(l.x, l.y, state.points, state.master);
      var disp = displayRgb(pred);
      g.beginPath(); g.arc(pt.cx, pt.cy, 9, 0, Math.PI * 2);
      if (disp) { g.fillStyle = "rgb(" + disp.r + "," + disp.g + "," + disp.b + ")"; g.fill();
        g.strokeStyle = "rgba(220,230,251,0.5)"; g.lineWidth = 1; g.stroke(); }
      else { g.strokeStyle = "rgba(150,170,220,0.55)"; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = "#dce6fb"; g.font = "11px ui-sans-serif, system-ui";
      g.fillText(l.name || "", pt.cx + 13, pt.cy + 4);
    });

    // Point handles on top: a filled swatch of the point's own colour, ringed when selected.
    state.points.forEach(function (p, i) {
      var c = roomToCanvas(p.x, p.y, w, h, PAD);
      var rgb = hexToRgb(p.color);
      g.beginPath(); g.arc(c.cx, c.cy, i === state.sel ? 11 : 8, 0, Math.PI * 2);
      g.fillStyle = "rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")"; g.fill();
      g.strokeStyle = i === state.sel ? "#fff" : "rgba(0,0,0,0.5)"; g.lineWidth = i === state.sel ? 2.5 : 1.5; g.stroke();
    });

    if (!mappedLamps().length) {
      g.fillStyle = "#ffd890"; g.font = "12px ui-sans-serif, system-ui";
      g.fillText("No positioned lamps — place them first on the lights page.", PAD + 6, h / 2);
    }
  }

  function hitPoint(mx, my, w, h) {
    var best = -1, bestD = 16 * 16;
    state.points.forEach(function (p, i) {
      var c = roomToCanvas(p.x, p.y, w, h, PAD);
      var d = (c.cx - mx) * (c.cx - mx) + (c.cy - my) * (c.cy - my);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function wirePlan() {
    var cv = $("plan"); if (!cv) return;
    var dragging = -1;
    function pos(ev) { var r = cv.getBoundingClientRect(); var t = ev.touches ? ev.touches[0] : ev; return { x: t.clientX - r.left, y: t.clientY - r.top }; }

    cv.addEventListener("pointerdown", function (ev) {
      var p = pos(ev);
      var hit = hitPoint(p.x, p.y, cv.width, cv.height);
      if (hit >= 0) { state.sel = hit; dragging = hit; cv.setPointerCapture(ev.pointerId); render(); return; }
      // Empty space → add a new point there, inheriting the selected point's colour if any.
      var r0 = canvasToRoom(p.x, p.y, cv.width, cv.height, PAD);
      var seedColor = (state.sel >= 0 && state.points[state.sel]) ? state.points[state.sel].color : "FF2D2D";
      state.points.push(makePoint(r0.x, r0.y, seedColor));
      state.sel = state.points.length - 1; dragging = state.sel; cv.setPointerCapture(ev.pointerId);
      render(); pushField();
    });
    cv.addEventListener("pointermove", function (ev) {
      if (dragging < 0) return;
      var p = pos(ev), r = canvasToRoom(p.x, p.y, cv.width, cv.height, PAD);
      state.points[dragging].x = r.x; state.points[dragging].y = r.y; draw();
    });
    cv.addEventListener("pointerup", function () { if (dragging >= 0) { dragging = -1; pushField(); } });
  }

  /* ── presets: save/load named point-sets in localStorage (v1) ─────────────── */

  var LS_KEY = "dh-field-presets";
  function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; } }
  function saveSaved(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }

  function renderSaved() {
    var box = $("saved"); if (!box) return; box.innerHTML = "";
    var all = loadSaved(); var names = Object.keys(all);
    if (!names.length) { box.appendChild(el("span", "small", "no saved rigs yet")); return; }
    names.forEach(function (n) {
      var wrap = el("span", "chip");
      var load = el("button", null, n);
      load.onclick = function () { state.points = all[n].points.map(function (p) { return Object.assign({}, p); }); state.master = all[n].master == null ? 1 : all[n].master; state.sel = state.points.length ? 0 : -1; render(); pushField(); say("loaded '" + n + "'"); };
      var del = el("button", "ghost", "✕"); del.title = "delete " + n;
      del.onclick = function () { var a = loadSaved(); delete a[n]; saveSaved(a); renderSaved(); };
      wrap.appendChild(load); wrap.appendChild(del); box.appendChild(wrap);
    });
  }

  function boot() {
    wirePlan();
    $("clear").onclick = function () { state.points = []; state.sel = -1; render(); pushField(); };
    $("save").onclick = function () {
      var name = ($("saveName").value || "").trim(); if (!name) { say("name it first"); return; }
      var all = loadSaved(); all[name] = { points: state.points.map(function (p) { return Object.assign({}, p); }), master: state.master };
      saveSaved(all); renderSaved(); say("saved '" + name + "'");
    };
    $("refresh").onclick = refresh;
    renderSaved();
    refresh();
    setInterval(function () { api("/api/status").then(function (s) { state.status = s; renderBanner(); }).catch(function () {}); }, 5000);
    window.addEventListener("resize", draw);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
