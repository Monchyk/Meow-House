/* render.js — drawing the constellation. Canvas-2D, no deps, no state of its own.
 *
 * Reads: graph, layout, nav, progress, phase weights, the house's endocrine
 * tint, and the case overlay. Owns none of them. Everything it draws is a
 * function of those inputs, so what you see is always the truth about what the
 * system currently is.
 *
 * The horizon is the core visual rule: you see your star, its neighbours, and
 * progressively fainter rings beyond, out to however many hops the Decks tempo
 * currently buys you. Developed stars stay lit regardless — memory is the only
 * thing that beats distance.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function hexRgb(hex) {
    var h = (hex || "#888").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);
  }

  function FieldRender(graph, layout, nav, cfg) {
    this.g = graph; this.L = layout; this.nav = nav;
    this.cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.render) || {};
    this.tint = null;          // set from the house endocrine field
    this._t = 0;
    this._descFade = 1;
  }

  FieldRender.prototype = {

    setTint: function (hex) { this.tint = hex ? hexRgb(hex) : null; },

    zoom: function () { return this.cfg.zoom || 1; },

    starRadius: function (node) {
      var c = this.cfg;
      var d = Math.pow(Math.min(node.deg, 40) / 40, c.starGamma || 0.55);
      var r = (c.starMin || 2.6) + d * ((c.starMax || 11) - (c.starMin || 2.6));
      /* stars scale with the field, but sub-linearly: at high zoom a hub should
       * read as important without becoming a planet */
      return r * Math.pow(this.zoom(), 0.5);
    },

    /* the whole frame */
    draw: function (ctx, w, h, dt, opts) {
      opts = opts || {};
      this._t += dt;
      var c = this.cfg, g = this.g, nav = this.nav;
      var weights = opts.weights || {};
      var progress = opts.progress;
      var highlight = opts.highlight;          // case overlay, or null
      var hops = Math.max(1, Math.round(opts.hops || 1));

      /* trail fade rather than hard clear — stars leave a wake when you move */
      ctx.fillStyle = "rgba(4,5,10," + (opts.fade || 0.22) + ")";
      ctx.fillRect(0, 0, w, h);

      var pos = weights.breath ? this.L.breathe(this._t, weights.breath) : this.L.pos;
      var cam = nav.cam, z = this.zoom();
      function P(id) {
        var p = pos[id];
        return p && { x: (p.x - cam.x) * z + w / 2, y: (p.y - cam.y) * z + h / 2 };
      }

      var horizon = g.within(nav.current, hops);
      var self = this;

      /* SHOCKWAVES. A moment propagates outward through the GRAPH, not through
       * space — the ring passes from a star to its neighbours to theirs, so you
       * watch a resolve travel along the structure it belongs to. Hop distances
       * are cached per wave rather than per frame: BFS over 139 nodes every
       * frame for every live wave would be the one genuinely hot loop here. */
      var waves = (root.MOMENTS && root.MOMENTS.active) || [];
      var hopCache = this._hopCache || (this._hopCache = []);
      for (var wi = 0; wi < waves.length; wi++) {
        if (!waves[wi]._cache && waves[wi].origin) {
          waves[wi]._cache = g.within(waves[wi].origin, waves[wi].hops === 99 ? 12 : waves[wi].hops);
        }
        hopCache[wi] = waves[wi]._cache;
      }
      function flare(id) {
        if (!waves.length) return 0;
        var total = 0;
        for (var i = 0; i < waves.length; i++) {
          var hp = hopCache[i] && hopCache[i][id];
          if (hp === undefined) continue;
          var d = Math.abs(waves[i].t - hp);
          if (d > 1) continue;
          total += (1 - d) * waves[i].strength;
        }
        return total;
      }

      function visibility(id) {
        var dev = progress && progress.isDeveloped(id);
        var hop = horizon[id];
        var a;
        if (hop === undefined) a = dev && weights.keepLit ? 0.22 : 0;
        else a = Math.pow(c.fadePerHop !== undefined ? c.fadePerHop : 0.45, hop);
        if (dev) a = Math.max(a, c.liveAlpha || 0.85);
        if (highlight) {
          /* An open case OVERRIDES the horizon for its own stars. Anchors sit
           * 1-4 hops out, so without this, opening a case dimmed the whole
           * field and its own stars stayed invisible — the overlay looked like
           * it did nothing at all. The case is the point: show all of it. */
          a = highlight[id] ? Math.max(a, 0.8) : a * 0.10;
        }
        return clamp(a, 0, 1);
      }

      /* ---- hyperedge hulls (phase 3+): the groups become visible ------- */
      var hullA = (weights.hullAlpha !== undefined) ? weights.hullAlpha : c.hullAlpha;
      if (weights.showHulls && hullA > 0) {
        for (var hh = 0; hh < g.hyperedges.length; hh++) {
          var mem = g.hyperedges[hh].nodes, pts = [];
          for (var m = 0; m < mem.length; m++) {
            var pp = P(mem[m]);
            if (pp && visibility(mem[m]) > 0.05) pts.push(pp);
          }
          if (pts.length < 3) continue;
          var cx = 0, cy = 0;
          for (var q = 0; q < pts.length; q++) { cx += pts[q].x; cy += pts[q].y; }
          cx /= pts.length; cy /= pts.length;
          pts.sort(function (a, b) {
            return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
          });
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (var k = 1; k < pts.length; k++) {
            var prev = pts[k - 1], cur = pts[k], ten = c.hullTension || 0.4;
            ctx.quadraticCurveTo(
              cx + (prev.x - cx) * (1 + ten * 0.3), cy + (prev.y - cy) * (1 + ten * 0.3),
              cur.x, cur.y);
          }
          ctx.closePath();
          ctx.fillStyle = rgba(this.tint || [120, 130, 190], hullA);
          ctx.fill();
        }
      }

      /* ---- edges ------------------------------------------------------- */
      ctx.lineWidth = 1;
      for (var e = 0; e < g.edges.length; e++) {
        var ed = g.edges[e];
        var va = visibility(ed.s), vb = visibility(ed.t);
        if (va < 0.04 || vb < 0.04) continue;
        var devBoth = progress && progress.isDeveloped(ed.s) && progress.isDeveloped(ed.t);
        var caseEdge = highlight && highlight[ed.s] && highlight[ed.t];
        if (!caseEdge && !devBoth &&
            horizon[ed.s] === undefined && horizon[ed.t] === undefined) continue;
        if (devBoth && !weights.showDevEdges && horizon[ed.s] === undefined) continue;
        var pa = P(ed.s), pb = P(ed.t);
        if (!pa || !pb) continue;
        var ea = Math.min(va, vb) * (c.edgeAlpha || 0.16) *
                 (devBoth ? 2.2 : 1) * (weights.edgeBoost || 1);
        ctx.strokeStyle = rgba(this.tint || [140, 150, 200], clamp(ea, 0, 0.5));
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }

      /* ---- the trail you actually walked -------------------------------- */
      if (nav.trail.length > 1 && c.trailAlpha > 0) {
        ctx.beginPath();
        var started = false;
        for (var t2 = 0; t2 < nav.trail.length; t2++) {
          var tp = P(nav.trail[t2]);
          if (!tp) continue;
          if (!started) { ctx.moveTo(tp.x, tp.y); started = true; }
          else ctx.lineTo(tp.x, tp.y);
        }
        ctx.strokeStyle = rgba(this.tint || [200, 190, 150], c.trailAlpha);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      /* ---- stars -------------------------------------------------------- */
      var selId = nav.selected();
      for (var i = 0; i < g.nodes.length; i++) {
        var n = g.nodes[i], a = visibility(n.id);
        if (a < 0.03) continue;
        var p = P(n.id);
        if (!p || p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) continue;

        var col = hexRgb(n.hex);
        if (this.tint) col = mix(col, this.tint, 0.35);
        var r = this.starRadius(n);

        /* a star in more than one case carries a little more presence — the
         * convergence becoming felt before phase 3 makes it structural */
        /* A star many cases share carries visible weight from phase 3 on. The
         * convergence becomes FELT just before the layout makes it structural —
         * and still nobody says a word about it. */
        var share = g.caseShare(n.id);
        if (share > 1) {
          r *= 1 + Math.min(share, 7) * (weights.showShared ? 0.16 : 0.07);
          if (weights.showShared) {
            var sh = 0.5 + 0.5 * Math.sin(this._t * 0.6 + share);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * (2.0 + sh * 1.4), 0, Math.PI * 2);
            ctx.fillStyle = rgba(col, 0.035 * a * Math.min(share, 7));
            ctx.fill();
          }
        }

        /* THE AFFORDANCE: a star you have not resolved is drawn HOLLOW — it is
         * visibly incomplete, and reads as wanting something. A resolved star is
         * filled and carries a soft halo. One glance says what you have touched
         * and what is still waiting, with no numbers and no labels. */
        /* the wavefront passing through this star */
        var fl = flare(n.id);
        if (fl > 0.01) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * (1.6 + fl * 5.2), 0, Math.PI * 2);
          ctx.fillStyle = rgba([250, 230, 190], Math.min(0.5, fl * 0.42));
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * (1.2 + fl * 2.4), 0, Math.PI * 2);
          ctx.strokeStyle = rgba([255, 240, 210], Math.min(0.8, fl * 0.7));
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.lineWidth = 1;
          a = Math.min(1, a + fl * 0.6);        // the wave briefly reveals dark stars
        }

        var dev = progress && progress.isDeveloped(n.id);
        if (dev) {
          var pulse = 0.5 + 0.5 * Math.sin(this._t * 0.9 + i);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * (2.6 + pulse * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = rgba(col, 0.05 * a);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = rgba(col, a);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.92, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(col, a * 0.95);
          ctx.lineWidth = Math.max(1, r * 0.28);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.fillStyle = rgba(col, a * 0.10);   // barely-there centre
          ctx.fill();
        }
      }

      /* ---- selection ring ----------------------------------------------
       * Slot 0 is the star you are STANDING ON and Enter means something else
       * there ("examine", not "travel"). If the two look identical, the entire
       * instrument tray is undiscoverable — which is exactly what shipped the
       * first time. So: pointing at a neighbour is one thin ring; standing on
       * yourself is a double ring that breathes. */
      if (selId) {
        var sp = P(selId), onSelf = nav.onSelf && nav.onSelf();
        if (sp) {
          var base = (this.cfg.ringRadius || 46) * 0.35 * this.zoom();
          var breathe = Math.sin(this._t * 2.2) * 1.5;
          ctx.strokeStyle = rgba(this.tint || [235, 225, 190], onSelf ? 0.8 : 0.5);
          ctx.lineWidth = onSelf ? 1.8 : 1.3;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, base + breathe, 0, Math.PI * 2);
          ctx.stroke();
          if (onSelf) {
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, base * 0.62 - breathe * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(this.tint || [235, 225, 190], 0.35);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.lineWidth = 1;
        }
      }

      /* ---- wayfinding: which way is the rest of this case ---------------
       * A soft chevron on the neighbour that leads onward. It points, it never
       * pulls — you can ignore it completely and wander. */
      if (opts.guideTo) {
        var gp = P(opts.guideTo);
        if (gp) {
          var gpul = 0.55 + 0.45 * Math.sin(this._t * 3);
          ctx.beginPath();
          ctx.arc(gp.x, gp.y, 16 + gpul * 3, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(242,201,120," + (0.30 + gpul * 0.25) + ")";
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }

      /* ---- you are here ------------------------------------------------- */
      var cp = P(nav.current);
      if (cp) {
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245,240,225,0.95)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 9 + Math.sin(this._t * 1.6) * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(245,240,225,0.28)";
        ctx.stroke();
      }
    },

    /* The descriptor block. The ONLY text in the field, and every character of
     * it is machine-derived from display-safe fields (see build_constellation.py).
     * No prose about anyone ever passes through here. */
    hud: function (ctx, w, h, node, sigma, opts) {
      if (!node) return;
      opts = opts || {};
      var parts = (node.desc || "").split("·");
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(236,232,220,0.86)";
      ctx.font = "16px ui-monospace, monospace";
      ctx.fillText(parts[0] || "", w / 2, h - 96);
      ctx.fillStyle = "rgba(190,190,205,0.5)";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText(parts.slice(1).join(" · "), w / 2, h - 77);

      /* state + the verb. Machine-derived, two words, never a sentence about
       * anyone — but enough that the piece stops being unfindable. */
      if (opts.state) {
        ctx.fillStyle = opts.state === "resolved"
          ? "rgba(242,201,120,0.75)" : "rgba(150,155,175,0.72)";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText(opts.state, w / 2, h - 58);
      }
      if (opts.action) {
        ctx.fillStyle = "rgba(236,232,220,0.42)";
        ctx.font = "12px ui-monospace, monospace";
        ctx.fillText(opts.action, w / 2, h - 36);
      }

      /* a quiet tally, bottom-left. Not a score — just proof things accumulate. */
      if (typeof opts.developed === "number") {
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(242,201,120,0.5)";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText("● " + opts.developed, 22, h - 22);
        ctx.fillStyle = "rgba(150,155,175,0.35)";
        ctx.fillText("◌ " + ((opts.total || 0) - opts.developed), 62, h - 22);
        ctx.textAlign = "center";
      }

      /* An open case: what it is and how much of it you have stood on. Top of
       * screen so it never competes with the star descriptor. */
      if (opts.caseTitle) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(242,201,120,0.72)";
        ctx.font = "13px ui-monospace, monospace";
        ctx.fillText(opts.caseTitle, w / 2, 40);
        ctx.fillStyle = "rgba(190,190,205,0.5)";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText(opts.caseSeen + " / " + opts.caseTotal + " visited", w / 2, 60);
      }

      /* Something became available and you would otherwise never know: the
       * instrument tray gained an entry. One mark, no sentence. */
      if (opts.newInstrument) {
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(242,201,120,0.55)";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText("✧ new", w - 22, h - 22);
        ctx.textAlign = "center";
      }

      if (typeof sigma === "number") {
        var bw = 150, x0 = (w - bw) / 2, y = h - 36;
        ctx.strokeStyle = "rgba(150,150,170,0.35)";
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + bw, y); ctx.stroke();
        ctx.fillStyle = "rgba(242,201,120,0.9)";
        ctx.beginPath();
        ctx.arc(x0 + bw * clamp(sigma, 0, 1), y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(190,190,205,0.45)";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText("σ " + sigma.toFixed(2), w / 2, h - 18);
      }
      ctx.restore();
    }
  };

  root.FieldRender = FieldRender;
})();
