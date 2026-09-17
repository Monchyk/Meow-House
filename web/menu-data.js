/* menu-data.js — the category registry for the Deep House game menu.
 *
 * DATA-DRIVEN, pluggable in the same spirit as games/registry.js: a category (a "room")
 * is a plain record; the menu shell (menu.js) reads the roster and hard-codes no room.
 * GROWING THE MENU IS A DATA EDIT — copy a block, give it a name, a spiral to point at,
 * and its games. No shell change, no new file per room.
 *
 *   category = {
 *     id:       unique string
 *     name:     shown in the hub + room (rename freely)
 *     exhibit:  a spiral title from SYM (the room's faint backdrop; repoint to anything)
 *     palette:  atlas palette index (colours the filling meter)
 *     games:    [game ids from games/registry.js] — completion is DERIVED from these
 *   }
 *
 * NO static `progress` field: a room's % is DERIVED live from the solved-store
 * (menu-progress.js) over its `games`. The single write site is the arcade's DEPLOY
 * (game.js → store.markSolved); the menu is read-only over the store.
 *
 * Dual export (house convention): window in the browser, globalThis in node.
 */
(function (root) {
  "use strict";

  var CATS = [];

  var MenuData = {
    // register a room. Minimal shape check — a malformed room fails loudly at load,
    // never becomes a dead hub slot the visitor selects into nothing.
    registerCategory: function (def) {
      if (!def || typeof def.id !== "string" || def.id.length === 0)
        throw new Error("registerCategory: need a non-empty string id");
      if (CATS.some(function (c) { return c.id === def.id; }))
        throw new Error("registerCategory: duplicate id '" + def.id + "'");
      CATS.push({
        id: def.id,
        name: (typeof def.name === "string" && def.name) ? def.name : def.id,
        exhibit: (typeof def.exhibit === "string" && def.exhibit) ? def.exhibit : "Logarithmic spiral",
        palette: def.palette | 0,
        games: Array.isArray(def.games) ? def.games.slice() : []
      });
      return def;
    },
    all: function () { return CATS.slice(); },
    get: function (id) { return CATS.filter(function (c) { return c.id === id; })[0] || null; },
    count: function () { return CATS.length; },
    _reset: function () { CATS.length = 0; }    // tests only
  };

  /* ── the two rooms (K.'s taxonomy pick A: Math / Logic; 5 games, disjoint) ────
   * EVERY game in games/manifest.js is placed; none orphaned. An orphan is UNREACHABLE —
   * menu.html is the front door and BROWSE is room-scoped — yet every other test would still
   * pass, so game.test.js asserts the placement both ways. Add a room = another block. */
  MenuData.registerCategory({
    id: "math", name: "Math", exhibit: "Epicycloid gears", palette: 3,
    games: ["clockwork", "fireflies", "spiralweaver", "sequence", "higherlower", "rangeguess"]
  });
  MenuData.registerCategory({
    id: "logic", name: "Logic", exhibit: "String art", palette: 9,
    games: ["lockpick", "lightpath", "oddone", "sorting", "mastermind", "spotdiff"]
  });
  MenuData.registerCategory({
    id: "nerve", name: "Nerve", exhibit: "Standing wave", palette: 5,
    games: ["simon", "memory", "stopbar"]
  });
  // The spirit-matches. Name and grouping are K.'s call; the room exists because an
  // unplaced game is unreachable from the front door and game.test.js fails on it.
  MenuData.registerCategory({
    id: "nature", name: "Nature", exhibit: "Phyllotaxis", palette: 0,
    games: ["seed"]
  });

  root.MenuData = MenuData;
  if (typeof module !== "undefined" && module.exports) module.exports = MenuData;
})(typeof window !== "undefined" ? window : globalThis);
