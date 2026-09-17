/* progress.js — what the house remembers about YOU, across visits.
 *
 * Deliberately separate from house.js's own memory. house.js keeps mood
 * residue (three floats, faded); this keeps the record of what you developed,
 * how you read it, and which cases you walked. Mood decays. Progress does not.
 *
 * Versioned, because a schema change must never hard-crash a returning
 * visitor's field — an unreadable or stale record is silently replaced with a
 * fresh one rather than thrown.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function now() { return Date.now(); }

  var Progress = {
    data: null,
    _cfg: null,
    _dirty: false,
    _since: 0,

    blank: function () {
      return {
        schema: (this._cfg && this._cfg.schema) || 1,
        runs: 0,
        firstSeen: now(),
        lastSeen: now(),
        developed: {},   // id -> { at, sigma }
        readings: {},    // id -> { feel, match }   the visitor's own naming
        cases: {},       // caseId -> { walked, at }
        visited: {},     // id -> count
        phase: 1
      };
    },

    init: function (cfg, storage) {
      this._cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.progress) || { key: "deephouse.progress", schema: 1 };
      this._store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      this.data = this._load() || this.blank();
      this.data.runs++;
      this.data.lastSeen = now();
      this._dirty = true;
      return this;
    },

    _load: function () {
      if (!this._store) return null;
      try {
        var raw = this._store.getItem(this._cfg.key);
        if (!raw) return null;
        var d = JSON.parse(raw);
        if (!d || d.schema !== this._cfg.schema) return null;  // migrate = restart
        /* shape guard: a truncated or hand-edited record must not crash the walk */
        if (!d.developed || !d.cases || !d.readings) return null;
        return d;
      } catch (e) { return null; }
    },

    save: function () {
      if (!this._store) return false;
      try {
        this._store.setItem(this._cfg.key, JSON.stringify(this.data));
        this._dirty = false;
        return true;
      } catch (e) { return false; }   // private mode / quota: play on regardless
    },

    frame: function (dt) {
      this._since += dt;
      var every = (this._cfg && this._cfg.autosaveEvery) || 5;
      if (this._dirty && this._since >= every) { this._since = 0; this.save(); }
    },

    /* ---------------------------------------------------------- recording */
    visit: function (id) {
      this.data.visited[id] = (this.data.visited[id] || 0) + 1;
      this._dirty = true;
      return this.data.visited[id] === 1;      // true = never been here before
    },
    develop: function (id, sigma) {
      if (this.data.developed[id]) return false;
      this.data.developed[id] = { at: now(), sigma: sigma };
      this._dirty = true;
      return true;
    },
    read: function (id, feel, match) {
      this.data.readings[id] = { feel: feel, match: !!match };
      this._dirty = true;
    },
    walkCase: function (caseId) {
      if (this.data.cases[caseId] && this.data.cases[caseId].walked) return false;
      this.data.cases[caseId] = { walked: true, at: now() };
      this._dirty = true;
      return true;
    },
    setPhase: function (p) {
      if (this.data.phase === p) return false;
      this.data.phase = p; this._dirty = true; return true;
    },

    /* ------------------------------------------------------------ reading */
    isDeveloped: function (id) { return !!this.data.developed[id]; },
    developedCount: function () { return Object.keys(this.data.developed).length; },
    casesWalked: function () {
      var n = 0;
      for (var k in this.data.cases) if (this.data.cases[k].walked) n++;
      return n;
    },
    runCount: function () { return this.data.runs; },

    /* Stars from an EARLIER visit — what nostalgia reaches for. A star
     * developed during this run is not a memory yet. */
    remembered: function (bootTime) {
      var out = [], t = bootTime || this._bootedAt || 0;
      for (var id in this.data.developed)
        if (this.data.developed[id].at < t) out.push(id);
      return out;
    },
    markBoot: function () { this._bootedAt = now(); return this; },

    reset: function () {
      this.data = this.blank();
      this._dirty = true; this.save();
      return this;
    }
  };

  root.PROGRESS = Progress;
})();
