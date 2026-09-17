# The Grand Catalog of Cool, Symmetrical, Visualizable Math Patterns

## TL;DR
- There are **well over 100 distinct named patterns** you can visualize in the spirit of the Ulam and Fibonacci spirals; this catalog organizes 130+ of them into 10 categories, with the spiral family given the deepest treatment (40+ named spirals).
- The most productive "connection threads" to explore are: **Fermat's spiral → phyllotaxis/Vogel's model → Doyle spiral** (plant growth); **Ulam → Sacks → Klauber → Gilbreath** (prime visualizations); and **Pascal's triangle mod 2 → Sierpiński triangle → Rule 90 cellular automaton** (the same fractal appearing three independent ways).
- Start with the spiral and prime-visualization sections (your stated love), then branch into fractals and curve families, which contain the largest number of "easy to generate, instantly beautiful" objects.

## Key Findings
- **Spirals are the richest category.** Wikipedia's "List of Spirals," MathWorld, and the Encyclopedia of Mathematics together name roughly 40 distinct mathematical spirals, split into *algebraic spirals* (Archimedean, Fermat, hyperbolic, lituus, Galilean, parabolic) and *pseudo-spirals* (logarithmic, Cornu/Euler, involute of a circle) plus 3D spirals (helix, conchospiral, spherical spirals) and number-theoretic spirals (Ulam, Sacks).
- **The same beautiful objects recur across categories.** The Sierpiński triangle appears as a fractal, as Pascal's triangle mod 2, and as the time-evolution of cellular-automaton Rule 90. The golden ratio links the golden spiral, Fibonacci spiral, phyllotaxis, and Penrose tiling.
- **Prime spirals are a small but deep family** driven by prime-generating quadratic polynomials (e.g., Euler's n²+n+41).
- Many "curiosities" (times-table cardioid, Recamán semicircles, Collatz trees) are recent, computer-enabled visualizations that are trivially easy to generate and highly shareable.

## Details

### Category 1 — Mathematical Spirals (deep dive)
This is the star category. Spirals are usually described in polar coordinates (r as a function of angle θ). Mathematicians classify them into *algebraic spirals* (polar equation is algebraic in r and θ) and *pseudo-spirals* (defined by a curvature/arc-length relation).

**Core algebraic spirals**
- **Archimedean spiral (arithmetic spiral):** r = a + bθ. Constant spacing between successive turns — the "rolled-up carpet." The parent of the whole family; general form r = a·θ^(1/n) unifies several below.
- **Fermat's spiral (parabolic spiral):** r² = a²θ (equivalently r = ±a√θ). First described 1636. Encloses **equal area per turn**, which is exactly why it models seed packing (see phyllotaxis).
- **Hyperbolic spiral (reciprocal spiral):** r = a/θ. Spirals *inward* toward an asymptote; it is the circle-inversion of the Archimedean spiral and looks like the view up a spiral staircase.
- **Lituus:** r²θ = k (r = a/√θ). Named for an ancient trumpet/crozier shape; the locus where each sweep encloses equal area — related to Fermat's spiral by inversion.
- **Galilean spiral:** r = bθ² − a. Trajectory of a uniformly accelerated point on a uniformly rotating line.
- **Generalized/rational spiral:** r as a rational or power function of θ; MathWorld lists a "rational spiral" that interpolates among the Archimedean-type cases.

**Core pseudo-spirals**
- **Logarithmic (equiangular) spiral, "spira mirabilis":** r = a·e^(bθ). Studied by Descartes (1638); Jakob Bernoulli loved it so much he had it carved on his tomb. Every ray from the center meets it at a constant angle; it is self-similar (looks identical at every zoom). Appears in nautilus shells, hawk flight paths, galaxy arms, and cyclone cloud bands. Also called the Bernoulli, growth, or (in antenna/galaxy contexts) log-periodic spiral — all synonyms.
- **Golden spiral:** r = φ^(2θ/π), a special logarithmic spiral that grows by the golden ratio φ per quarter turn.
- **Fibonacci spiral:** quarter-circle arcs inscribed in a tiling of Fibonacci-sized squares; a piecewise approximation of the golden spiral. Easy to draw on graph paper.
- **Euler spiral (Cornu spiral / clothoid):** curvature increases linearly with arc length; defined by the Fresnel integrals. Its double-spiral "S" shape is used for highway and railway transition curves and roller-coaster loops.
- **Involute of a circle:** the curve traced by unwinding a taut string from a circle; looks Archimedean and is the basis of gear-tooth profiles.
- **Nielsen's spiral:** a Euler-spiral variant built from the sine and cosine integrals.

**Discrete / constructed spirals**
- **Spiral of Theodorus (square-root / Pythagorean / Einstein spiral):** contiguous right triangles, each with a unit leg, whose hypotenuses are √2, √3, √4, …; approximates the Archimedean spiral. Theodorus reportedly used it to prove √3…√17 irrational. A recent (2024) "Fibonacci–Theodorus" variant connects it to the golden ratio.
- **Polygonal spiral / spirangle:** straight-segment ("angular") approximations of Archimedean or logarithmic spirals; used for printed inductors and in ophthalmology.
- **Baravelle spiral (spidron):** nested self-similar triangles each half the area of the last, visualizing a geometric series summing to a finite total.
- **Padovan spiral:** like the Fibonacci spiral but built from equilateral triangles whose sides follow the Padovan sequence (growth ratio = the plastic number ρ ≈ 1.3247).

**More exotic named spirals**
- **Epispiral:** r = a·sec(nθ). The circle-inversion of the rose curve, with n (or 2n) branches.
- **Cochleoid ("snail" curve):** r = a·sin(θ)/θ. Infinitely many loops all pass through the pole; the inverse of Hippias' quadratrix.
- **Sinusoidal spirals:** rⁿ = aⁿ·cos(nθ) — a Maclaurin family (1718) that isn't truly spiral but yields line, circle, cardioid, parabola, lemniscate, and rectangular hyperbola as special cases.
- **Cotes's spiral(s):** the full set of orbits under an inverse-cube central force; its five sub-cases include the logarithmic spiral (exponential case), the hyperbolic spiral (linear case), Poinsot's spirals (hyperbolic-sine/cosine cases), and an epispiral (cosine case).
- **Poinsot's spirals:** r = a·csch(nθ) and r = a·sech(nθ) — spirals built from hyperbolic functions.
- **Doyle spiral:** a circle-packing spiral where every circle is ringed by six tangent circles; centers lie on logarithmic spirals; directly models phyllotaxis (its arms are "parastichies").
- **Fraser's spiral:** a famous *optical illusion* — concentric circles that appear to spiral (1908).
- **Atzema spiral, atomic spiral (r = θ/(θ−a)), Doppler spiral** — lesser-known named plane spirals from mathcurve/2dcurves catalogs.

**3D and spherical spirals**
- **Helix:** the canonical 3D spiral (spring, screw thread, DNA backbone).
- **Conical spiral / conchospiral:** a logarithmic (or other) spiral climbing a cone; r = μ^t·a.
- **Spherical spiral / loxodrome (rhumb line):** a spiral on a sphere crossing every meridian at a constant angle — a constant-compass-bearing path on Earth.
- **Seiffert's spiral:** a spherical spiral drawn using Jacobi elliptic functions (2000).
- **Pappus spiral** and its 2D projection the **Doppler spiral**; the **tractrix spiral**; the **galactic spiral** (a 2019 differential model for galaxy arms).

**Pursuit spiral**
- **Mice problem / pursuit "whirl":** n bugs starting at the corners of a regular polygon, each chasing the next, trace logarithmic spirals converging at the center.

### Category 2 — Prime-number visualizations
- **Ulam spiral (prime spiral):** integers written in a square spiral, primes marked. Discovered by Stanisław Ulam in 1963 while doodling; primes cluster on diagonal lines corresponding to prime-rich quadratic polynomials (e.g., Euler's n²+n+41). It was featured on the March 1964 cover of *Scientific American* and described in Martin Gardner's "Mathematical Games: The Remarkable Lore of the Prime Number," *Scientific American* 210(3):120–128; the underlying research is Stein, Ulam & Wells, "A Visual Display of Some Properties of the Distribution of Primes," *American Mathematical Monthly* 71(5):516–520 (1964), which noted the spiral "appears to exhibit a strongly nonrandom appearance."
- **Sacks spiral:** integers placed on an Archimedean spiral with one perfect square per full turn (Robert Sacks, 1994); it "joins up" Ulam's broken diagonals into continuous curves and makes prime-generating polynomials appear as smooth arcs.
- **Klauber triangle:** a triangular array (row n holds (n−1)²+1 through n²) built by herpetologist Laurence Monroe Klauber (1883–1968), who presented it to the Mathematical Association of America in 1932 — 31 years before Ulam — showing vertical and diagonal prime streaks meeting at 60° angles.
- **Gilbreath's triangle:** repeatedly take absolute differences of consecutive primes; the left edge appears to be all 1s (Gilbreath's conjecture, verified to more than 3.34 × 10¹¹ rows), producing a triangular pattern.
- **Prime "cardioid" via modular multiplication** (see Category 7) and **prime counting on the square-root spiral** are related curiosities.

### Category 3 — Fibonacci / golden-ratio / phyllotaxis patterns
- **Phyllotaxis (Vogel's model / sunflower spiral):** seeds placed at r = c√n, θ = n × 137.5° (the golden angle). Reproduces sunflower heads, pinecones, and pineapples; clockwise/counterclockwise spiral counts are consecutive Fibonacci numbers. The golden angle is the "most irrational" divergence, giving optimal packing — confirmed experimentally by Stéphane Douady and Yves Couder, "Phyllotaxis as a physical self-organized growth process," *Physical Review Letters* 68(13):2098–2101 (30 March 1992), in which ferrofluid droplets advected by a magnetic field spontaneously arranged into Fibonacci spirals converging on the golden angle.
- **Fermat's-spiral connection:** because Fermat's spiral encloses equal area per turn, mature florets of equal size naturally lie on it — this is *why* the sunflower is a Fermat spiral.
- **Lucas / Padovan / other recurrence spirals:** the Fibonacci-square construction generalizes to Lucas numbers and other second-order recurrences.
- **Golden spiral, golden rectangle/gnomon subdivisions**, and **Doyle spiral** (Category 1) all sit in this cluster.

### Category 4 — Symmetrical number-pattern visualizations
- **Pascal's triangle:** binomial coefficients; diagonals give counting, triangular, and tetrahedral numbers, and shallow-diagonal sums give Fibonacci numbers.
- **Pascal's triangle mod 2 → Sierpiński triangle:** coloring odd entries black yields the Sierpiński sieve exactly (a consequence of Lucas' theorem). Mod-3 and other moduli give related nested "Pascal–Sierpiński gaskets."
- **Stern–Brocot tree / Calkin–Wilf tree:** binary trees that enumerate every positive rational exactly once via mediants; the Calkin–Wilf spiral even appears in the List of Spirals.
- **Farey sequence & Ford circles:** rationals in [0,1] visualized as mutually tangent ("kissing") circles; tangent exactly when |p_L q_R − p_R q_L| = 1. Ford circles connect to the Apollonian gasket and hyperbolic tilings.
- **Recamán's sequence:** an integer sequence plotted with alternating semicircles, producing an iconic tangled arc pattern (popularized by Numberphile, 2018).

### Category 5 — Fractals with spiral/symmetric qualities
- **Sierpiński triangle (gasket)** and **Sierpiński carpet:** self-similar removal fractals; dimensions ≈1.585 and ≈1.893.
- **Menger sponge:** the 3D generalization of the carpet.
- **Mandelbrot set:** z→z²+c iteration; not strictly self-similar, its boundary has Hausdorff dimension 2 and contains spiral "Seahorse Valley" regions and mini-copies of itself.
- **Julia sets:** companion fractals to the Mandelbrot set; connected when c lies inside the Mandelbrot set, "dust" when outside.
- **Koch snowflake / Koch curve / Koch antisnowflake:** infinite perimeter enclosing finite area; dimension ≈1.262.
- **Dragon curve (Heighway dragon):** a self-similar folded-paper fractal.
- **Barnsley fern:** an iterated-function-system fractal resembling a real fern.
- **Apollonian gasket:** mutually tangent circles packed recursively (linked to Ford circles).
- **Pythagoras tree / fractal (L-system) trees:** recursively branching self-similar trees.
- **Cantor set / Cantor dust:** the archetypal "remove the middle third" fractal (dimension ≈0.631).
- **Lévy C curve, Gosper island / flowsnake, box fractal, H-fractal, pentaflake, T-square, Hénon and Lorenz strange attractors, Newton fractal** — a large MathWorld roster of additional named fractals.
- **Space-filling curves:** **Hilbert curve**, **Peano curve**, **Moore curve** (closed Hilbert), **Gosper curve**, **Lebesgue curve** — continuous curves that fill a square (dimension 2), beautiful when drawn at finite iteration.

### Category 6 — Tilings and symmetry patterns
- **Penrose tiling:** aperiodic tiling (kites-and-darts or two rhombs, 1974) with fivefold symmetry and golden-ratio tile areas; models quasicrystals.
- **"Hat"/"Spectre" aperiodic monotile:** the 2023 solution to the einstein problem — a single tile that tiles only aperiodically. David Smith, Joseph Samuel Myers, Craig S. Kaplan and Chaim Goodman-Strauss, "An aperiodic monotile," arXiv:2303.10798 (submitted 20 March 2023), published in *Combinatorial Theory* 4(1), 30 June 2024; the "hat" is a 13-sided polykite (eight kites). The chiral "Spectre" followed in "A chiral aperiodic monotile," arXiv:2305.17743 (28 May 2023).
- **Ammann–Beenker tiling:** eightfold aperiodic tiling (silver ratio).
- **Girih tiles / Islamic geometric patterns:** five equilateral tiles used since ~1200 CE. Peter J. Lu and Paul J. Steinhardt, "Decagonal and Quasi-crystalline Tilings in Medieval Islamic Architecture," *Science* 315(5815):1106–1110 (23 Feb 2007), showed that "by 1200 C.E. a conceptual breakthrough occurred in which girih patterns were reconceived as tessellations of a special set of equilateral polygons… by the 15th century… to construct nearly perfect quasi-crystalline Penrose patterns, five centuries before their discovery in the West" (exemplified by the Darb-i Imam shrine, Isfahan).
- **Voronoi diagram & Delaunay triangulation:** dual space partitions (Thiessen polygons); ubiquitous in art and science.
- **Truchet tiles:** simple square tiles with arcs/diagonals that combine into intricate maze- and weave-like patterns.
- **Wallpaper groups:** the 17 distinct plane symmetry groups — the complete classification of repeating 2D patterns.
- **Wang tiles:** colored square tiles whose matching rules can force aperiodicity.

### Category 7 — Curve-based visual patterns
- **Rose curves (rhodonea):** r = a·cos(nθ); petalled "flower" curves (n petals if n odd, 2n if even). Named by Guido Grandi (1720s).
- **Maurer rose:** connecting points on a rose by straight lines at regular degree steps, producing a striking web of chords.
- **Spirograph curves — hypotrochoids and epitrochoids:** traced by a point on a circle rolling inside (hypo) or outside (epi) another circle; petal/loop counts governed by the gcd of the radii. Rose curves are a special case; used in guilloché engraving and (as an epitrochoid) in the Wankel rotary engine.
- **Lissajous curves:** x = sin(aθ+δ), y = sin(bθ); closed when a/b is rational — the classic oscilloscope figures.
- **Harmonograph patterns:** curves drawn by coupled damped pendulums; decaying Lissajous-like figures.
- **Guilloché patterns:** intricate layered spirograph/rose curves used on banknotes and watch faces.
- **Cornu spiral / Cardioid / Nephroid / Limaçon / Epicycloid / Hypocycloid / Astroid / Deltoid** — the broader roulette-and-caustic family; the cardioid and nephroid appear as light caustics in a coffee cup.

### Category 8 — Cellular-automaton patterns
- **Rule 90:** an elementary (1D) automaton based on XOR; from a single cell it draws the **Sierpiński triangle**.
- **Rule 30:** produces chaotic, pseudo-random output from a single seed; used as a random-number generator in Mathematica.
- **Rule 110:** produces localized "glider"-like structures and is the only elementary cellular automaton directly proven Turing-complete — Matthew Cook, "Universality in Elementary Cellular Automata," *Complex Systems* 15:1–40 (2004), which emulated a cyclic tag system and confirmed Stephen Wolfram's 1985 conjecture.
- **Conway's Game of Life:** 2D automaton (B3/S23) with iconic symmetric objects — **still lifes** (block, beehive, loaf, boat), **oscillators** (blinker, toad, beacon, pulsar), and **spaceships** (the glider, lightweight spaceship), plus glider guns.
- **Wolfram's four classes** (homogeneous, periodic, chaotic, complex) classify all 256 elementary rules.

### Category 9 — Other number-visualization curiosities
- **Collatz (3n+1) visualizations:** tree/graph of all numbers flowing to 1, and "turn-left/turn-right" path drawings that produce organic, coral-like branching images.
- **Times-table cardioid (modular multiplication circle):** place N points on a circle and connect each k to 2k mod N; the ×2 table draws a **cardioid**, ×3 a **nephroid**, and higher factors draw Mandelbrot-related curves (popularized by Mathologer).
- **Ulam-style spirals for other sequences:** marking squares, triangular numbers, or other sequences on the number spiral.
- **Digit-sum / digital-root patterns** and **look-and-say sequence** (1, 11, 21, 1211, …; the "audioactive" sequence with Conway's constant 1.303577… growth).
- **Square-root spiral prime accumulation** and **Gilbreath triangle** (also in Category 2).

### Category 10 — Polygon / star-based patterns
- **Star polygons:** self-intersecting regular polygons denoted by Schläfli symbol {p/q} — pentagram {5/2}, hexagram {6/2}, heptagram {7/2} and {7/3}, octagram {8/3}, enneagram, decagram, etc.
- **Mystic rose:** connect every one of n points on a circle to every other, producing a dense symmetric web.
- **Compound stars:** e.g., 2{5/2} (two overlapping pentagrams in a decagon).
- **Rose/Maurer-rose and guilloché** (cross-listed with Category 7) are the curved analogues of star polygons.

## Recommendations
1. **Start where your passion is — spirals.** Build the Archimedean → Fermat → hyperbolic → lituus progression first (they're one-line polar equations), then the logarithmic/golden/Fibonacci cluster, then Theodorus (compass-and-straightedge). A graphing tool like Desmos or GeoGebra renders any polar equation instantly; for the discrete ones (Theodorus, Baravelle, Padovan) use graph paper or a few lines of Python/Processing.
2. **Then do the "same fractal three ways" demo:** generate Pascal's triangle mod 2, the Sierpiński triangle by recursion, and Rule 90 — seeing one shape emerge from number theory, geometry, and computation is the single most striking connection in this catalog.
3. **For maximum visual payoff per effort,** the times-table cardioid, Recamán semicircles, Maurer rose, and phyllotaxis (Vogel) model are each ~20 lines of code and instantly beautiful.
4. **Benchmarks that would change the plan:** if you want *provable* mathematical depth over pure visuals, prioritize the prime spirals (open problems: does Euler's polynomial generate infinitely many primes?), Collatz, and Gilbreath — all tie to famous unsolved conjectures. If you want *interactive/animated* pieces, prioritize cellular automata and Game of Life. If you want *physical art* (prints, laser-cut, embroidery), prioritize spirograph/guilloché, Islamic girih, and Penrose tilings.

## Caveats
- **"Golden ratio in nature" claims are frequently overstated.** The nautilus shell is a logarithmic spiral but generally *not* a golden spiral; treat popular golden-ratio-everywhere assertions skeptically.
- **Some "spirals" are not true spirals.** The sinusoidal "spirals" are flower-like algebraic curves; Fraser's spiral is an optical illusion made of concentric circles; and the mice-pursuit "whirl" is geometrically just logarithmic spirals.
- **A few names are unverifiable.** I could not confirm a distinct "witch spiral" or "Chrystal spiral" in MathWorld, Wikipedia's List of Spirals, or the Encyclopedia of Mathematics; treat such names with caution. Likewise, "Bernoulli," "equiangular," "growth," and "log-periodic" spirals are all synonyms of the logarithmic spiral, not separate objects. One minor source discrepancy: Klauber's 1932 presentation is attributed by most references to the Mathematical Association of America, though a few secondary sources say the American Mathematical Society.
- **Category boundaries are fuzzy by design.** Many objects legitimately belong to several categories (rose curves are both curve-family and star-adjacent; Doyle spirals are both spiral and phyllotaxis; the Sierpiński triangle is fractal, number-pattern, and cellular-automaton). The cross-listings above are intentional and reflect the genuine mathematical connections you asked to highlight.
- This catalog aims for breadth; each entry is a starting point. Exact equations, parameter ranges, and historical attributions should be double-checked against a primary source (MathWorld and Wikipedia's "List of Spirals" are the best jumping-off points) before use in published work.