/* games/registry.js — the pluggable minigame registry.
 *
 * One shape, ~20 possible games. A game file calls Game.register({...}) on load;
 * the shell (game.js) reads the roster and never needs to know the games by name.
 * Adding a game = one games/<id>.js file + one <script> line in game.html.
 *
 * Dual export (house convention): attaches to window in the browser, to globalThis
 * in node so the headless suites can require it. Same object either way.
 *
 * A registered game (see the contract in game.js / the architecture doc):
 *   { id, title, deploy:{exhibit, palette, organism?}, create(host) → instance }
 *   instance: { enter(), input(action)→handled?, update(dt), draw(ctx,w,h,dt), exit() }
 *   input() for 'back' MAY return truthy to CONSUME it as undo; falsy (or any other
 *   action) lets the shell apply its default (Back with nothing to undo exits PLAY).
 * The registry validates the DECLARATION only; the instance contract is the shell's.
 */
(function (root) {
  "use strict";

  var GAMES = [];

  // Minimal shape check — a malformed game must fail loudly at register time, not
  // silently produce a dead roster slot the visitor can select into nothing.
  function valid(def) {
    return !!def
      && typeof def.id === "string" && def.id.length > 0
      && typeof def.title === "string" && def.title.length > 0
      && def.deploy && typeof def.deploy.exhibit === "string"
      && typeof def.create === "function"
      && validInput(def.input);
  }

  // The OPTIONAL input declaration: a game may name the controls a rich controller (a
  // phone) should render — a list of { intent, id, label?, range? }. Absent = a plain
  // 4-button game, exactly as before. Present-but-malformed fails loudly, like the rest.
  // The shell (game.js) turns this into a phone `declare`; nothing here renders it.
  function validInput(input) {
    if (input == null) return true;
    return Array.isArray(input) && input.every(function (d) {
      return d && typeof d.intent === "string" && d.intent.length > 0
               && typeof d.id === "string" && d.id.length > 0;
    });
  }

  var Game = {
    register: function (def) {
      if (!valid(def)) throw new Error("Game.register: malformed game definition (need id, title, deploy.exhibit, create; optional input = array of {intent,id})");
      if (GAMES.some(function (g) { return g.id === def.id; }))
        throw new Error("Game.register: duplicate id '" + def.id + "'");
      GAMES.push(def);
      return def;
    },
    // P0-3 — engines × skins. A Tier-1A engine is `makeEngine(config) → create(host)`;
    // a skin is a plain data record { id, title, deploy, ...config }. Ten engines with
    // three-to-six skins each must not become sixty near-identical files, so the skin
    // list registers itself against one factory. Same validation as register(): a bad
    // skin still fails loudly, at load, one at a time.
    registerSkins: function (makeEngine, skins) {
      if (typeof makeEngine !== "function")
        throw new Error("Game.registerSkins: need an engine factory makeEngine(config) → create(host)");
      if (!Array.isArray(skins) || skins.length === 0)
        throw new Error("Game.registerSkins: need a non-empty skins array");
      return skins.map(function (skin) {
        if (!skin || typeof skin !== "object") throw new Error("Game.registerSkins: malformed skin");
        var create = makeEngine(skin);
        if (typeof create !== "function")
          throw new Error("Game.registerSkins: makeEngine('" + skin.id + "') did not return create(host)");
        return Game.register({ id: skin.id, title: skin.title, deploy: skin.deploy, create: create, input: skin.input });
      });
    },
    all: function () { return GAMES.slice(); },
    get: function (id) { return GAMES.filter(function (g) { return g.id === id; })[0] || null; },
    count: function () { return GAMES.length; },
    // tests only: clear the roster so each suite starts from a known state
    _reset: function () { GAMES.length = 0; }
  };

  root.Game = Game;
  if (typeof module !== "undefined" && module.exports) module.exports = Game;
})(typeof window !== "undefined" ? window : globalThis);
