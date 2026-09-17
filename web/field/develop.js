/* develop.js — the lockpick. Binds a star to an exhibit and watches for σ-lock.
 *
 * This is where the Gallery stops being a museum. DESIGN.md's cut test asks of
 * every feature: "how does this help the house communicate?" — 38 beautiful
 * exhibits answered "it doesn't, it's pretty." Here each one becomes a
 * particular star's PORTRAIT, and tuning it from chaos to symmetry is the act
 * of understanding that star.
 *
 * Reuses web/viz/symmetry.js wholesale: SymmetryGallery already instantiates
 * all 66 exhibits and owns nudge()/sigma()/tune. We only choose the index.
 * Nothing here draws.
 *
 * The house still drags your tune back when it is stressed (brain.js's existing
 * gallery coupling), so a dysregulated house is genuinely harder to read. That
 * is mechanic-before-theme working correctly, not a difficulty setting.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  /* FNV-1a: small, stable, and identical in node and the browser. The binding
   * must never drift between runs — a star's portrait is part of its identity. */
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  var Develop = {
    _cfg: null,

    init: function (cfg) {
      this._cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.develop) || {};
      return this;
    },

    /* Which of the `count` exhibits is this star's portrait?
     *
     * With exhibitByCommunity, a district shares a visual family: the district
     * picks a contiguous band of the exhibit list and the node picks within it,
     * so neighbours rhyme without repeating. Deterministic either way. */
    exhibitIndexFor: function (node, count) {
      if (!count) return 0;
      var h = hash(node.id);
      if (this._cfg && this._cfg.exhibitByCommunity) {
        var bands = 8;                                  // families across the set
        var band = node.c % bands;
        var span = Math.max(1, Math.floor(count / bands));
        return (band * span + (h % span)) % count;
      }
      return h % count;
    },

    /* Point an existing SymmetryGallery at this star and reset the tune, so
     * every star begins in chaos. */
    open: function (gallery, node) {
      if (!gallery || !node) return null;
      var n = (gallery.exhibits && gallery.exhibits.length) || 0;
      gallery.index = this.exhibitIndexFor(node, n);
      gallery.tune = -0.7;                 // matches SymmetryGallery.next()
      gallery.locked = false;
      if (gallery.reset) gallery.reset();
      return gallery.index;
    },

    /* Has this star just resolved? Returns true exactly once per star. */
    check: function (gallery, node, progress) {
      if (!gallery || !node || !progress) return false;
      var lock = (this._cfg && this._cfg.lockSigma) || 0.9;
      if (gallery.sigma() < lock) return false;
      if (progress.isDeveloped(node.id)) return false;
      return progress.develop(node.id, gallery.sigma());
    },

    /* Two of the 38 (primeSpiral, sacksSpiral) pin q at 0.5 and are therefore
     * un-lockable by design — contemplative animations, not tunable ones. A
     * star bound to one of those could never be developed, which would read as
     * a broken star rather than a quiet one. Callers use this to re-bind. */
    isLockable: function (gallery, index) {
      if (!gallery || !gallery.exhibits) return true;
      var ex = gallery.exhibits[index];
      if (!ex) return true;
      var probe = Object.create(ex);
      probe.q = 0.06;
      try { probe.update(0.016, 1); } catch (e) { return true; }
      return probe.q > 0.06;               // did tune move it at all?
    },

    /* Pick the first lockable exhibit at or after the bound one. */
    bind: function (gallery, node) {
      var n = (gallery.exhibits && gallery.exhibits.length) || 0;
      var idx = this.exhibitIndexFor(node, n);
      for (var i = 0; i < n; i++) {
        var cand = (idx + i) % n;
        if (this.isLockable(gallery, cand)) return cand;
      }
      return idx;
    }
  };

  root.DEVELOP = Develop;
})();
