/* nav.js — the four-button walk. This is the whole navigation model.
 *
 *   ↑ ↓    rotate the selection through the current star's NEIGHBOURS
 *   Enter  travel — you become that star
 *   Esc    step back along the trail you actually walked
 *
 * The menu is gone. You never see a list of everything; you see what is
 * adjacent. Depth stops coming from nesting and starts coming from topology,
 * which means a visitor who walks carefully genuinely goes somewhere a button-
 * masher does not — the thing the old lobby could never do.
 *
 * Neighbour ordering is ANGULAR and stable: the star that is up-and-left stays
 * up-and-left every time you stand here. A field you cannot learn is a menu
 * with extra steps.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function Nav(graph, layout, cfg) {
    this.g = graph;
    this.L = layout;
    this.cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.nav) || {};
    this.current = null;
    this.sel = 0;              // index into this.ring
    this.ring = [];
    this.trail = [];
    this.travelling = 0;       // 0..1 progress of the current move
    this.from = null;
    this.cam = { x: 0, y: 0 };
    this._onArrive = [];
  }

  Nav.prototype = {

    onArrive: function (fn) { this._onArrive.push(fn); return this; },

    start: function (id) {
      this.current = id || this.g.entryNode();
      this.trail = [this.current];
      var p = this.L.pos[this.current] || { x: 0, y: 0 };
      this.cam.x = p.x; this.cam.y = p.y;
      this._rebuild();
      this._fire(true);
      return this.current;
    },

    /* Neighbours sorted clockwise from 12 o'clock. Ties broken by id so the
     * order is identical on every visit and in every process. */
    _rebuild: function () {
      var self = this, cur = this.current;
      var ns = this.g.neighbours(cur, "id");
      if (this.cfg.neighbourSort === "angle" && this.L && this.L.pos[cur]) {
        ns = ns.slice().sort(function (a, b) {
          var aa = self.L.angleFrom(cur, a.id), ab = self.L.angleFrom(cur, b.id);
          return aa - ab || (a.id < b.id ? -1 : 1);
        });
      } else {
        ns = this.g.neighbours(cur, this.cfg.neighbourSort);
      }
      /* Slot 0 is the star you are STANDING ON. "Look at where you are" has to
       * be a first-class option in the ring, or examining a star needs a fifth
       * button and the four-button contract breaks. Enter on slot 0 opens the
       * instruments for this star; Enter on any other slot travels. */
      this.ring = [{ id: cur, r: "self", self: true }].concat(ns);
      if (this.sel >= this.ring.length) this.sel = 0;
    },

    selected: function () { return this.ring.length ? this.ring[this.sel].id : null; },
    selectedRelation: function () { return this.ring.length ? this.ring[this.sel].r : null; },
    onSelf: function () { return !!(this.ring[this.sel] && this.ring[this.sel].self); },

    /* ------------------------------------------------------------- input */
    up: function () {
      if (!this.ring.length) return null;
      this.sel = (this.sel - 1 + this.ring.length) % this.ring.length;
      return this.selected();
    },
    down: function () {
      if (!this.ring.length) return null;
      this.sel = (this.sel + 1) % this.ring.length;
      return this.selected();
    },

    travel: function (toId) {
      var to = toId || this.selected();
      if (!to || to === this.current || this.travelling > 0) return null;
      this.from = this.current;
      this.current = to;
      this.travelling = 0.0001;
      this.trail.push(to);
      var max = this.cfg.pathMax || 24;
      if (this.trail.length > max) this.trail.shift();
      this.sel = 0;
      this._rebuild();
      return to;
    },

    /* Esc walks the trail back — not a stack of menus, the actual path. When
     * the trail runs out you simply stay: there is no "up" to go to. */
    back: function () {
      if (this.travelling > 0 || this.trail.length < 2) return null;
      this.trail.pop();
      this.from = this.current;
      this.current = this.trail[this.trail.length - 1];
      this.travelling = 0.0001;
      this.sel = 0;
      this._rebuild();
      return this.current;
    },

    /* --------------------------------------------------------------- tick */
    frame: function (dt) {
      if (this.travelling > 0) {
        var dur = this.cfg.travelTime || 0.8;
        this.travelling = Math.min(1, this.travelling + dt / dur);
        var t = this.travelling;
        var e = 1 - Math.pow(1 - t, this.cfg.travelEase || 2.2);
        var a = this.L.pos[this.from] || this.cam;
        var b = this.L.pos[this.current] || this.cam;
        this.cam.x = a.x + (b.x - a.x) * e;
        this.cam.y = a.y + (b.y - a.y) * e;
        if (this.travelling >= 1) {
          this.travelling = 0;
          this._fire(false);
        }
      } else if (this.current && this.L.pos[this.current]) {
        /* keep the camera glued through a re-layout, or phase 3 slides the
         * world out from under the visitor */
        var p = this.L.pos[this.current];
        this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 4);
        this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 4);
      }
    },

    _fire: function (isStart) {
      for (var i = 0; i < this._onArrive.length; i++) {
        try { this._onArrive[i](this.current, isStart); } catch (e) {}
      }
    },

    /* world -> screen. MUST match render.js's projection, including zoom, or
     * overlays (the agency ring) land somewhere the star is not. */
    project: function (id, w, h) {
      var p = this.L.pos[id];
      if (!p) return null;
      var z = (root.FIELD_CFG && root.FIELD_CFG.render && root.FIELD_CFG.render.zoom) || 1;
      return { x: (p.x - this.cam.x) * z + w / 2, y: (p.y - this.cam.y) * z + h / 2 };
    }
  };

  root.FieldNav = Nav;
})();
