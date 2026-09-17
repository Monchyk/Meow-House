/* layout.js — where the stars sit. Deterministic, Barnes-Hut, phase-aware.
 *
 * The field must be a PLACE. Same seed, same coordinates, every run, forever —
 * so a returning visitor recognises where they are, and so a bug in it can be
 * reproduced. Nothing here calls Math.random().
 *
 * Barnes-Hut is genuine overkill at 139 nodes and entirely deliberate: the
 * exporter can widen the field with one flag, and an O(n^2) layout would fall
 * over exactly when someone tries that.
 *
 * PHASE 3 lives here. Raising `hyperPull` re-weights the forces so hyperedge
 * members draw together, and the field reorganises itself around the star that
 * the most cases share. The transition is eased over `relayoutTime` seconds —
 * deliberately far slower than feels necessary, because read too fast it looks
 * like a glitch instead of a realisation.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- quadtree ---------------------------------------------------------- */
  function QuadTree(x0, y0, x1, y1) {
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
    this.mass = 0; this.cx = 0; this.cy = 0;
    this.kids = null; this.body = null;
  }
  QuadTree.prototype.insert = function (b) {
    this.cx = (this.cx * this.mass + b.x) / (this.mass + 1);
    this.cy = (this.cy * this.mass + b.y) / (this.mass + 1);
    this.mass++;
    if (this.mass === 1) { this.body = b; return; }
    if (!this.kids) {
      this.kids = [];
      var mx = (this.x0 + this.x1) / 2, my = (this.y0 + this.y1) / 2;
      this.kids[0] = new QuadTree(this.x0, this.y0, mx, my);
      this.kids[1] = new QuadTree(mx, this.y0, this.x1, my);
      this.kids[2] = new QuadTree(this.x0, my, mx, this.y1);
      this.kids[3] = new QuadTree(mx, my, this.x1, this.y1);
      if (this.body) { this._push(this.body); this.body = null; }
    }
    this._push(b);
  };
  QuadTree.prototype._push = function (b) {
    var mx = (this.x0 + this.x1) / 2, my = (this.y0 + this.y1) / 2;
    var i = (b.x >= mx ? 1 : 0) + (b.y >= my ? 2 : 0);
    /* guard against degenerate cells swallowing coincident points forever */
    if (this.x1 - this.x0 < 0.01) { this.body = this.body || b; return; }
    this.kids[i].insert(b);
  };
  QuadTree.prototype.force = function (b, theta, k, out) {
    if (!this.mass || this.body === b) return;
    var dx = this.cx - b.x, dy = this.cy - b.y;
    var d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2);
    if (!this.kids || (this.x1 - this.x0) / d < theta) {
      var f = -k * this.mass / d2;
      out.x += f * dx / d; out.y += f * dy / d;
      return;
    }
    for (var i = 0; i < 4; i++) this.kids[i].force(b, theta, k, out);
  };

  /* ---- layout ------------------------------------------------------------ */
  function FieldLayout(graph, cfg) {
    this.g = graph;
    this.cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.layout) || {};
    this.pos = {};                 // id -> {x,y}  (the live, rendered positions)
    this._target = null;           // id -> {x,y}  (where an eased re-layout goes)
    this._from = null;
    this._blend = 1;               // 1 = settled
    this._blendTime = 0;
    this.weights = { hyperPull: this.cfg.hyperPull || 0,
                     communityPull: this.cfg.communityPull || 0 };
    this.settle();
  }

  FieldLayout.prototype = {

    /* Run the simulation to rest, from a seeded start. Cheap enough to do
     * synchronously at boot and in a node test. */
    solve: function (weights, iterations) {
      var c = this.cfg, g = this.g, nodes = g.nodes;
      var rng = mulberry32(c.seed || 1);
      var w = weights || this.weights;
      var bodies = [], byId = {};

      /* seeded ring start — spreads districts so the solver does not have to
       * untangle a hairball, and keeps the result stable */
      for (var i = 0; i < nodes.length; i++) {
        var a = rng() * Math.PI * 2, r = 120 + rng() * 380;
        var b = { id: nodes[i].id, x: Math.cos(a) * r, y: Math.sin(a) * r,
                  vx: 0, vy: 0, c: nodes[i].c };
        bodies.push(b); byId[b.id] = b;
      }

      /* district centroids, so communities cohere without a hard constraint */
      var comKeys = Object.keys(g.communities);
      var comAnchor = {};
      for (var q = 0; q < comKeys.length; q++) {
        var ang = (q / comKeys.length) * Math.PI * 2;
        comAnchor[comKeys[q]] = { x: Math.cos(ang) * 300, y: Math.sin(ang) * 300 };
      }

      var iters = iterations || c.iterations || 500;
      for (var step = 0; step < iters; step++) {
        var alpha = 1 - step / iters;          // cool down

        /* build the tree over current positions */
        var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (var t = 0; t < bodies.length; t++) {
          if (bodies[t].x < minx) minx = bodies[t].x;
          if (bodies[t].y < miny) miny = bodies[t].y;
          if (bodies[t].x > maxx) maxx = bodies[t].x;
          if (bodies[t].y > maxy) maxy = bodies[t].y;
        }
        var pad = 10;
        var tree = new QuadTree(minx - pad, miny - pad, maxx + pad, maxy + pad);
        for (var u = 0; u < bodies.length; u++) tree.insert(bodies[u]);

        /* Repulsion. NB the force is applied at full weight: an earlier version
         * scaled it by 0.001 while springs were applied raw, which made springs
         * ~100x stronger and collapsed the whole field into a 200-unit hairball.
         * If you retune `repulsion`, check the extent with tools/test_field.js. */
        for (var v = 0; v < bodies.length; v++) {
          var out = { x: 0, y: 0 };
          tree.force(bodies[v], c.theta || 0.8, c.repulsion || 900, out);
          bodies[v].vx += out.x;
          bodies[v].vy += out.y;
        }

        /* springs along edges */
        for (var e = 0; e < g.edges.length; e++) {
          var s = byId[g.edges[e].s], tt = byId[g.edges[e].t];
          if (!s || !tt) continue;
          var dx = tt.x - s.x, dy = tt.y - s.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var f = (d - (c.springLength || 90)) * (c.springK || 0.03);
          var fx = f * dx / d, fy = f * dy / d;
          s.vx += fx; s.vy += fy; tt.vx -= fx; tt.vy -= fy;
        }

        /* hyperedge cohesion — THE PHASE 3 FORCE. At weight 0 this is inert,
         * which is exactly how the field looks before the realisation. */
        if (w.hyperPull > 0) {
          for (var hh = 0; hh < g.hyperedges.length; hh++) {
            var mem = g.hyperedges[hh].nodes, cx = 0, cy = 0, n = 0;
            for (var m1 = 0; m1 < mem.length; m1++) {
              var bb = byId[mem[m1]];
              if (bb) { cx += bb.x; cy += bb.y; n++; }
            }
            if (n < 2) continue;
            cx /= n; cy /= n;
            for (var m2 = 0; m2 < mem.length; m2++) {
              var b2 = byId[mem[m2]];
              if (!b2) continue;
              b2.vx += (cx - b2.x) * 0.02 * w.hyperPull;
              b2.vy += (cy - b2.y) * 0.02 * w.hyperPull;
            }
          }
        }

        /* district pull + gravity + integrate */
        for (var z = 0; z < bodies.length; z++) {
          var bd = bodies[z], an = comAnchor[bd.c];
          if (an && w.communityPull > 0) {
            bd.vx += (an.x - bd.x) * 0.004 * w.communityPull;
            bd.vy += (an.y - bd.y) * 0.004 * w.communityPull;
          }
          bd.vx -= bd.x * (c.gravity || 0.01);
          bd.vy -= bd.y * (c.gravity || 0.01);
          var damp = (c.damping || 0.86);
          bd.vx *= damp; bd.vy *= damp;
          bd.x += bd.vx * alpha; bd.y += bd.vy * alpha;
        }
      }

      var out2 = {};
      for (var o = 0; o < bodies.length; o++)
        out2[bodies[o].id] = { x: bodies[o].x, y: bodies[o].y };
      return out2;
    },

    settle: function () {
      this.pos = this.solve(this.weights);
      this._blend = 1; this._target = null; this._from = null;
      return this;
    },

    /* Change the force weights and glide there. This is the reveal; it must be
     * slow enough to read as the field THINKING, not as a redraw. */
    reweight: function (weights, seconds) {
      var next = {};
      for (var k in this.weights) next[k] = this.weights[k];
      for (var j in weights) next[j] = weights[j];
      this.weights = next;
      this._from = this.pos;
      this._target = this.solve(next);
      this._blendTime = seconds || this.cfg.relayoutTime || 12;
      this._blend = 0;
      return this;
    },

    settling: function () { return this._blend < 1; },

    frame: function (dt) {
      if (this._blend >= 1 || !this._target) return;
      this._blend = Math.min(1, this._blend + dt / this._blendTime);
      /* smootherstep — no visible start or stop, so it reads as drift */
      var t = this._blend, e = t * t * t * (t * (t * 6 - 15) + 10);
      var out = {};
      for (var id in this._target) {
        var a = this._from[id] || this._target[id], b = this._target[id];
        out[id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
      this.pos = out;
      if (this._blend >= 1) { this.pos = this._target; this._target = null; }
    },

    /* micro-drift for phase 4: the field is alive, not finished. Deterministic
     * per node, driven by a clock rather than a random walk. */
    breathe: function (time, amp) {
      if (!amp) return this.pos;
      var out = {}, i = 0;
      for (var id in this.pos) {
        var p = this.pos[id], ph = (i++ % 17) * 0.37;
        out[id] = { x: p.x + Math.sin(time * 0.3 + ph) * amp * 6,
                    y: p.y + Math.cos(time * 0.23 + ph) * amp * 6 };
      }
      return out;
    },

    bounds: function () {
      var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (var id in this.pos) {
        var p = this.pos[id];
        if (p.x < b.x0) b.x0 = p.x; if (p.y < b.y0) b.y0 = p.y;
        if (p.x > b.x1) b.x1 = p.x; if (p.y > b.y1) b.y1 = p.y;
      }
      return b;
    },

    /* clockwise from 12, for stable ↑↓ ordering around the current star */
    angleFrom: function (fromId, toId) {
      var a = this.pos[fromId], b = this.pos[toId];
      if (!a || !b) return 0;
      var ang = Math.atan2(b.x - a.x, -(b.y - a.y));
      return ang < 0 ? ang + Math.PI * 2 : ang;
    }
  };

  root.FieldLayout = FieldLayout;
})();
