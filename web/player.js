/* Scene player — the swapping host.
 *
 * party-main.js does `new window.AmbientDirector(canvas, opts)` exactly once and
 * then only ever calls director.draw(dt) / director.pop(a) and sets director.zoom /
 * director.substrate. So we install a SceneHost as AmbientDirector: it constructs
 * the selected scene's real director inside itself and forwards that tiny surface.
 * Swapping scenes = rebuild the inner director from another registered factory.
 * party-main.js can't tell the difference — no reload, no re-boot.
 *
 * Load order: scene-registry.js -> scene modules -> player.js -> party-main.js.
 */
(function (root) {
  "use strict";

  var SCENES = root.SCENES;
  var doc = root.document;
  if (!SCENES) return;

  var DEFAULT_DWELL = 20; // seconds per scene when autoplay is on and no per-scene override

  function urlParams() {
    try { return new URL(root.location.href).searchParams; } catch (e) { return null; }
  }

  function initialId() {
    var p = urlParams();
    var q = p && p.get("scene");
    if (q && SCENES.has(q)) return q;
    if (p && (p.get("autoplay") === "1" || p.get("autoplay") === "true")) {
      var show = SCENES.showList ? SCENES.showList() : [];
      if (show.length) return show[0].id;
    }
    return SCENES.firstId();
  }

  function SceneHost(canvas, opts) {
    this.canvas = canvas;
    this._opts = opts || {};
    this.zoom = false;       // party-main sets this true right after construction
    this.substrate = null;   // party-main sets this when a substrate image loads
    this._inner = null;
    this._id = null;

    // Autoplay: a steady scene cycle. Off unless ?autoplay=1. Dwell is per-scene
    // (registry `duration`) or the default. Not a tempo — just how long each scene holds.
    var p = urlParams();
    this._kiosk = !!(p && (p.get("kiosk") === "1" || p.get("kiosk") === "true"));
    if (this._kiosk && doc && doc.documentElement) doc.documentElement.classList.add("kiosk");
    this._auto = !!(p && (p.get("autoplay") === "1" || p.get("autoplay") === "true"));
    this._dwell = p && +p.get("dwell") > 0 ? +p.get("dwell") : DEFAULT_DWELL;
    this._autoTimer = null;
    this._controlSyncAt = 0;

    this._buildUI();
    this.load(initialId());
    if (this._auto) this._scheduleNext();

    var self = this;
    root.SCENE_CONTROL = {
      scene: function () { return self._id; },
      seek: function (seconds) { return self._callInner("seek", seconds); },
      play: function () { return self._callInner("setPlaying", true); },
      pause: function () { return self._callInner("setPlaying", false); },
      set: function (key, value) { return self._callInner("setControl", key, value); },
      state: function () { return self._callInner("serialize"); },
      restore: function (state) { return self._callInner("restore", state); }
    };
  }

  SceneHost.prototype._callInner = function (method) {
    if (!this._inner || typeof this._inner[method] !== "function") return null;
    return this._inner[method].apply(this._inner, Array.prototype.slice.call(arguments, 1));
  };

  SceneHost.prototype.load = function (id) {
    var entry = SCENES.get(id);
    if (!entry) return false;
    var handoff = null;
    if (this._inner) {
      handoff = { from: this._id, state: this._callInner("serialize") };
    }
    // ① Dispose the outgoing director before replacing it. Scenes that own timers,
    //    rAF loops or listeners (e.g. a ported standalone study) release them here;
    //    scenes that don't simply have no dispose() and this is a no-op. Without this,
    //    a self-driving scene's loop orphans on every swap and fps collapses over a night.
    if (this._inner && typeof this._inner.dispose === "function") {
      try { this._inner.dispose(); } catch (e) {}
    }
    this._inner = entry.factory(this.canvas, this._opts);
    this._id = id;
    if (handoff && typeof this._inner.acceptHandoff === "function") {
      try { this._inner.acceptHandoff(handoff); } catch (e) {}
    }
    if (this.zoom) this._inner.zoom = true;
    if (this.substrate) this._inner.substrate = this.substrate;
    SCENES.activeId = id;
    this._syncURL(id);
    this._markActive(id);
    this._bindDirectorControls();
    this._toast(entry.label);
    if (this._auto) this._scheduleNext();   // manual or auto switch both re-arm the clock
    return true;
  };

  SceneHost.prototype.step = function (dir) {
    var list = SCENES.list();
    if (!list.length) return;
    var i = SCENES.indexOf(this._id);
    if (i < 0) i = 0;
    i = (i + dir + list.length) % list.length;
    this.load(list[i].id);
  };

  SceneHost.prototype._stepShow = function () {
    var list = SCENES.showList ? SCENES.showList() : SCENES.list();
    if (!list.length) return;
    var i = -1;
    for (var n = 0; n < list.length; n++) if (list[n].id === this._id) { i = n; break; }
    this.load(list[(i + 1 + list.length) % list.length].id);
  };

  /* ── ② autoplay ── */
  SceneHost.prototype._dwellFor = function (id) {
    var e = SCENES.get(id);
    return (e && e.duration) || this._dwell;
  };
  SceneHost.prototype._scheduleNext = function () {
    var self = this;
    if (this._autoTimer) clearTimeout(this._autoTimer);
    var show = SCENES.showList ? SCENES.showList() : SCENES.list();
    if (show.length < 2) return;
    this._autoTimer = setTimeout(function () { self._stepShow(); }, this._dwellFor(this._id) * 1000);
  };
  SceneHost.prototype.setAutoplay = function (on) {
    this._auto = !!on;
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
    if (this._auto) this._scheduleNext();
    this._toast(this._auto ? "autoplay · on (" + this._dwell + "s)" : "autoplay · off");
    this._markAuto();
  };

  /* ── the forwarded host surface party-main.js depends on ── */
  SceneHost.prototype.pop = function (amount) {
    if (this._inner && this._inner.pop) this._inner.pop(amount);
  };
  SceneHost.prototype.draw = function (dt) {
    if (!this._inner) return;
    this._inner.zoom = this.zoom;                 // mirror live host props each frame
    if (this.substrate && this._inner.substrate !== this.substrate) {
      this._inner.substrate = this.substrate;
    }
    this._inner.draw(dt);
    this._syncDirectorControls();
  };

  /* ── switcher UI (projection-safe: subtle, self-hiding, pointer-only) ── */
  SceneHost.prototype._buildUI = function () {
    if (!doc) return;
    var self = this;
    var bar = doc.createElement("div");
    bar.id = "scene-picker";

    var auto = doc.createElement("button");
    auto.className = "scene-pill scene-auto";
    auto.textContent = "▶ auto";
    auto.title = "toggle autoplay (a)";
    auto.addEventListener("click", function () { self.setAutoplay(!self._auto); });
    bar.appendChild(auto);
    this._autoBtn = auto;

    SCENES.list().forEach(function (entry, idx) {
      var pill = doc.createElement("button");
      pill.className = "scene-pill";
      pill.dataset.scene = entry.id;
      pill.textContent = (idx + 1) + " · " + entry.label;
      pill.addEventListener("click", function () { self.load(entry.id); });
      bar.appendChild(pill);
    });
    (doc.body || doc.documentElement).appendChild(bar);
    this._bar = bar;
    this._markAuto();

    var controls = doc.createElement("section");
    controls.id = "scene-controls";
    controls.hidden = true;
    controls.innerHTML =
      '<div class="scene-transport"><button type="button" data-scene-action="play">❚❚</button>' +
      '<button type="button" data-scene-action="restart">↺</button>' +
      '<input data-scene-time type="range" min="0" max="1" step="0.01" value="0" aria-label="Scene timeline">' +
      '<output data-scene-clock>0.0 / 0.0 s</output>' +
      '<button type="button" data-scene-action="tune" aria-expanded="false">tune</button></div>' +
      '<div class="scene-tuning" hidden></div>';
    (doc.body || doc.documentElement).appendChild(controls);
    this._controls = controls;
    this._timeSlider = controls.querySelector("[data-scene-time]");
    this._clock = controls.querySelector("[data-scene-clock]");
    this._playBtn = controls.querySelector('[data-scene-action="play"]');
    this._tuning = controls.querySelector(".scene-tuning");
    this._timeSlider.addEventListener("input", function () {
      self._callInner("setPlaying", false);
      self._callInner("seek", +self._timeSlider.value);
      self._syncDirectorControls(true);
    });
    this._playBtn.addEventListener("click", function () {
      var playing = !!self._callInner("isPlaying");
      self._callInner("setPlaying", !playing);
      self._syncDirectorControls(true);
    });
    controls.querySelector('[data-scene-action="restart"]').addEventListener("click", function () {
      self._callInner("seek", 0); self._callInner("setPlaying", true); self._syncDirectorControls(true);
    });
    controls.querySelector('[data-scene-action="tune"]').addEventListener("click", function () {
      var hidden = !self._tuning.hidden;
      self._tuning.hidden = hidden;
      this.setAttribute("aria-expanded", hidden ? "false" : "true");
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "[") { self.step(-1); }
      else if (e.key === "]") { self.step(1); }
      else if (e.key === "a" || e.key === "A") { self.setAutoplay(!self._auto); }
      else if (/^[1-9]$/.test(e.key)) {
        var list = SCENES.list(), n = +e.key - 1;
        if (list[n]) self.load(list[n].id);
      }
    });
  };

  SceneHost.prototype._bindDirectorControls = function () {
    if (!this._controls) return;
    var seekable = this._inner && typeof this._inner.seek === "function" &&
      typeof this._inner.getDuration === "function" && typeof this._inner.getTime === "function";
    this._controls.hidden = !seekable;
    this._tuning.innerHTML = "";
    if (!seekable) return;
    var self = this;
    var specs = this._callInner("getControls") || [];
    specs.forEach(function (spec) {
      var row = doc.createElement("label");
      row.className = "scene-control-row";
      row.innerHTML = '<span></span><input type="range"><output></output>';
      row.querySelector("span").textContent = spec.label || spec.key;
      var input = row.querySelector("input"), output = row.querySelector("output");
      input.min = spec.min; input.max = spec.max; input.step = spec.step || 0.01;
      input.value = self._callInner("getControlValue", spec.key);
      output.textContent = input.value;
      input.addEventListener("input", function () {
        self._callInner("setControl", spec.key, +input.value);
        output.textContent = input.value;
      });
      self._tuning.appendChild(row);
    });
    this._syncDirectorControls(true);
  };

  SceneHost.prototype._syncDirectorControls = function (force) {
    if (!this._controls || this._controls.hidden || !this._inner) return;
    var now = root.performance && root.performance.now ? root.performance.now() : Date.now();
    if (!force && now - this._controlSyncAt < 100) return;
    this._controlSyncAt = now;
    var duration = +this._callInner("getDuration") || 0;
    var time = +this._callInner("getTime") || 0;
    this._timeSlider.max = duration;
    if (doc.activeElement !== this._timeSlider) this._timeSlider.value = time;
    this._clock.textContent = time.toFixed(1) + " / " + duration.toFixed(1) + " s";
    this._playBtn.textContent = this._callInner("isPlaying") ? "❚❚" : "▶";
  };

  SceneHost.prototype._markActive = function (id) {
    if (!this._bar) return;
    var pills = this._bar.querySelectorAll(".scene-pill[data-scene]");
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.toggle("active", pills[i].dataset.scene === id);
    }
  };
  SceneHost.prototype._markAuto = function () {
    if (this._autoBtn) {
      this._autoBtn.classList.toggle("active", this._auto);
      this._autoBtn.textContent = this._auto ? "❚❚ auto" : "▶ auto";
    }
  };

  SceneHost.prototype._syncURL = function (id) {
    try {
      var url = new URL(root.location.href);
      url.searchParams.set("scene", id);
      root.history.replaceState(null, "", url);
    } catch (e) {}
  };

  /* Reuse Party's toast lane if present; otherwise skip quietly. */
  SceneHost.prototype._toast = function (label) {
    if (!doc) return;
    var lane = doc.getElementById("toasts");
    if (!lane) return;
    var t = doc.createElement("div");
    t.className = "toast";
    t.textContent = "scene · " + label;
    lane.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 500);
    }, 1600);
  };

  root.AmbientDirector = SceneHost;
})(typeof window !== "undefined" ? window : globalThis);
