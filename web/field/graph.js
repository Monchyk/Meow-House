/* graph.js — the constellation as pure structure. No canvas, no DOM, no state.
 *
 * Everything the walk needs to answer "what is next to me, and what belongs
 * with what" lives here, precomputed once at load. Rendering and navigation
 * both read it; neither owns it.
 *
 * Loads web/constellation.json (built by tools/build_constellation.py). Node
 * ids are opaque hashes by design — this file never sees a name.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function FieldGraph(doc) {
    this.doc = doc;
    this.nodes = doc.nodes;
    this.edges = doc.edges;
    this.hyperedges = doc.hyperedges || [];
    this.cases = doc.cases || [];
    this.hub = doc.hub;

    this.byId = {};
    for (var i = 0; i < this.nodes.length; i++) this.byId[this.nodes[i].id] = this.nodes[i];

    /* adjacency, with the relation kept — an edge's TYPE is readable later */
    this.adj = {};
    for (var j = 0; j < this.nodes.length; j++) this.adj[this.nodes[j].id] = [];
    for (var k = 0; k < this.edges.length; k++) {
      var e = this.edges[k];
      if (!this.adj[e.s] || !this.adj[e.t]) continue;
      this.adj[e.s].push({ id: e.t, r: e.r, w: e.w || 1 });
      this.adj[e.t].push({ id: e.s, r: e.r, w: e.w || 1 });
    }

    /* districts */
    this.communities = {};
    for (var m = 0; m < this.nodes.length; m++) {
      var n = this.nodes[m];
      (this.communities[n.c] = this.communities[n.c] || []).push(n.id);
    }

    /* membership indexes: node -> the groups it belongs to */
    this.hyperOf = {};
    for (var h = 0; h < this.hyperedges.length; h++) {
      var he = this.hyperedges[h];
      for (var p = 0; p < he.nodes.length; p++)
        (this.hyperOf[he.nodes[p]] = this.hyperOf[he.nodes[p]] || []).push(he.id);
    }
    this.caseOf = {};
    for (var c = 0; c < this.cases.length; c++) {
      var cs = this.cases[c];
      for (var q = 0; q < cs.nodes.length; q++)
        (this.caseOf[cs.nodes[q]] = this.caseOf[cs.nodes[q]] || []).push(cs.id);
    }
  }

  FieldGraph.prototype = {
    get: function (id) { return this.byId[id]; },
    degree: function (id) { return (this.adj[id] || []).length; },

    /* Neighbours as ↑↓ would walk them. Ordering must be STABLE — the same
     * star must always sit "one up" from here, or the field stops being a
     * place you can learn. Angle ordering needs positions, so it is applied
     * by nav.js once layout has settled; here we guarantee a deterministic
     * fallback and a consistent tiebreak. */
    neighbours: function (id, mode) {
      var a = (this.adj[id] || []).slice();
      if (mode === "degree") {
        var self = this;
        a.sort(function (x, y) {
          return self.degree(y.id) - self.degree(x.id) || (x.id < y.id ? -1 : 1);
        });
      } else if (mode === "feeling") {
        var g = this;
        a.sort(function (x, y) {
          var fx = (g.byId[x.id] || {}).f || "", fy = (g.byId[y.id] || {}).f || "";
          return fx < fy ? -1 : fx > fy ? 1 : (x.id < y.id ? -1 : 1);
        });
      } else {
        a.sort(function (x, y) { return x.id < y.id ? -1 : 1; });
      }
      return a;
    },

    /* everything within `hops`, as { id: hopCount }. This is the horizon. */
    within: function (id, hops) {
      var seen = {}, frontier = [id], d = 0;
      seen[id] = 0;
      while (d < hops && frontier.length) {
        var next = [];
        for (var i = 0; i < frontier.length; i++) {
          var a = this.adj[frontier[i]] || [];
          for (var j = 0; j < a.length; j++) {
            if (!(a[j].id in seen)) { seen[a[j].id] = d + 1; next.push(a[j].id); }
          }
        }
        frontier = next; d++;
      }
      return seen;
    },

    path: function (from, to) {
      if (from === to) return [from];
      var prev = {}, seen = {}, q = [from];
      seen[from] = true;
      while (q.length) {
        var cur = q.shift(), a = this.adj[cur] || [];
        for (var i = 0; i < a.length; i++) {
          var nx = a[i].id;
          if (seen[nx]) continue;
          seen[nx] = true; prev[nx] = cur;
          if (nx === to) {
            var out = [to], p = to;
            while (p !== from) { p = prev[p]; out.unshift(p); }
            return out;
          }
          q.push(nx);
        }
      }
      return null;
    },

    /* how many distinct cases a star belongs to — the convergence signal that
     * phase 3 makes visible. The hub scores highest; nothing says why. */
    caseShare: function (id) { return (this.caseOf[id] || []).length; },

    caseById: function (id) {
      for (var i = 0; i < this.cases.length; i++)
        if (this.cases[i].id === id) return this.cases[i];
      return null;
    },

    /* a sane place to open on: well-connected, but not the hub itself —
     * arriving directly at the centre would give the ending away. */
    entryNode: function () {
      var best = null, self = this;
      for (var i = 0; i < this.nodes.length; i++) {
        var n = this.nodes[i];
        if (n.id === this.hub) continue;
        var score = self.degree(n.id) - self.caseShare(n.id) * 3;
        if (!best || score > best.score) best = { id: n.id, score: score };
      }
      return best && best.id;
    },

    stats: function () {
      return {
        nodes: this.nodes.length, edges: this.edges.length,
        hyperedges: this.hyperedges.length, cases: this.cases.length,
        districts: Object.keys(this.communities).length
      };
    }
  };

  root.FieldGraph = FieldGraph;
})();
