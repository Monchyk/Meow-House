/* synth-cards.js — the teaching content + patch model for the synth patchbay.
 *
 * PURE DATA + two pure helpers (no DOM), so it unit-tests headlessly. synth.js owns
 * all the SVG/DOM; this owns what the cards SAY and how a live LFO patch becomes a
 * drawable cord.
 *
 * Card levels (stack; stop where you like):
 *   eli5   — plain words, noob-proof, stands alone
 *   math   — the formula, for when you're curious
 *   code   — file:line you can open
 *
 * Browser (window.SYNTHCARDS) + bare node (module.exports), guarded — same dual-export
 * discipline as palettes.js / party.js / tune-meta.js.
 *
 * ⚠ FABLE #1 (2026-08-11): a MODULE that can be an LFO SOURCE must have its `id` equal
 * the literal party.js modSource() key — swing / zoom / business / cycle / breath. If it
 * were a pretty label, cordsFromState() would resolve nothing and every live patch would
 * draw as an invisible cord. synth.test.js guards this. Human names live in `label`.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  // The five legal patch SOURCES — the exact strings party.js modSource() switches on
  // (party.js:877-889). A module with patchSource:true MUST use one of these as its id.
  var MODSOURCE_KEYS = ["swing", "zoom", "business", "cycle", "breath"];

  // Modules = the blocks on the map. `live` names the snapshot field whose value the
  // node shows / glows with (null = nothing live to show yet). `pos` is a [x,y] hint in
  // a 0..100 canvas. `patchSource:true` marks the five legal LFO sources.
  // Laid out in three columns, left → right = the direction signal flows:
  //   DRIVERS (col 1, x≈18) → CLOCKS (col 2, x≈50) → OUTPUTS (col 3, x≈82).
  // `col` is used only for the column headers the map draws.
  var MODULES = [
    // ── col 1: the drivers (what sets the room in motion) ──
    { id: "business", kind: "envelope", label: "Business", live: "business", patchSource: true, pos: [15, 14], col: "drivers",
      eli5: "The room's energy. It rises when someone holds a brightness button, and slowly forgets — sinking back to rest when left alone. Almost everything downstream is driven by how high this sits." },
    { id: "neglect", kind: "envelope", label: "Neglect", live: null, patchSource: false, pos: [15, 26], col: "drivers",
      eli5: "How long the room has been ignored. As it climbs, the screen starts pulling inward, quietly asking for attention." },
    { id: "cycle", kind: "clock", label: "Attract cycle", live: null, patchSource: true, pos: [15, 38], col: "drivers",
      eli5: "When nobody's touching it, the room runs itself. This is the 25–45-second heartbeat of each scene it chooses on its own — and it drives business up and down by itself." },
    { id: "breath", kind: "clock", label: "Breath", live: null, patchSource: true, pos: [15, 49], col: "drivers",
      eli5: "A free, slow sine wave tied to nothing. A spare oscillator — patch it onto any knob to make that knob wander gently on its own." },
    // ── col 2: the clocks (the oscillators the shapes ride on) ──
    { id: "swing", kind: "clock", label: "σ pendulum", live: "tune", patchSource: true, pos: [50, 19], col: "clocks",
      eli5: "A slow pendulum swinging the pattern between full chaos and full symmetry and back. It swings faster as the room gets busier." },
    { id: "zoom", kind: "clock", label: "Zoom swing", live: "zoom", patchSource: true, pos: [50, 40], col: "clocks",
      eli5: "The dive toward the centre. It rides the SAME pendulum as σ, so pumping the room speeds the dive exactly as it speeds the chaos↔symmetry swing — one pendulum, two motions." },
    // ── col 3: the outputs (what the room actually shows) ──
    { id: "screen", kind: "output", label: "Screen", live: null, pos: [85, 14], col: "outputs",
      eli5: "The projected spiral and its bloom — where the pattern and colour actually land for the room to see." },
    { id: "lamps", kind: "output", label: "Lamps", live: "effectiveEnergy", pos: [85, 29], col: "outputs",
      eli5: "The physical Hue lamps. Their brightness follows the room's energy, held under the anti-strobe ceiling so it can never flash." },
    // The knob panel, as a single anchor node: a live patch cord lands here (its exact
    // target knob is named on the cord + shown in the panel below). Later, full drag-to-
    // create can split this into per-knob ports — nodePos() already accepts a config key.
    { id: "knobs", kind: "panel", label: "The knobs", live: null, pos: [85, 44], col: "outputs",
      eli5: "Every tunable value — the sliders below. Any of them can be driven by a clock (an LFO patch), which draws as a cord landing here." },
  ];

  // Fixed cords = the couplings wired into the engine. `live` names the snapshot field
  // whose value the cord glows with. `math`/`code` are the 🔵/⚙️ layers.
  var CORDS = [
    { from: "business", to: "swing", label: "sets the sway rate", live: "business",
      eli5: "The busier the room, the faster the chaos↔symmetry pendulum swings.",
      math: "swing rate = swingFreqBase + business × swingFreqGain", code: "party.js:745" },
    { from: "swing", to: "zoom", label: "same pendulum phase", live: "tune",
      eli5: "The dive isn't its own clock — it rides the σ pendulum's phase, at its own ratio.",
      math: "zoom phase = σ phase × zoomRatio", code: "party.js:372" },
    { from: "swing", to: "screen", label: "shapes the pattern & its colour", live: "tune",
      eli5: "σ is what you actually see resolve and dissolve: chaos scatters it, symmetry locks it, and it sets how many colours coexist.",
      math: "σ ∈ [0,1] → pattern order + colour spread", code: "symmetry.js:347" },
    { from: "zoom", to: "screen", label: "the dive", live: "zoom",
      eli5: "How far the picture falls into its own centre — and only when the room is pumped.",
      math: "scale → zoomMax at full business", code: "party.js:372" },
    { from: "business", to: "lamps", label: "energy → brightness", live: "effectiveEnergy",
      eli5: "The room's energy becomes the lamps' brightness, capped so it stays gentle.",
      math: "GlobalEnergy → brightness, clamped at energyCap", code: "party.js:612" },
    { from: "neglect", to: "screen", label: "pulls the picture inward", live: null,
      eli5: "The longer the room is ignored, the more the screen tugs inward toward the centre — a slow ask for attention.",
      math: "attention ↑ → inward bloom pull", code: "party.js:468" },
    // kind:"auto" — only active while the room runs itself; drawn dim + dashed.
    { from: "cycle", to: "business", label: "drives the room when idle", live: null, kind: "auto",
      eli5: "When nobody touches anything, the attract cycle takes over and breathes business up and down by itself, one slow swell per scene.",
      math: "business = floor + swell(cycle)", code: "party.js:706" },
    // kind:"latent" — not an active coupling; the invitation to patch. Drawn faint.
    { from: "breath", to: "knobs", label: "patch onto any knob", live: null, kind: "latent",
      eli5: "Breath drives nothing on its own. Patch it onto a knob (below) and that knob starts wandering on this slow sine.",
      math: "value = 0.5 + 0.5·sin(t)", code: "party.js:887" },
  ];

  // Knob cards — keyed to TUNE keys (label/range/hint come from tune-meta.js; these add
  // the teaching layers). Seeded set for Phase A; the rest land in Phase B.
  var KNOB_CARDS = {
    bpm: {
      eli5: "The master clock. Every moving thing — screen, colours, lamps — runs at this speed. Lower is slower and wider; it's the one knob that repaces the whole room at once.",
      math: "everything advances at (bpm ÷ 120) × real time", code: "party.js:875" },
    swingFreqGain: {
      eli5: "How much faster the chaos↔symmetry pendulum swings when the room is pushed. 0 = pushing doesn't speed it; high = a pumped room breathes fast.",
      math: "swing rate = swingFreqBase + business × swingFreqGain", code: "party.js:745" },
    zoomMax: {
      eli5: "How deep the dive goes at its deepest — and only when the room is pumped; a calm room barely dives at all.",
      math: "deepest scale ≈ zoomMax at full business", code: "party.js:372" },
    colorSpreadOrder: {
      eli5: "How many colours stay on screen once the pattern resolves into symmetry. Low = it converges toward a single hue; high = it stays rich all the way through.",
      math: "palette-slice width at the order end of the σ swing", code: "symmetry.js:104" },
    decayRate: {
      eli5: "How fast the room forgets — how quickly its energy sinks back to rest once nobody is pushing it.",
      math: "business → floor at decayRate per second", code: "party.js:615" },
  };

  // Exhibit cards — keyed to the exhibit title (the same string party.js/​symmetry.js use).
  // formula is static (the synth page never runs symmetry.js). Seeded set for Phase A.
  // Ordered by `tag` so the index groups cleanly. Each card stacks: eli5 (plain) →
  // more (going deeper, still plain) → formula (the maths) → mathPlain (the formula in
  // words) → code. synth.test.js enforces this shape so the remaining ~25 keep it.
  var EXHIBIT_CARDS = {
    // ── spirals ──
    "Fermat spiral": { tag: "spiral",
      eli5: "A two-armed spiral where every full turn wraps up the exact same amount of area — so nothing bunches up in the middle and nothing gets stretched thin at the edge. It's the skeleton a sunflower's seeds actually grow on.",
      more: "Because each ring holds the same room as the last, seeds of equal size settle onto it perfectly evenly — which is why real sunflower heads, daisy centres and pinecones follow this shape. The two arms come from marking every other point half a turn apart, so it reads as a balanced pinwheel rather than one lopsided coil.",
      formula: "r = a·√θ",
      mathPlain: "How far a point sits from the centre (r) grows like the square root of how far around it has travelled (θ). Square-root growth is slow, and slowing — which is exactly what keeps every ring the same width.",
      code: "symmetry.js:1332" },
    "Phyllotaxis": { tag: "spiral",
      eli5: "How a sunflower packs its seeds so not one wastes space: turn about 137.5° before dropping each new seed. Because that angle never lines up into neat spokes, the seeds are forced into the one arrangement that fills the middle perfectly.",
      more: "That magic angle is the 'most irrational' turn there is — it never repeats, so seeds can't fall into gappy rows. Get it exactly right and you see the interlocking Fibonacci spirals real sunflowers show (count them: usually 21 one way, 34 the other). Get it a little wrong and the whole thing collapses into a wobbly moiré mess — which is exactly the range the σ pendulum sweeps through here.",
      formula: "θ = n · 137.5°",
      mathPlain: "The nth seed sits n steps of 137.5° around the centre, each a touch further out. That 137.5° is a full circle (360°) divided by φ² — the golden ratio squared — nature's trick for a turn that never overlaps itself.",
      code: "symmetry.js:543" },
    "Logarithmic spiral": { tag: "spiral",
      eli5: "The self-similar spiral of snail shells, ram horns and whole galaxies — each full turn is a fixed percentage bigger than the one before, like compound interest drawn as a curl. Zoom in and it looks exactly the same at every scale.",
      more: "Because it grows by multiplying instead of adding, it can wind inward forever, getting smaller and smaller, yet never quite reach the centre. A hawk diving on prey follows one; so do hurricane bands and spiral-galaxy arms. Here, scattered points start as a smeared cloud and slowly lock onto clean, evenly-angled arms as the pattern resolves.",
      formula: "r = a·e^{bθ}",
      mathPlain: "Distance from the centre (r) grows exponentially with the angle (θ). e^{bθ} means 'keep multiplying' — the same maths as money at a steady interest rate. The number b sets how tightly it coils.",
      code: "symmetry.js:1199" },
    // ── curves ──
    "Rose curve": { tag: "curve",
      eli5: "A flower of petals traced by a single point whose distance from the centre swells and shrinks as it sweeps around. One whole number decides how many petals you get.",
      more: "As the point circles, its reach rises to a full petal, drops back to nothing, and rises again — so the petals are just that in-and-out breathing repeated around the circle. Odd numbers give that many petals; even numbers give double. It's the same family of shape as the ripple of light you see in the bottom of a coffee cup.",
      formula: "r = cos(k·θ)",
      mathPlain: "The distance out (r) is a cosine of the angle (θ) times a whole number k. Cosine rocks smoothly between +1 and −1, and each swing out to +1 draws one petal — so k controls how many swings happen in a single lap.",
      code: "symmetry.js:477" },
    "Lissajous": { tag: "curve",
      eli5: "Two swings at right angles — one side-to-side, one up-and-down — running at slightly different speeds. Follow the moving point and you get looping ribbons that slowly tumble as the two speeds drift apart.",
      more: "When the speeds are a simple ratio (2:3, 3:4) the figure closes into a clean, still knot; when they're just a hair off, it rotates and morphs forever. It's literally what an old oscilloscope draws when you feed it two tones, which is why these show up in vintage hi-fi gear and sci-fi title screens.",
      formula: "x = sin(3t + φ),  y = sin(b·t)",
      mathPlain: "The horizontal position is one sine wave, the vertical is another at a different rate b. Playing them against each other weaves a grid of loops; the phase φ tips the whole figure over, and b sets how many loops go across versus up-and-down.",
      code: "symmetry.js:438" },
    "Harmonograph": { tag: "curve",
      eli5: "Picture a pen on a swinging pendulum, drawing on a sheet of paper that's also swinging on its own pendulum. As both slowly run out of energy, the loops spiral inward into a delicate woven knot.",
      more: "Victorian science museums had real machines that drew these, and the fading swing is the whole charm — the pattern tightens and settles as the energy drains away. It's really a Lissajous figure with the volume slowly turned down, so it never quite repeats and closes into a still centre.",
      formula: "x = Σ sin(fₙ·t + φₙ)·e^(−d·t)",
      mathPlain: "Add up a few sine swings (the Σ means 'sum them'), each at its own rate fₙ, then multiply everything by e^(−d·t) — a slow fade toward zero. The sines make the loops; the fade is what pulls them gently inward over time.",
      code: "symmetry.js:456" },
    // ── prime spirals ──
    "Ulam spiral": { tag: "prime",
      eli5: "Write the whole numbers 1, 2, 3, 4… in a square spiral winding outward, then light up only the prime numbers. Strangely, they refuse to scatter at random — they line up along diagonal streaks.",
      more: "Those diagonals aren't a fluke: many of them are prime-rich formulas like n²+n+41, which cough up primes far more often than chance should allow. Nobody has fully explained the pattern — it brushes right up against some of the deepest unsolved problems in maths. A mathematician stumbled on it in 1963, doodling a number grid through a dull lecture.",
      formula: "lay 1, 2, 3, … on a square spiral · mark the primes",
      mathPlain: "There's no equation for the shape — it's a picture of the primes themselves. You count outward in a square spiral and colour a cell if its number is prime (divisible by nothing but 1 and itself). The diagonals are simply where prime-making formulas happen to land.",
      code: "symmetry.js:682" },
    "Sacks spiral": { tag: "prime",
      eli5: "The same idea as the Ulam spiral, but the numbers are laid on a smoothly curving spiral instead of a square one — and now the scattered clumps of primes join up into graceful sweeping arcs.",
      more: "Robert Sacks placed each number so the perfect squares (1, 4, 9, 16…) line up along one straight ray. That small change 'unrolls' Ulam's broken diagonals into continuous curves, and each curve traces a prime-generating polynomial. It's the same hidden order, drawn in a way that makes the arcs pop out.",
      formula: "put number n at angle 2π√n, radius √n",
      mathPlain: "Both how-far-out and how-far-around depend on √n — the square root of the number. That's what pins the squares (1, 4, 9…) onto one straight line and bends the prime streaks into smooth arcs instead of straight diagonals.",
      code: "symmetry.js:775" },
    // ── chaos / attractors ──
    "Clifford attractor": { tag: "chaos",
      eli5: "A delicate butterfly-wing shape hiding inside just four numbers. Take a dot, move it with a fixed recipe, then move the new dot with the same recipe — a hundred thousand times — and the marks slowly pile up into a creature you could never have guessed from the numbers.",
      more: "It's called a 'strange attractor': the dot never settles on one spot and never flies away — it's pulled forever into the same intricate shape, tracing it denser and denser. Change any one of the four numbers a little and a completely different creature appears. You genuinely can't predict the shape by reading the recipe; you have to run it and watch it show up.",
      formula: "xₙ₊₁ = sin(a·y) + c·cos(a·x)   (and a matching rule for y)",
      mathPlain: "Each new x is built from the old y and x fed through sine and cosine — smooth wave functions — mixed with the constants a and c. Do the same for y with b and d, feed the answer back in, and repeat. The sines fold the dot's path back on itself over and over, and that endless folding is what draws the wings.",
      code: "symmetry.js:592" },
    "Lorenz attractor": { tag: "chaos",
      eli5: "The famous 'butterfly.' A single point chases three simple rules about how a warm fluid rolls over, and instead of settling down it loops forever around two wings — never repeating, never escaping.",
      more: "This is the picture that named the butterfly effect. Start two points a hair apart and their paths stay close for a while, then peel away completely — the system is fully determined yet impossible to predict for long. Edward Lorenz found it in 1963 while cutting corners on a weather simulation, and it quietly rewrote how we think about forecasting.",
      formula: "ẋ = σ(y−x),   ẏ = x(ρ−z) − y,   ż = xy − βz",
      mathPlain: "The little dots over x, y and z mean 'how fast each one is changing right now.' Each rate depends on the current x, y and z mixed together, so the point steers itself moment to moment. The gentle cross-terms (like xy) are what bend its path into the two looping wings.",
      code: "symmetry.js:1038" },
    // ── fractals ──
    "Mandelbrot set": { tag: "fractal",
      eli5: "The most famous fractal there is. For every point on the screen, run a tiny feedback loop — square it, add the point, repeat — and ask one question: does it race off to infinity, or stay put forever?",
      more: "Colour each point by the answer and you get an infinitely detailed coastline studded with perfect miniature copies of itself, no matter how far you zoom in. The whole endless thing falls out of that one short feedback rule. Its edge is so crinkly it's almost two-dimensional despite being a line — a genuine mathematical monster hiding in a one-line formula.",
      formula: "zₙ₊₁ = zₙ² + c   —   does it stay bounded?",
      mathPlain: "Start at zero, square it, add the point c, and feed that back in over and over. If the running value stays small, c is inside the set (drawn dark); if it blows up, c is outside (coloured by how fast it escaped). Squaring is what makes tiny differences explode, and that's what gives the wild, endless edge.",
      code: "symmetry.js:1166" },
    "Koch snowflake": { tag: "fractal",
      eli5: "Start with a triangle. On the middle of every edge, push out a smaller triangle. Do it again on every new edge, and again, forever. You end up with a perfect six-sided snowflake.",
      more: "Here's the strange part: each pass makes the outline one-third longer, so after infinitely many passes the border is infinitely long — yet it still fences off only a small, finite patch of space. It's a shape too crinkly to have an ordinary length, and it was one of the first 'monsters' that made mathematicians take fractals seriously.",
      formula: "every edge → 4 edges, each ⅓ as long (repeat forever)",
      mathPlain: "Replace each straight edge with four shorter edges that kink out into a bump. Four thirds is bigger than one, so the total length grows by ×4⁄3 on every single pass — multiply that forever and it heads to infinity, even though the snowflake never grows past its little circle.",
      code: "symmetry.js:1230" },
    // ── cellular automata ──
    "Game of Life": { tag: "automaton",
      eli5: "A grid of cells that live or die by two tiny rules about how crowded each cell's neighbourhood is. From a random speckle, little gliders crawl across the screen, blinkers flash, and whole self-running 'machines' assemble themselves — with nobody steering.",
      more: "It's the classic proof that enormous complexity can grow from almost nothing. People have built working clocks, counters, and even a whole computer inside the Game of Life, all from those same two rules. Every frame the entire grid updates at once, so simple local choices ripple into surprisingly lifelike behaviour.",
      formula: "a cell lives with 2–3 neighbours · a new cell is born on exactly 3   (B3/S23)",
      mathPlain: "Count each cell's eight touching neighbours. If it's alive and has 2 or 3 live neighbours it survives; otherwise it dies — lonely or overcrowded. A dead cell with exactly 3 live neighbours springs to life. That's the entire rulebook.",
      code: "symmetry.js:997" },
  };

  /* ── the patch model (fable #3: named + testable) ─────────────────────────────
     modToCord turns one live LFO patch {key,src,depth} (party.js snapshot.mods, :1270)
     into the SAME renderable cord shape as a fixed CORD, so drawing a patch and drawing
     a fixed coupling are ONE render path. This is the zero-rework hinge: a future
     drag-to-CREATE patch is just another {key,src,depth} flowing through here. */
  function modToCord(m) {
    return {
      from: m.src,                 // a modSource key = a MODULE id (fable #1 guarantees it resolves)
      to: m.key,                   // a config key → nodePos() maps it to the knob panel anchor
      kind: "patch",
      depth: m.depth,
      label: "LFO ±" + Math.round((m.depth || 0) * 100) + "% → " + m.key,
      live: m.src,                 // glow from the driving clock's own live value
    };
  }

  // All cords to draw = the fixed couplings + one per live patch. Pure; synth.js only
  // has to place the endpoints via nodePos().
  function cordsFromState(snap) {
    var mods = (snap && snap.mods) || [];
    return CORDS.concat(mods.map(modToCord));
  }

  var SYNTHCARDS = {
    MODSOURCE_KEYS: MODSOURCE_KEYS,
    MODULES: MODULES,
    CORDS: CORDS,
    KNOB_CARDS: KNOB_CARDS,
    EXHIBIT_CARDS: EXHIBIT_CARDS,
    modToCord: modToCord,
    cordsFromState: cordsFromState,
  };

  root.SYNTHCARDS = SYNTHCARDS;
  if (typeof module !== "undefined" && module.exports) module.exports = SYNTHCARDS;
})();
