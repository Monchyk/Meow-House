/* Scene registry — the one place scenes announce themselves.
 *
 * A "scene" is a director class compatible with the Party host: it takes
 * (canvas, opts) and exposes draw(dt), pop(amount), and the mutable props
 * `zoom` and `substrate`. Historically a scene became the host by clobbering
 * window.AmbientDirector (see the old tail of meowparty-scene.js). That allowed
 * exactly one scene per page. Now scenes REGISTER instead, and player.js installs
 * a single host that can swap between them live.
 *
 * Load order matters: this file first, then each scene module (they call
 * SCENES.register at load), then player.js (installs the host), then party-main.js.
 */
(function (root) {
  "use strict";

  var scenes = [];
  var byId = {};
  var activeId = null;
  var listeners = [];

  root.SCENES = {
    /* factory: function(canvas, opts) -> director instance
     * opts: { duration, show }. show:true puts the scene in the curated autoplay
     * story. Every registered scene remains available for manual selection. */
    register: function (id, label, factory, opts) {
      if (byId[id]) return;                 // first registration wins, idempotent
      var entry = { id: id, label: label, factory: factory,
        duration: opts && opts.duration != null ? opts.duration : null,
        show: !!(opts && opts.show) };
      byId[id] = entry;
      scenes.push(entry);
    },
    list: function () { return scenes.slice(); },
    showList: function () { return scenes.filter(function (scene) { return scene.show; }); },
    get: function (id) { return byId[id] || null; },
    has: function (id) { return !!byId[id]; },
    firstId: function () { return scenes.length ? scenes[0].id : null; },
    indexOf: function (id) {
      for (var i = 0; i < scenes.length; i++) if (scenes[i].id === id) return i;
      return -1;
    },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    get activeId() { return activeId; },
    set activeId(v) {
      activeId = v;
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](v); } catch (e) {} }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
