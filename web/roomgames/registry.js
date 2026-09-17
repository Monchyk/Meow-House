/* roomgames/registry.js — the pluggable ROOM-GAME contract.
 *
 * Sibling of games/registry.js, but for the Jackbox-style big-screen host (roomhost.js)
 * instead of the 4-button arcade. A room game is a plain object; the host shell owns the
 * relay, the players, the scoreboard and the render loop — a game owns only its rules.
 *
 * A game def:
 *   {
 *     id, title, blurb,            // identity + the picker card
 *     minPlayers,                  // the lobby's Start button unlocks at this many
 *     rounds,                      // how many rounds a match runs (host loops the game)
 *     start(H),                    // a round begins — declare controls, seed H.g
 *     onIntent(H, player, id, v),  // a phone interacted
 *     onJoin(H, player),           // someone joined mid-game (optional)
 *     advance(H),                  // the host operator pressed SPACE / clicked (optional)
 *     render(H, X, layout),        // draw the big screen (browser only; X = 2d ctx)
 *     tick(H, dt)                  // per-frame juice (browser only; optional)
 *   }
 * The logic hooks (start/onIntent/onJoin/advance) are PURE — they mutate H.g and call
 * H.declare/H.score/H.setPhase, never touch the DOM — so room.test.js drives them headless.
 * render/tick are browser-only and never called by the pure core.
 *
 * Dual export as root.RoomGame (browser) / module.exports (node), same discipline as
 * play.js, menu.js, games/registry.js.
 */
(function (root) {
  "use strict";

  var REGISTRY = {};
  var ORDER = [];

  var RoomGame = {
    register: function (def) {
      if (!def || !def.id) throw new Error("roomgame: a def needs an id");
      if (REGISTRY[def.id]) throw new Error("roomgame: duplicate id " + def.id);
      REGISTRY[def.id] = def;
      ORDER.push(def.id);
      return def;
    },
    get: function (id) { return REGISTRY[id] || null; },
    all: function () { return ORDER.map(function (id) { return REGISTRY[id]; }); },
    ids: function () { return ORDER.slice(); },
    _reset: function () { REGISTRY = {}; ORDER = []; }   // tests only
  };

  root.RoomGame = RoomGame;
  if (typeof module !== "undefined" && module.exports) module.exports = RoomGame;
})(typeof window !== "undefined" ? window : globalThis);
