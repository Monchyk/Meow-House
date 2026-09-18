/* Scene: Party (baseline). The real Party director, unwrapped — the canonical
 * "ebb and flow" every other scene starts from (scenes.md §Scene Forge baseline).
 *
 * Loaded after symmetry.js (which defines the real AmbientDirector) and before
 * player.js (which replaces AmbientDirector with the swapping host). Capturing
 * root.AmbientDirector here therefore grabs the genuine Party director, not the host.
 * Registering it makes the raw baseline a first-class, switchable scene, which also
 * gives the live switcher a guaranteed second option to prove the swap works.
 */
(function (root) {
  "use strict";

  var PartyDirector = root.AmbientDirector;
  if (!PartyDirector || !root.SCENES) return;

  root.SCENES.register("party", "Party (baseline)", function (canvas, opts) {
    var d = new PartyDirector(canvas, opts);
    d.zoom = true; // this scene IS the whole projection; the zoom pendulum is welcome
    return d;
  });
})(typeof window !== "undefined" ? window : globalThis);
