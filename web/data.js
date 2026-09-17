/* data.js — display-safe emotion data.
 *
 * Public display data: only feeling word, PAD vector, hex, and scene name are
 * shipped. Builder-facing notes and private source material are not included —
 * nothing in this app renders prose about a real person. Light + math + music only.
 *
 * pad scale: -1..1 per axis (valence, arousal, dominance).
 * scene: verbatim name in the Hue server's SceneCatalog.
 */
window.EMOTIONS = [
  { feeling: "joy",       pad: { v:  0.8, a:  0.5,  d:  0.3  }, hex: "#F5E6D0", scene: "Fireplace" },
  { feeling: "calm",      pad: { v:  0.5, a: -0.35, d:  0.35 }, hex: "#D4944C", scene: "Cozy" },
  { feeling: "grief",     pad: { v: -0.5, a: -0.2,  d: -0.4  }, hex: "#4A8B8C", scene: "Rainy Day" },
  { feeling: "awe",       pad: { v:  0.6, a:  0.6,  d: -0.1  }, hex: "#8E7CC3", scene: "Dream" },
  { feeling: "contempt",  pad: { v: -0.5, a:  0.0,  d:  0.5  }, hex: "#4A5A66", scene: "Drift" },
  { feeling: "overload",  pad: { v: -0.7, a:  0.8,  d: -0.6  }, hex: "#5A2E3D", scene: "Moving Clouds" },
  { feeling: "vigilance", pad: { v:  0.1, a:  0.3,  d: -0.5  }, hex: "#5A7A8C", scene: "Sunset Drift" },
  { feeling: "anticipation", pad: { v: 0.5, a: 0.2, d:  0.2  }, hex: "#D4A055", scene: "Party" },
  { feeling: "love",      pad: { v:  0.6, a: -0.3,  d:  0.3  }, hex: "#D4A86B", scene: "Calm Tide" },
  { feeling: "surprise",  pad: { v:  0.7, a:  0.5,  d:  0.3  }, hex: "#F2C94C", scene: "Glow" }
];

/* Lobby doors. Locked doors are flavour — they never open. */
/* The lobby is gone: the constellation is the map. Doors were replaced by
 * adjacency (web/field/). ROOMS lived here. */

