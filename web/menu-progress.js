/* menu-progress.js — the completion-% framework for the Part Game menu.
 *
 * ONE source of truth for "which games are solved": an injectable store (same discipline
 * as game.js's host.now()/host.rng — a bare localStorage reach inside render is not
 * headless-testable, so it is forbidden). The arcade WRITES (single site: DEPLOY landed →
 * markSolved). The menu READS (room % + global %). Progress is DERIVED from the store,
 * never a hand-set field.
 *
 *   store.solved(id)     -> bool      solved at least once
 *   store.markSolved(id) -> void      idempotent; the ONLY write site (game.js DEPLOY)
 *   store.solvedSet()    -> string[]  for aggregation
 *   store.reset()        -> void      tests / kiosk clear
 *
 * Adapters (createStore picks one; an explicit opts.store always wins):
 *   · LocalStore — browser, backs localStorage["dh-game-solved"] (a JSON array of ids);
 *     every read/write in try/catch, absent/malformed → empty set, never throws into render.
 *   · MemStore   — plain in-memory Set, no globals; the node/test default.
 *
 * Derivation is pure over (store, roster). Global % is COUNT-WEIGHTED — each of the 5 games
 * is an equal 1/5 (an unweighted room-mean would distort a 3-game room vs a 2-game room).
 * Dual export (window / globalThis), node-requireable.
 */
(function (root) {
  "use strict";

  var KEY = "dh-game-solved";

  // ── MemStore: no globals, the node/test default ────────────────────────────
  function MemStore() {
    var set = Object.create(null);
    return {
      solved: function (id) { return !!set[id]; },
      markSolved: function (id) { if (typeof id === "string" && id) set[id] = true; },
      solvedSet: function () { return Object.keys(set); },
      reset: function () { for (var k in set) delete set[k]; }
    };
  }

  // ── LocalStore: browser, JSON array under one key, never throws into render ──
  function LocalStore(ls) {
    function read() {
      try {
        var raw = ls.getItem(KEY);
        if (!raw) return Object.create(null);
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return Object.create(null);
        var s = Object.create(null);
        for (var i = 0; i < arr.length; i++) if (typeof arr[i] === "string") s[arr[i]] = true;
        return s;
      } catch (e) { return Object.create(null); }
    }
    function write(s) { try { ls.setItem(KEY, JSON.stringify(Object.keys(s))); } catch (e) {} }
    return {
      solved: function (id) { return !!read()[id]; },
      markSolved: function (id) {
        if (typeof id !== "string" || !id) return;
        var s = read(); if (s[id]) return;   // idempotent — a re-solve is not a second write
        s[id] = true; write(s);
      },
      solvedSet: function () { return Object.keys(read()); },
      reset: function () { try { ls.removeItem(KEY); } catch (e) {} }
    };
  }

  // pick a store: explicit opts.store wins; else localStorage if present; else memory.
  function createStore(opts) {
    opts = opts || {};
    if (opts.store) return opts.store;
    try {
      var ls = (typeof localStorage !== "undefined" && localStorage) ? localStorage
             : (root.localStorage || null);
      if (ls) return LocalStore(ls);
    } catch (e) {}
    return MemStore();
  }

  // ── derivation: pure functions over (store, roster) ─────────────────────────
  // count solved among a list of (assumed-unique) game ids.
  function countSolvedIn(ids, store) {
    if (!ids || !store) return 0;
    var n = 0;
    for (var i = 0; i < ids.length; i++) if (store.solved(ids[i])) n++;
    return n;
  }
  // one room's fill 0..1 = solved-in-room / games-in-room (0 for an empty room).
  function roomProgress(cat, store) {
    var g = (cat && cat.games) || [];
    return g.length ? countSolvedIn(g, store) / g.length : 0;
  }
  // whole-menu fill 0..1, count-weighted over the UNIQUE game ids across the roster.
  function globalProgress(cats, store) {
    if (!cats || !store) return 0;
    var seen = Object.create(null), ids = [];
    for (var i = 0; i < cats.length; i++) {
      var g = cats[i].games || [];
      for (var j = 0; j < g.length; j++) if (!seen[g[j]]) { seen[g[j]] = true; ids.push(g[j]); }
    }
    return ids.length ? countSolvedIn(ids, store) / ids.length : 0;
  }

  var MenuProgress = {
    createStore: createStore, MemStore: MemStore, LocalStore: LocalStore,
    countSolvedIn: countSolvedIn, roomProgress: roomProgress, globalProgress: globalProgress,
    KEY: KEY
  };
  root.MenuProgress = MenuProgress;
  if (typeof module !== "undefined" && module.exports) module.exports = MenuProgress;
})(typeof window !== "undefined" ? window : globalThis);
