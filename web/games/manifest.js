/* games/manifest.js — the ONE list of shipped game ids.
 *
 * P0-1: the roster used to live in two hand-maintained places — a <script> line per game in
 * game.html and a `REAL = [...]` array in tools/party-tests/game.test.js. At five games that
 * drifts quietly; at fifty it drifts constantly. One array, two readers:
 *   · the browser — this file emits the <script> tags itself (document.write during parse,
 *     so load order is preserved: registry → games → shell)
 *   · the tests   — require() it and load every id, so a new game is covered the moment it
 *     is listed here and can never ship unlisted-but-loaded (or listed-but-missing).
 *
 * ADDING A GAME IS ONE LINE HERE. Nothing else — do not hand-add per-game <script> tags to
 * game.html, and do NOT put defer/async/type=module on this tag: the emit below runs during
 * the initial parse and is a silent no-op once the document has finished loading.
 *
 * Dual export (house convention): window in the browser, globalThis/module in node.
 */
(function (root) {
  "use strict";

  var MANIFEST = [
    // — shipped arcade games (pre-Part-Game) —
    "lockpick",
    "clockwork",
    "spiralweaver",
    "fireflies",
    "lightpath",

    // -- Phase 1: the ten reusable Tier-1A classic engines, one skin each --
    "oddone",
    "sorting",
    "sequence",
    "mastermind",
    "simon",
    "memory",
    "higherlower",
    "rangeguess",
    "stopbar",
    "spotdiff",

    // -- Tier 3 spirit-matches: bespoke games, one idea each --
    "seed"
  ];

  root.GameManifest = MANIFEST;
  if (typeof module !== "undefined" && module.exports) module.exports = MANIFEST;

  // Browser: emit one <script> per id, in manifest order. Only during the initial parse —
  // a late document.write would blow away the document, so guard on readyState.
  if (typeof document !== "undefined" && document.write && document.readyState === "loading") {
    for (var i = 0; i < MANIFEST.length; i++)
      document.write('<script src="games/' + MANIFEST[i] + '.js"><\/script>');
  }
})(typeof window !== "undefined" ? window : globalThis);
