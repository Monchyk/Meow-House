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
    this._auto = !!(p && (p.get("autoplay") === "1" || p.get("autoplay") === "true"));
    this._dwell = p && +p.get("dwell") > 0 ? +p.get("dwell") : DEFAULT_DWELL;
    this._autoTimer = null;

    this._buildUI();
    this.load(initialId());
    if (this._auto) this._scheduleNext();
  }

  SceneHost.prototype.load = function (id) {
    var entry = SCENES.get(id);
    if (!entry) return false;
    // ① Dispose the outgoing director before replacing it. Scenes that own timers,
    //    rAF loops or listeners (e.g. a ported standalone study) release them here;
    //    scenes that don't simply have no dispose() and this is a no-op. Without this,
    //    a self-driving scene's loop orphans on every swap and fps collapses over a night.
    if (this._inner && typeof this._inner.dispose === "function") {
      try { this._inner.dispose(); } catch (e) {}
    }
    this._inner = entry.factory(this.canvas, this._opts);
    this._id = id;
    if (this.zoom) this._inner.zoom = true;
    if (this.substrate) this._inner.substrate = this.substrate;
    SCENES.activeId = id;
    this._syncURL(id);
    this._markActive(id);
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

  /* ── ② autoplay ── */
  SceneHost.prototype._dwellFor = function (id) {
    var e = SCENES.get(id);
    return (e && e.duration) || this._dwell;
  };
  SceneHost.prototype._scheduleNext = function () {
    var self = this;
    if (this._autoTimer) clearTimeout(this._autoTimer);
    if (SCENES.list().length < 2) return;   // one scene: cycling would dispose+rebuild it for nothing
    this._autoTimer = setTimeout(function () { self.step(1); }, this._dwellFor(this._id) * 1000);
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
