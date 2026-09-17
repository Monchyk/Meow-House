/* cases.js — the Case Board. DESIGN.md:44-46, the actual detective mechanic.
 *
 *   "no traditional keys. Unlock connections, relationships, interpretations,
 *    perspective shifts, false assumptions. The case board slowly reveals that
 *    every case belongs to the same mind (wordless)."
 *
 * The old Archive was a list of 8 stories you scrolled. A case here is not a
 * story — it is a FILTER OVER THE FIELD. Open one and everything dims except
 * its anchors; walk those anchors and you have walked the case.
 *
 * The reveal is not authored, it is topological: the same star keeps being in
 * the case you just opened. Seven of the eight share it. Nobody ever says so,
 * and no text on screen ever could — that is the point of doing it this way.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  var Cases = {
    active: null,          // case id, or null for the open field
    _g: null,
    _p: null,

    init: function (graph, progress) {
      this._g = graph; this._p = progress; this.active = null;
      return this;
    },

    list: function () { return (this._g && this._g.cases) || []; },

    open: function (caseId) {
      this.active = caseId || null;
      return this.current();
    },
    close: function () { this.active = null; return null; },
    current: function () { return this.active ? this._g.caseById(this.active) : null; },

    /* Which stars the overlay lights. Everything else falls to dimAlpha. */
    highlighted: function () {
      var c = this.current();
      if (!c) return null;                 // null = no filter, show the field
      var set = {};
      for (var i = 0; i < c.nodes.length; i++) set[c.nodes[i]] = true;
      return set;
    },

    /* A case is walked once every one of its anchors has been VISITED. Not
     * developed — walking a case is showing up to all of it, which is a
     * different act from understanding any one part of it. */
    progressOf: function (caseId) {
      var c = this._g.caseById(caseId);
      if (!c || !this._p) return { seen: 0, total: 0, done: false };
      var seen = 0;
      for (var i = 0; i < c.nodes.length; i++)
        if (this._p.data.visited[c.nodes[i]]) seen++;
      return { seen: seen, total: c.nodes.length, done: seen >= c.nodes.length };
    },

    /* Call after every travel. Returns a case id if one just completed. */
    checkCompletion: function () {
      if (!this._p) return null;
      var list = this.list();
      for (var i = 0; i < list.length; i++) {
        var st = this.progressOf(list[i].id);
        if (st.done && this._p.walkCase(list[i].id)) return list[i].id;
      }
      return null;
    },

    /* WAYFINDING. An open case dims the field to its anchors, but navigation is
     * adjacency-only and anchors sit 1-4 hops apart — without this you know
     * WHAT you are looking for and have no idea which way to walk. Returns the
     * next step toward the nearest anchor you have not visited yet.
     *
     * It points; it never moves you. The walk stays yours. */
    nextStep: function (fromId) {
      var c = this.current();
      if (!c || !this._p) return null;
      var best = null;
      for (var i = 0; i < c.nodes.length; i++) {
        var id = c.nodes[i];
        if (id === fromId || this._p.data.visited[id]) continue;
        var path = this._g.path(fromId, id);
        if (!path) continue;
        if (!best || path.length < best.path.length) best = { path: path, target: id };
      }
      if (!best) return null;
      return {
        next: best.path[1] || best.target,   // the neighbour to step to
        target: best.target,
        hops: best.path.length - 1
      };
    },

    /* How many distinct cases a star belongs to. Used by the renderer to give
     * shared stars a little more presence as the arc goes on — the convergence
     * becoming visible before it becomes structural in phase 3. */
    share: function (nodeId) { return this._g.caseShare(nodeId); },

    /* Cases that are worth offering: not yet walked, and reachable. Ordered so
     * the one sharing fewest stars with what you've seen comes first, which
     * keeps early cases feeling separate — the convergence should be earned,
     * not spoiled by opening two overlapping cases in a row. */
    suggest: function () {
      var out = [], self = this;
      var list = this.list();
      for (var i = 0; i < list.length; i++) {
        var st = this.progressOf(list[i].id);
        if (!st.done) out.push({ id: list[i].id, title: list[i].title, seen: st.seen, total: st.total });
      }
      out.sort(function (a, b) { return a.seen - b.seen || (a.id < b.id ? -1 : 1); });
      return out;
    }
  };

  root.CASES = Cases;
})();
