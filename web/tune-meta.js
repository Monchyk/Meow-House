/* tune-meta.js — the tuning-desk metadata as SHARED data.
 *
 * Extracted verbatim from dashboard.js (2026-08-11) so BOTH the curator dashboard
 * (dashboard.js) and the synth patchbay (synth.js) render the same knobs from ONE
 * source of truth — label, range, step, group, and the plain-language hint.
 *
 * RULE FOR `h` (unchanged): describe the ROOM, not the maths. "how quickly it sinks
 * back to rest", never "decayRate, per second". If a line can only be understood by
 * first reading party.js, it is the wrong line.
 *
 * `Lo`/`Hi` pairs are the two ends of the σ swing — chaos and order.
 *
 * Browser (window.TUNE) + bare node (module.exports), guarded — same dual-export
 * discipline as palettes.js / party.js.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  var TUNE = [
    // First, deliberately: it is the one control that moves everything else. Every
    // slider below is a rate RELATIVE to this one.
    { g: "The room", k: "bpm",           t: "master tempo",    min: 12,  max: 200,  st: 1,
      h: "the heartbeat everything runs on — screen, colours and lamps together. 120 = the old speed; lower = slower and wider" },
    { g: "The room", k: "slideshowAfter", t: "slideshow after", min: 0,  max: 600,  st: 5,
      h: "seconds of nobody touching anything before the room starts running itself — 0 = never. the first touch hands it straight back. try 90" },
    { g: "The room", k: "randomiseSpread", t: "dice reach",     min: 0.05, max: 1,  st: 0.05,
      h: "how far “randomise all” may stray. 1 = anywhere on every slider; lower = a variation on what is already on screen, so you can build on a card instead of losing it" },
    { g: "The room", k: "floor",         t: "resting energy",  min: 0,   max: 0.6,  st: 0.02,
      h: "where the room settles when nobody touches it" },
    { g: "The room", k: "energyCap",     t: "energy ceiling",  min: 0.2, max: 1,    st: 0.05,
      h: "hard limit on how bright it can ever get — the anti-strobe guard" },
    { g: "The room", k: "decayRate",     t: "wind-down speed", min: 0,   max: 0.05, st: 0.001,
      h: "how quickly it sinks back to rest once left alone" },
    { g: "The room", k: "driveRate",     t: "push speed",      min: 0.1, max: 2,    st: 0.05,
      h: "how fast holding a brightness button raises the room" },
    { g: "The room", k: "contrastFloor", t: "calm palettes",   min: 0,   max: 1,    st: 0.05,
      h: "how much energy a gentle colour scheme is still allowed" },
    { g: "The room", k: "paletteFade",   t: "colour drift",    min: 0,   max: 30,   st: 0.5,
      h: "seconds for one light-scene to melt into the next (0 = hard cut)" },
    { g: "The room", k: "palettePushHz", t: "drift smoothness", min: 1,  max: 20,   st: 1,
      h: "how many times a second the lamps are updated mid-drift (higher = smoother, louder on the wire)" },
    { g: "The room", k: "lampBrightBand", t: "lamp breath",     min: 0,   max: 0.8,  st: 0.02,
      h: "how far each lamp's brightness swings between its floor and ceiling. wide = a fire; zero = a flat wash that reads as dead. the room's aliveness comes from lamps being out of step with each other, so this can sit low" },
    { g: "The room", k: "lampFlow",      t: "lamp brightness", min: 0,   max: 2,    st: 0.05,
      h: "how much light the lamps push, independent of speed. this used to hang off the master tempo, so slowing the room down also darkened it — now you can have slow AND bright. 1 = the level everything was tuned at" },

    { g: "The spiral", k: "swingFreqBase", t: "sway at rest",    min: 0,   max: 1, st: 0.02,
      h: "how fast the pattern breathes when the room is quiet" },
    { g: "The spiral", k: "swingFreqGain", t: "sway when busy",  min: 0,   max: 4, st: 0.1,
      h: "how much faster it breathes when people push it" },
    { g: "The spiral", k: "swingRange",    t: "how far it goes", min: 0.1, max: 1, st: 0.05,
      h: "full = all the way from chaos to symmetry; less = stays nearer the middle" },
    { g: "The spiral", k: "dwellSeconds",  t: "pause at the end", min: 0, max: 20, st: 0.5,
      h: "how long it holds still on arriving at an end of the swing — the reward is watching it re-enter motion. needs “pause at” switched on above" },

    { g: "The spiral", k: "overlapAmount", t: "overlap strength", min: 0, max: 1, st: 0.05,
      h: "how strongly the previous shape shows through behind the new one" },
    { g: "The spiral", k: "overlapFade",   t: "overlap linger",  min: 1, max: 60, st: 1,
      h: "seconds the previous shape takes to fade away (transition mode only)" },

    { g: "The colours", k: "colorSpreadChaos", t: "colours · chaos", min: 0.15, max: 1, st: 0.05,
      h: "how much of the scheme is on screen while the pattern is scattered — full = every colour it has" },
    { g: "The colours", k: "colorSpreadOrder", t: "colours · order", min: 0.15, max: 1, st: 0.05,
      h: "…and once it resolves. Low = it converges toward one colour as it finds symmetry; high = it stays rich all the way through" },
    { g: "The colours", k: "colorAttack", t: "ADSR · attack", min: 0.1, max: 8, st: 0.1,
      h: "how quickly colour brightness arrives after a new motion begins" },
    { g: "The colours", k: "colorDecay", t: "ADSR · decay", min: 0.1, max: 12, st: 0.1,
      h: "how quickly the bright edge settles down, reducing bleed without stopping the shape" },
    { g: "The colours", k: "colorSustain", t: "ADSR · sustain", min: 0, max: 1, st: 0.05,
      h: "the brightness held while the scene stands still or breathes slowly" },
    { g: "The colours", k: "colorRelease", t: "ADSR · release", min: 0.1, max: 16, st: 0.1,
      h: "how gently colour leaves after a standstill or counter-intuitive pause" },
    { g: "The colours", k: "colorBleed", t: "bleed clear", min: 0, max: 0.3, st: 0.01,
      h: "extra clearing between frames — higher removes pixel trails faster and keeps the colours crisp" },

    { g: "The organism", k: "orgAmount", t: "organism mix", min: 0, max: 1, st: 0.05,
      h: "how much a living organism takes over the screen from the spiral. 0 = pure pattern (the room today); 1 = all creature; in between, both at once. pick which creatures below" },
    { g: "The organism", k: "orgFerro",  t: "Me Julie",     min: 0, max: 1, st: 0.05,
      h: "the ferrofluid core — a dark centre that won't burn, light only on her reaching thorns, the thorns rising as the room's energy climbs. the organism the whole house is built around" },
    { g: "The organism", k: "orgSyn",    t: "synaptic",     min: 0, max: 1, st: 0.05,
      h: "neurons firing along the web — sparks travelling point to point, scattered when chaotic, beating in rhythm once it settles" },
    { g: "The organism", k: "orgSlime",  t: "slime mold",   min: 0, max: 1, st: 0.05,
      h: "living veins creeping out to join the points, the way a slime mold reaches between food — messy at chaos, a clean network at symmetry" },
    { g: "The organism", k: "orgFluid",  t: "superfluid",   min: 0, max: 1, st: 0.05,
      h: "light flooding through the channels, each point breathing as it passes — turbulent when chaotic, a smooth glide once resolved" },
    { g: "The organism", k: "orgVicsek", t: "murmuration",  min: 0, max: 1, st: 0.05,
      h: "a flock of little movers — scattered every-which-way at chaos, all turning to face one direction as it finds symmetry" },
    { g: "The organism", k: "orgWiring", t: "wiring",       min: 0, max: 1, st: 0.05,
      h: "cells reaching out with fine feelers until they touch, lock together and light up a lattice \u2014 it brings its own rainbow instead of the room's colours, and settles into a gradient. 0 turns it off entirely" },
    { g: "The organism", k: "orgGlow",   t: "brightness",   min: 0, max: 1, st: 0.05,
      h: "master brightness for the whole organism — it glows ON TOP of the spiral, so this is the knob that stops it washing out. low is calm, high is hot" },
    { g: "The organism", k: "orgPlace",  t: "reach out",    min: 0, max: 1, st: 0.05,
      h: "how far the organism grows out — 0 = a shape in the middle mixed with the spiral; 1 = the whole thing (slime too) grows out to fill the screen into the corners, like the glowing orbs flood the sides. the spiral still shows through" },
    { g: "The organism", k: "orgPlaceMode", t: "grow style", min: 0, max: 3, st: 1,
      h: "how the growing moves: 0–2 = a steady reach out, 3 = it breathes in and out with the room (more growth shapes may come)" },
    { g: "The organism", k: "orgPossess", t: "grow on the spiral", min: 0, max: 1, st: 0.05,
      h: "how much the organism grows ON the spiral instead of floating over it — the slime crawls the spiral's bright lines, the flock traces its arms, so the two become one" },

    { g: "The dive", k: "zoomMax",     t: "depth",  min: 1,   max: 6, st: 0.1,
      h: "how far it travels at its deepest — and only when pumped; a calm room barely dives" },
    { g: "The dive", k: "zoomRatio",   t: "rate",   min: 0.1, max: 2, st: 0.05,
      h: "dives per breath — 0.5 means one dive every two" },
    { g: "The dive", k: "zoomFit",     t: "zoom-out", min: 0.15, max: 1, st: 0.05,
      h: "in-frame mode: how small the picture shrinks at the deepest dive (0.4 = down to 40% of the frame, then back to full). 1 = no shrink" },
    { g: "The dive", k: "zoomFalloff", t: "spread", min: 1,   max: 5, st: 0.1,
      h: "off-screen mode only: lower = a broad soft swell, higher = a tight bulge in the middle" },

    { g: "The nucleus", k: "bloomCoreLo",        t: "well size · chaos",   min: 0, max: 1, st: 0.01,
      h: "the glow at the centre, while the pattern is scattered" },
    { g: "The nucleus", k: "bloomCoreHi",        t: "well size · order",   min: 0, max: 1, st: 0.01,
      h: "…and once it has resolved" },
    { g: "The nucleus", k: "bloomCoreAlphaLo",   t: "well glow · chaos",   min: 0, max: 0.4, st: 0.005,
      h: "how brightly the centre burns while scattered" },
    { g: "The nucleus", k: "bloomCoreAlphaHi",   t: "well glow · order",   min: 0, max: 0.4, st: 0.005,
      h: "…and once resolved" },
    { g: "The nucleus", k: "bloomReachLo",       t: "flow reach · chaos",  min: 0, max: 1.2, st: 0.02,
      h: "how far the streams get toward the corners while scattered" },
    { g: "The nucleus", k: "bloomReachHi",       t: "flow reach · order",  min: 0, max: 1.2, st: 0.02,
      h: "…once resolved. Full = the light actually arrives in the corners" },
    { g: "The nucleus", k: "bloomFlowLo",        t: "flow speed · chaos",  min: 0.02, max: 1.5, st: 0.02,
      h: "chaos races — normally the faster of the two" },
    { g: "The nucleus", k: "bloomFlowHi",        t: "flow speed · order",  min: 0.02, max: 1.5, st: 0.02,
      h: "order glides" },
    { g: "The nucleus", k: "bloomDrops",         t: "stream density",      min: 1, max: 20, st: 1,
      h: "how many pulses travel along each stream at once" },
    { g: "The nucleus", k: "bloomDropRadLo",     t: "pulse size · chaos",  min: 0.01, max: 0.5, st: 0.01,
      h: "size of each travelling pulse while scattered" },
    { g: "The nucleus", k: "bloomDropRadHi",     t: "pulse size · order",  min: 0.01, max: 0.5, st: 0.01,
      h: "…once resolved" },
    { g: "The nucleus", k: "bloomDropAlphaLo",   t: "pulse glow · chaos",  min: 0, max: 0.3, st: 0.005,
      h: "brightness of each pulse while scattered" },
    { g: "The nucleus", k: "bloomDropAlphaHi",   t: "pulse glow · order",  min: 0, max: 0.3, st: 0.005,
      h: "…once resolved" },
    { g: "The nucleus", k: "bloomCornerAlphaLo", t: "corner glow · chaos", min: -0.2, max: 0.3, st: 0.005,
      h: "keep this NEGATIVE — it holds the corners fully dark until the pattern resolves, and that delay is the whole arrival gesture" },
    { g: "The nucleus", k: "bloomCornerAlphaHi", t: "corner glow · order", min: -0.2, max: 0.3, st: 0.005,
      h: "how brightly the corners light once the flood reaches them" },
    { g: "The nucleus", k: "bloomCornerRadLo",   t: "corner size · chaos", min: 0.02, max: 0.8, st: 0.01,
      h: "size of the corner pools while scattered" },
    { g: "The nucleus", k: "bloomCornerRadHi",   t: "corner size · order", min: 0.02, max: 0.8, st: 0.01,
      h: "…once resolved" },
    { g: "The nucleus", k: "bloomFlareAmp",      t: "press flash",         min: 0, max: 5, st: 0.1,
      h: "how much brighter everything goes for a beat when something is earned" },
    { g: "The nucleus", k: "bloomFlareReach",    t: "press shove",         min: 0, max: 1, st: 0.02,
      h: "how much further that flash throws the streams outward" },
  ];

  root.TUNE = TUNE;
  if (typeof module !== "undefined" && module.exports) module.exports = TUNE;
})();
