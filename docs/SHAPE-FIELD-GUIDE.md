# The Deep House Shape Field Guide

*A mathematical field guide to the shapes in `web/viz/symmetry.js`. Every concept is explained twice — first intuitively, then precisely — and the intuition is never allowed to stand in for the definition. Built to be interrogated: the contrast tables are the point.*

> **How this guide treats you:** it will not flatter a shape into meaning more than it does, and it will not congratulate a correct guess. Where an attractive claim is mathematically dubious, the guide keeps the interesting idea and marks the discrepancy. Read the **Mathematics** layer as the source of truth; the picture and intuition are on-ramps, not substitutes.

**The layers, per shape:** Picture → Intuition → **Mathematics** (definition + equation + what it does) → Mental picture → What to notice → **Draw it by hand** → Related → Don't confuse → Established vs interpretation → In your work → One exercise.

---

## Contents

- **Spirals**
  - Archimedean spiral
  - Logarithmic spiral
  - Fermat spiral
  - Hyperbolic spiral
  - Euler spiral (clothoid)
- **The golden cluster**
  - Golden angle & phyllotaxis
- **Periodic curves**
  - Rose curve
  - Lissajous figure
  - Roots of unity & star polygons
  - Superformula (Gielis)
  - Epicycloid & hypocycloid
- **Chaos — iterated maps**
  - Clifford / De Jong / Hopalong
- **Chaos — continuous flows**
  - Lorenz attractor
- **Fractals — escape-time**
  - Mandelbrot & Julia sets
- **Fractals — self-similar (IFS)**
  - Koch, Sierpiński, Dragon, fern
  - The chaos game
- **Primes on a grid**
  - Ulam & Sacks spirals
- **Synchrony**
  - Kuramoto fireflies
- **Waves & aperiodic order**
  - Quasicrystal & Penrose tiling
- **Contrast tables** — the spiral growth-law table · the three kinds of chaos · the kinds of fractal
- **Don't confuse** · **Things I thought I understood** · **Established vs interpretation** · **Full taxonomy (all 66)**

---

## Archimedean spiral
*Spirals — the additive baseline*

**Picture.** A coiled rope on the floor, or the groove of a vinyl record — every loop sits the same fixed distance from the one inside it.

**Intuition.** You add the same amount of radius on every turn. The gaps never change; the spiral just keeps marching outward at a steady pace.

**Mathematics.** A curve whose radius grows linearly with angle. Equal increases in θ give equal increases in r, so the radial distance between successive turns is the constant 2πb.

```
r = a + b·θ
```

**What the equation does.** θ is the angle swept; multiplying it by the constant b and adding a gives the radius. Because r depends on θ to the first power, turn-spacing is fixed — this is the *yardstick* every other spiral is measured against.

**Mental picture.** Think: a rolled-up rope. Same gap, every loop.

**What to notice.** Measure the gap between any two neighbouring rings — near the centre and near the rim. On an Archimedean spiral they are identical. That equal gap is the whole signature.

**Draw it by hand** — _Drawable by hand._ Tools: ruler, protractor.
1. Mark a centre dot.
2. Every 30° around it, draw a faint radius.
3. On the 1st radius mark 10 mm; on each next, add another 10 mm (20, 30, 40…).
4. Join the marks with one smooth curve.

You are plotting r = a + bθ by hand — the fixed +10 mm per step is the constant gap.

**Don't confuse.**
- Archimedean (adds a fixed distance per turn) ≠ Logarithmic (multiplies by a fixed factor per turn). Locally they can look identical; their growth laws are opposites.

**Established.** A clean, exactly-defined curve. No mysticism attached and none needed.

**In your work.** Sacks spiral / Involute spiral — Your Sacks spiral is secretly Archimedean — see the field note in the spiral table below.

**Exercise.** On paper, mark r at θ = 0, π, 2π, 3π for r=θ. The gaps are all π. That constant gap is what "additive" means.

---

## Logarithmic spiral
*Spirals — self-similar; snails, hawks, galaxies*

**Picture.** A snail walking around a pole. Every lap it gets bigger — but not by the same amount, by the same percentage. So the whole shape stays the same as it grows.

**Intuition.** Growth by multiplication, like compound interest drawn as a curl. Zoom in or out and the curve does not change character — it is scale-invariant.

**Mathematics.** A spiral in which increasing θ by a fixed amount multiplies r by a constant factor. Equivalently, the angle between the curve and any radius from the centre is constant (the equiangular property).

```
r = a·e^{b·θ}
```

**What the equation does.** e^{bθ} means "keep multiplying." Advance θ by a full turn (2π) and r is multiplied by e^{2πb} — the same factor every turn, near the centre or far out. b sets how tightly it coils; the sign of b sets the handedness.

**Mental picture.** Think: same shape, bigger copy.

**What to notice.** Watch the arms as your σ pendulum tightens the coil: the *angle* the arm cuts across each ring stays constant even as spacing changes multiplicatively. Constant crossing-angle = you are looking at a genuine log spiral, not an Archimedean one.

**Draw it by hand** — _Drawable by hand._ Tools: ruler, protractor.
1. Centre dot; a faint radius every 30°.
2. First mark 8 mm out; each next mark = previous × 1.3 (10.4, 13.5, 17.6…).
3. Join smoothly.

Multiplying (not adding) each step is what makes it self-similar. Use × φ per 90° for the golden spiral — but remember the nautilus grows ≈1.3/quarter-turn, not φ.

**Don't confuse.**
- Logarithmic spiral ≠ golden spiral. The golden spiral is ONE specific log spiral (growth factor φ per quarter-turn). Almost every log spiral in nature has a different factor.
- A curve that *resembles* a log spiral ≠ a log spiral. The Fibonacci-square "spiral" is piecewise circular arcs — only an approximation.

**Established.** Snail/ammonite shells, hurricane bands, spiral-galaxy arms and a diving hawk's path are genuinely well-modelled by logarithmic spirals. This is real, measured, and mechanistic (self-similar growth).

**Interpretation (marked).** THE NAUTILUS ≠ THE GOLDEN SPIRAL. A nautilus shell is a logarithmic spiral, but its measured growth factor is roughly 1.3 per quarter-turn, not φ ≈ 1.618. "The nautilus is the golden ratio" is a popular claim that does not survive measurement. Keep the beautiful fact (it is log-spiral); drop the numerology.

**In your work.** Logarithmic spiral (symmetry.js:1199) · Galaxy · Doyle spiral — Your "Galaxy" is a log spiral seeded with a star cloud; the arms are log-spiral arms.

**Exercise.** In /experiments.html open the Logarithmic spiral and scrub σ. Confirm the arms keep a constant angle as they tighten. Then open the Archimedean-style Involute and confirm its gaps stay equal instead. That contrast IS the two growth laws.

---

## Fermat spiral
*Spirals — equal area per turn; the sunflower skeleton*

**Picture.** Two arms pinwheeling out from the centre, packed so no ring is more crowded than any other.

**Intuition.** Each new turn wraps up the *same amount of area* as the last. Nothing bunches in the middle, nothing stretches thin at the rim — perfect for packing equal-sized seeds.

**Mathematics.** A spiral whose radius grows as the square root of the angle. Since area scales with r², equal steps in θ enclose equal increments of area. Taking both signs of r gives the two symmetric arms.

```
r = a·√θ      (equivalently r² = a²·θ)
```

**What the equation does.** √θ is slow and slowing — so successive rings get *closer* together, at exactly the rate that keeps their enclosed area constant. That is why sunflower and daisy seed-heads (Vogel's model) sit on a Fermat spiral.

**Mental picture.** Think: equal-area rings. Fair packing.

**What to notice.** Rings get tighter outward (opposite of Archimedean's constant gap, opposite of log's widening gap). If the gaps *shrink* as you go out, you are looking at square-root growth.

**Draw it by hand** — _Drawable by hand._ Tools: ruler, protractor, calculator.
1. Centre dot; a radius every 20°, numbered n = 1, 2, 3…
2. Mark radius = 6 mm × √n (so 6, 8.5, 10.4, 12, 13.4…).
3. Repeat at each angle + 180° for the second arm.
4. Join each arm smoothly.

√n growth is why the rings crowd tighter outward — the opposite of Archimedean.

**Don't confuse.**
- Fermat (r=√θ, gaps shrink) ≠ Archimedean (r=θ, gaps constant). Both are "additive-ish" and neither is self-similar, but their spacing behaves oppositely.

**Established.** The Fermat spiral + golden angle IS the standard model of phyllotaxis (seed packing). Real and mechanistic — it maximises packing efficiency.

**Interpretation (marked).** The shape is established; "sacred sunflower" framing is decoration. The sunflower follows it because equal-area packing is efficient, not because of intent.

**In your work.** Fermat spiral (symmetry.js:1332) · Phyllotaxis — Your Phyllotaxis places seed n at r=√n — that is a Fermat spiral sampled at the golden angle.

**Exercise.** Plot r=√θ and r=θ on the same axes for θ up to 8π. Watch √θ's rings converge while θ's stay parallel. Same "adds each turn," totally different feel.

---

## Hyperbolic spiral
*Spirals — the reciprocal spiral*

**Picture.** A spiral that races in from far away, whips around the centre, but can never quite reach it — like water circling a drain that keeps shrinking.

**Intuition.** The reciprocal of Archimedean: instead of r growing with θ, it *shrinks* as 1/θ. Far out the arms are loose; near the centre they crowd infinitely without arriving.

**Mathematics.** A spiral whose radius is inversely proportional to the angle. As θ→∞, r→0 (it asymptotes to the pole); as θ→0, r→∞ and the curve approaches the horizontal asymptote y = a.

```
r = a / θ
```

**What the equation does.** Dividing by θ inverts Archimedean growth. The 1/θ tail gives it a straight-line asymptote at large radius — a feature no other spiral here has.

**Mental picture.** Think: Archimedean, run in reverse.

**What to notice.** Look for the straight asymptote as the arm unrolls outward, and the infinite crowding at the centre it never touches. Those two features together are unique to 1/θ.

**Draw it by hand** — _Partly drawable._ Tools: ruler, protractor, calculator.
1. Same polar method, radius = 300 mm ÷ (your step number).
2. Start a few steps out — the centre crowds to infinity and cannot be drawn.

Drawable in the mid-range only; the infinite crowding at the centre and the run-off asymptote cannot both fit a page.

**Don't confuse.**
- Hyperbolic spiral (r=a/θ) ≠ hyperbola (the conic section). Same word "hyperbolic," unrelated curves.

**Established.** A clean classical curve; appears in optics and in some approach trajectories.

**In your work.** Hyperbolic spiral — One of your spiral catalog entries; the reciprocal cousin of the Involute/Archimedean family.

**Exercise.** Tabulate r=1/θ at θ = 0.5, 1, 2, 4, 8. The radius halves each time θ doubles — the mirror image of Fermat's slow growth.

---

## Euler spiral (clothoid)
*Spirals — curvature ∝ arc length; road transitions*

**Picture.** The gentle curve a car actually traces when you turn the wheel at a steady rate — starting straight, bending more and more tightly.

**Intuition.** Unlike the other spirals, this one is not defined by "how far out" but by "how sharply it bends." The bend increases evenly as you travel along it.

**Mathematics.** The curve whose curvature is proportional to its arc length: κ(s) = s. It has no simple r(θ) form; its coordinates are the Fresnel integrals, x(s)=∫cos(t²)dt, y(s)=∫sin(t²)dt. Two mirror spirals join smoothly at the origin.

```
κ(s) = c·s      x(s)=∫₀ˢ cos(t²)dt,  y(s)=∫₀ˢ sin(t²)dt
```

**What the equation does.** Because curvature ramps linearly, a vehicle can follow it at constant speed while turning the wheel at a constant rate — zero sudden lateral jerk. That is why railways and motorways use clothoid transition curves between straight and circular track.

**Mental picture.** Think: the wheel turning at a steady rate.

**What to notice.** It does not orbit a centre like the others — it flattens to a straight line at s=0 and curls tighter at both ends. If a "spiral" has a straight middle, it is a clothoid.

**Draw it by hand** — _Partly drawable._ Tools: ruler, protractor.
1. Drive a "turtle": draw a 5 mm segment.
2. Turn +5°, draw 5 mm. Turn +10°, draw 5 mm. Turn +15°… (add 5° every step).
3. Keep going; it curls tighter at both ends.

Turning more on each equal step IS curvature rising with arc length — the clothoid's defining rule, by hand.

**Don't confuse.**
- Euler spiral is defined by curvature vs arc-length, NOT by a radius-vs-angle law like the others in this family. It is the odd one out on purpose.

**Established.** Genuinely used in civil/rail engineering and in optics (Cornu spiral for diffraction). Fully rigorous, no folklore.

**In your work.** Euler spiral · Spiral of Theodorus (a discrete cousin) — See the spiral table: Theodorus samples √n radii but is asymptotically Archimedean.

**Exercise.** Trace the Cornu spiral by hand-summing cos(t²), sin(t²) in small steps. Watch it wind tighter as t grows — that tightening is curvature rising linearly.

---

## Golden angle & phyllotaxis
*The golden cluster — the most-confused topic in the whole guide*

**Picture.** Drop seeds one at a time around a centre, turning by the same odd angle before each drop. Pick the angle so new seeds never land in the same spokes as old ones.

**Intuition.** You are trying to avoid repetition. Any angle that is a simple fraction of a circle (like 1/5 of a turn) makes seeds fall into a few radial lines with big gaps. The "most irrational" angle avoids every such line, filling space evenly.

**Mathematics.** The golden angle is the circle divided in the golden ratio: g = 360°·(1 − 1/φ) = 360°/φ² ≈ 137.50776°, where φ = (1+√5)/2. In the standard (Vogel) model, seed n sits at angle n·g and radius c·√n — a Fermat spiral sampled at the golden angle.

```
g = 360°/φ² ≈ 137.50776°      seed n:  θ = n·g,  r = c·√n
```

**What the equation does.** Because φ is the hardest number to approximate by simple fractions, n·g never revisits a spoke, so seeds pack with no gaps. The visible interlocking spirals you can count are consecutive Fibonacci numbers (commonly 21 and 34) — a *consequence* of the angle, not an input.

**Mental picture.** Think: the turn that never lines up.

**What to notice.** In your Phyllotaxis exhibit, σ lerps the angle from 131.2° (off) to 137.507° (golden). Off-angle you see a wobbly moiré with visible spokes; at the golden angle the spokes vanish and the pack becomes seamless. That snap is the whole point — watch for the exact moment the radial gaps disappear.

**Draw it by hand** — _Drawable by hand._ Tools: protractor, ruler.
1. Centre dot = seed 0.
2. For seed n: turn exactly 137.5° from the previous direction and step out 4 mm × √n; place a dot.
3. Do about 50 seeds.
4. Now redo it at 137° and at 138°.

The star hand-demo: at 137.5° the dots pack seamlessly; half a degree off and spokes appear. You feel the sensitivity of φ with your own hand.

**Don't confuse.**
- Golden ANGLE ≠ golden RATIO. The ratio φ≈1.618 is a number; the angle ≈137.508° is a circle split by that number (360/φ²).
- Golden spiral ≠ Fibonacci spiral. Golden spiral = a true logarithmic spiral (growth φ per quarter-turn). Fibonacci spiral = quarter-circle arcs drawn in Fibonacci-sized squares — piecewise circular, only an approximation, not smooth (its curvature jumps at each square).
- Fibonacci numbers ≠ the golden ratio. They are integers; their *ratio* F(n+1)/F(n) merely converges to φ. Phyllotaxis shows Fibonacci counts because they are the denominators of the best rational approximations to 1/φ.

**Established.** Phyllotaxis is real and mechanistic: growth-tip models (Douady–Couder's magnetic-drop experiment) reproduce the golden angle and Fibonacci counts from simple repulsion. Established science.

**Interpretation (marked).** "The golden ratio is nature's divine blueprint / appears in the Parthenon / is the most beautiful proportion" — mostly interpretation, much of it retrofitted. What is established: φ arises specifically where a system optimises non-repeating packing or self-similar growth. Everywhere else, treat a golden-ratio claim as decoration until measured.

**In your work.** Phyllotaxis (symmetry.js:543) — The lerp 131.2°→137.507° is a live demonstration of why the angle has to be exact.

**Exercise.** Set the angle to exactly 360/5 = 72°: you get 5 hard spokes. Now 137.5°: the spokes dissolve. Now 137.3°: faint spirals creep back. The sensitivity around φ is the lesson.

---

## Rose curve
*Periodic curves — petal count is a parity rule*

**Picture.** A flower traced by one point whose reach from the centre swells to a full petal, shrinks to nothing, and swells again as it sweeps around.

**Intuition.** One whole number decides how many petals. The in-and-out breathing of the radius, repeated around the circle, IS the petals.

**Mathematics.** A polar curve r = cos(kθ). For integer k the petal count follows a parity rule: k odd → k petals; k even → 2k petals. (The even case draws each petal twice-over as θ runs 0→2π, tracing 2k distinct lobes.)

```
r = cos(k·θ)
```

**What the equation does.** cos swings between +1 and −1; each excursion out to +1 draws one petal. k sets how many excursions happen per lap — and the odd/even parity decides whether the negative-r lobes overlap the positive ones or fill the gaps between them.

**Mental picture.** Think: breathing radius = petals.

**What to notice.** Count the petals and check parity: 5 petals means k=5 (odd); 8 petals means k=4 (even, doubled). Your exhibit lerps k from 3.38 to 4 — at non-integer k the curve never closes and the "petals" smear into a dense rosette. Watch it snap shut only when k hits an integer.

**Draw it by hand** — _Drawable by hand._ Tools: polar graph paper (or protractor + ruler), calculator.
1. For θ every 10°, compute r = cos(k·θ).
2. Plot at that radius and angle; if r is negative, plot in the opposite direction.
3. Connect the points in order.

Do k = 5 (five petals) then k = 4 (eight!) to feel the odd/even parity rule yourself.

**Don't confuse.**
- r=cos(kθ) with integer k (clean n-fold rose) ≠ non-integer/rational k (Maurer rose / smeared rosette). Rational k closes after several laps; irrational k never closes.

**Established.** A clean parametric family. The parity rule is a theorem.

**In your work.** Rose curve (symmetry.js:477) · Maurer rose · Mystic rose — Your Rose lerps k=3.38→4; the Maurer rose is the same r=cos(kθ) sampled at wide angle-steps and connected by straight chords.

**Exercise.** Draw r=cos(2θ), cos(3θ), cos(4θ), cos(5θ). Confirm 4, 3, 8, 5 petals. The even ones surprise everyone the first time.

---

## Lissajous figure
*Periodic curves — closed only when the frequency ratio is rational*

**Picture.** Two swings at right angles — one side-to-side, one up-and-down — at slightly different speeds. The moving dot weaves looping ribbons.

**Intuition.** It is what an old oscilloscope draws from two tones. When the two speeds are a simple ratio the figure freezes into a still knot; when they drift off-ratio it tumbles forever.

**Mathematics.** A parametric curve x = sin(a·t + φ), y = sin(b·t). The figure is a *closed* curve if and only if the frequency ratio a/b is rational; otherwise the trajectory is dense (never exactly repeats). The phase φ tips the figure.

```
x = sin(a·t + φ),   y = sin(b·t)
```

**What the equation does.** Two independent sine oscillations, read as (x,y). The integer ratio a:b sets the number of horizontal vs vertical lobes; φ rotates/opens the figure (φ=π/2 turns a line into an ellipse).

**Mental picture.** Think: two tuning forks, one drawing sideways, one up.

**What to notice.** Count lobes across vs up — that is the frequency ratio directly. If the figure slowly rotates instead of holding still, the ratio is irrational (or your a is non-integer). Your exhibit fixes x-frequency at 3, so you are reading b off the vertical lobe count.

**Draw it by hand** — _Drawable by hand._ Tools: compass, ruler.
1. Draw a circle to the left divided into a equal parts, and one below divided into b parts.
2. Project horizontal lines from the left circle, vertical lines from the bottom circle.
3. Mark where step i of one meets step i of the other; connect the marks in order.

The pre-oscilloscope construction — the a:b division IS the frequency ratio.

**Don't confuse.**
- Lissajous (undamped, repeats forever) ≠ Harmonograph (the same idea with a decay term, spiralling to a stop).

**Established.** Exact and classical (Bowditch/Lissajous). Real oscilloscope physics.

**In your work.** Lissajous (symmetry.js:438) — Hardcodes x = sin(3t+φ); σ drifts the vertical rate b and the phase so the knot tumbles then locks.

**Exercise.** Set (a,b) = (2,3), then (3,4), then (3, 3.01). The first two are still knots; the third rotates slowly — that is rational vs "almost rational."

---

## Roots of unity & star polygons
*Periodic curves — the n solutions of zⁿ = 1*

**Picture.** n dots spaced perfectly evenly around a circle — the corners of a regular n-gon. Connect every k-th one and you get a star.

**Intuition.** They are the n "nth roots of 1": numbers that, raised to the n-th power, land back on 1. Geometrically that forces them onto a circle at equal spacing.

**Mathematics.** The n complex solutions of zⁿ = 1 are z_k = e^{2πik/n}, k = 0…n−1 — the vertices of a regular n-gon on the unit circle. Joining every k-th vertex (with gcd(k,n)=1) draws the star polygon {n/k}.

```
zⁿ = 1  ⇒  z_k = e^{2πi k/n},  k = 0 … n−1
```

**What the equation does.** The angle 2πk/n distributes the roots uniformly. Whether {n/k} is one continuous star or several overlaid polygons is decided entirely by gcd(k,n): coprime → single stroke, common factor → compound.

**Mental picture.** Think: the perfectly fair way to put n points on a circle.

**What to notice.** In your Roots of unity exhibit (n=9) the points start scattered and spiral onto the exact n-gon as σ→1. Whether the connecting star closes in one pass tells you if k and n share a factor.

**Draw it by hand** — _Drawable by hand._ Tools: compass, straightedge, protractor.
1. Draw a circle; mark n points every 360/n°.
2. Regular polygon: join neighbours. Star {n/k}: join every k-th point without lifting the pen.

Compass-and-straightedge, the oldest way. If the star closes in one continuous loop, gcd(k,n) = 1.

**Don't confuse.**
- Regular n-gon {n/1} ≠ star polygon {n/k}. Same vertices, different connection rule; the star exists only when 1<k<n/2 and gcd(k,n)=1.

**Established.** Pure algebra/geometry, exact.

**Interpretation (marked).** Pentagram "sacred" associations are cultural interpretation layered on the exact object {5/2}. The maths carries no meaning of its own.

**In your work.** Roots of unity (symmetry.js:508) · Star polygon · String art · Mystic rose — Mystic rose connects ALL pairs of n points (the complete graph), not just every k-th.

**Exercise.** Place 12 points. Draw {12/5} (a single star) and {12/4} (which collapses to overlaid triangles). The gcd predicts which you get.

---

## Superformula (Gielis)
*Periodic curves — one equation, thousands of natural outlines*

**Picture.** A single dial-driven shape that morphs from a circle to a starfish to a square to a flower as you turn six knobs.

**Intuition.** A generalisation of the circle: keep the "distance from centre depends on angle" idea, but let a few exponents warp how the radius responds. Small changes in the exponents give wildly different but always-symmetric outlines.

**Mathematics.** The superformula gives r(θ) for a supershape via r(θ) = [ |cos(mθ/4)/a|^{n₂} + |sin(mθ/4)/b|^{n₃} ]^{−1/n₁}. m sets the rotational symmetry (number of "arms"); n₁,n₂,n₃ set how sharp, pinched or bulging they are; a,b scale the axes.

```
r(θ) = ( |cos(mθ/4)/a|^{n₂} + |sin(mθ/4)/b|^{n₃} )^{−1/n₁}
```

**What the equation does.** The m/4 inside the trig sets how many lobes fit in a full turn (m-fold symmetry). The exponents n bend the lobes between concave stars, round petals and hard polygons. It is a superset containing circles, ellipses, superellipses and rosettes.

**Mental picture.** Think: a circle with adjustable personality.

**What to notice.** m controls symmetry order; the n exponents control "pointiness." Sweep m over integers and count arms; push n₁ down to fatten, up to sharpen. Your Supershape/Superformula and Superellipse-bloom exhibits are the same family with different knob paths.

**Draw it by hand** — _Partly drawable._ Tools: protractor, ruler, calculator.
1. Pick m (say 6) for six-fold symmetry.
2. For θ every 15°, compute r from the formula and plot; join.

Doable for a handful of points with a calculator, but the exponents make it fiddly — it is really a computer shape.

**Don't confuse.**
- Superformula (Gielis, 2003) is a modern *parametrisation*, not an ancient law. It fits many shapes but does not "explain" them — flexibility is not evidence.

**Established.** A real, useful shape-generator. Genuinely spans many biological outlines.

**Interpretation (marked).** Because it can fit almost anything, a good fit proves little on its own. Treat "the superformula describes X in nature" as curve-fitting, not mechanism.

**In your work.** Superformula · Supershape · Superellipse bloom — Superellipse is the special case |x/a|^n+|y/b|^n=1 (the squircle) — the bloom sweeps its exponent.

**Exercise.** Fix m=6 and slide n₁ from 0.3 to 40. Watch the same six-fold shape go from a soft blob to a hard hexagon. Symmetry stayed; personality changed.

---

## Epicycloid & hypocycloid
*Periodic curves — circles rolling on circles*

**Picture.** A pen stuck to the rim of a coin that rolls around the outside (or inside) of another coin — the classic Spirograph.

**Intuition.** The traced curve depends only on the ratio of the two circles' radii. A whole-number ratio gives a closed shape with that many cusps; a fractional ratio makes it wind many times before closing.

**Mathematics.** Rolling a circle of radius r on the OUTSIDE of a fixed circle R traces an epicycloid; on the INSIDE, a hypocycloid. With k = R/r: k=1 epicycloid = cardioid; k=2 hypocycloid = a straight diameter (Cardano); k=3 = deltoid; k=4 = astroid.

```
epicycloid:  x=(R+r)cosθ − r·cos((R+r)/r·θ),  y=(R+r)sinθ − r·sin((R+r)/r·θ)
```

**What the equation does.** The two nested cosines are two rotations composed — literally a two-term Fourier series. The radius ratio sets the second frequency, hence the cusp count. Rational ratio → closes; irrational → never closes.

**Mental picture.** Think: Spirograph. Ratio picks the flower.

**What to notice.** Count the cusps (outward points) — that is the radius ratio. Your Times-table cardioid is the same cardioid arising a totally different way: from joining n → 2n on a circle of points.

**Draw it by hand** — _Drawable by hand._ Tools: a Spirograph set (or two cardboard discs + a pen).
1. Hold the big ring still.
2. Put your pen in a hole of the small gear and roll it around the inside (hypocycloid) or outside (epicycloid).
3. Swap gears to change the ratio.

The toy literally IS the maths: the teeth ratio sets the cusp count.

**Don't confuse.**
- Epicycloid (rolls outside, cusps point outward) ≠ hypocycloid (rolls inside, cusps point inward). Also ≠ epitrochoid/hypotrochoid, where the pen is not on the rim (true Spirograph loops).

**Established.** Exact classical kinematics; was once used to model planetary "epicycles."

**Interpretation (marked).** The historical epicycle astronomy was wrong physics but not wrong maths — any orbit can be Fourier-approximated by enough epicycles. Fit ≠ truth, again.

**In your work.** Epicycloid gears · Hypocycloid · Spirograph · Times-table cardioid — Epicycloid gears show the Fourier clockwork; σ integer-locks the ratio so the figure closes.

**Exercise.** Roll k=2,3,4 inside a circle: you get a line, a deltoid (3 cusps), an astroid (4 cusps). The integer k IS the cusp count.

---

## Clifford / De Jong / Hopalong
*Chaos — iterated maps — discrete strange attractors*

**Picture.** Take a dot, move it by a fixed recipe, then move the new dot by the same recipe — a hundred thousand times. The marks pile up into a creature no one could read off the numbers.

**Intuition.** Nothing is random and nothing is drawn smoothly. Each point *jumps* to a new spot; where the jumps pile up densely, structure appears.

**Mathematics.** A deterministic 2-D iterated map: xₙ₊₁ = sin(a·yₙ) + c·cos(a·xₙ), yₙ₊₁ = sin(b·xₙ) + d·cos(b·yₙ). The orbit neither converges to a point nor diverges — it is drawn onto a fractal "strange attractor." Colour by point density.

```
xₙ₊₁ = sin(a·yₙ) + c·cos(a·xₙ)
yₙ₊₁ = sin(b·xₙ) + d·cos(b·yₙ)
```

**What the equation does.** The sines fold the plane back on itself; iterating that fold is what stretches-and-folds an orbit onto a fractal. Four constants (a,b,c,d) fully determine the creature — change one slightly and a different creature appears.

**Mental picture.** Think: same jump, a hundred thousand times.

**What to notice.** These are drawn as a *cloud of dots*, not a line — because consecutive points are far apart. If you see a smooth continuous curve, it is NOT this family.

**Draw it by hand** — _Not a pen-and-paper shape._ Tools: calculator (for the atom only).
1. You cannot hand-draw the attractor — it needs tens of thousands of iterations.
2. The atom you CAN do: iterate x,y ← sin(a·y)+c·cos(a·x), sin(b·x)+d·cos(b·y) about 20 times and plot each dot.

You will see the points scatter, not the creature — which is the point: the shape lives only in the density of many iterations.

**Don't confuse.**
- Iterated MAP (Clifford, De Jong, Hopalong — discrete jumps, 2-D) ≠ continuous FLOW (Lorenz — a smooth trajectory from a differential equation). See "The three kinds of chaos" below.

**Established.** Well-defined dynamical systems; the attractor is a genuine fractal set.

**Interpretation (marked).** "You can't predict the shape from the numbers" is literally true here (no closed form) — but that is unpredictability of *computation*, not mysticism.

**In your work.** Clifford (symmetry.js:592) · De Jong · Hopalong · your generic attractor() — All three share one iterator with different parameter sets; σ lerps chaos params → symmetric ones.

**Exercise.** Iterate the Clifford map 50 times by hand-ish (or trust the canvas): note that consecutive points scatter across the whole figure. Density, not order of visiting, makes the picture.

---

## Lorenz attractor
*Chaos — continuous flows — the butterfly; a flow, not a map*

**Picture.** A single point chasing three simple rules about a rolling fluid, looping forever around two wings, never repeating, never escaping.

**Intuition.** This is a smooth trajectory in 3-D, steered moment to moment by how fast each coordinate is changing. Two starts a hair apart stay close, then peel completely apart — the butterfly effect.

**Mathematics.** A system of three coupled ordinary differential equations: ẋ = σ(y−x), ẏ = x(ρ−z) − y, ż = xy − βz, with the classic chaotic parameters σ=10, ρ=28, β=8/3. The solution is a bounded, non-repeating orbit on a fractal attractor.

```
ẋ = σ(y−x)
ẏ = x(ρ−z) − y
ż = xy − βz
```

**What the equation does.** The dots over x,y,z mean "rate of change now." Each rate depends on the current position, so the point self-steers. The gentle cross-terms (xy, xz) bend the flow into two lobes and hand the orbit back and forth between them unpredictably.

**Mental picture.** Think: a smooth ribbon looping two wings.

**What to notice.** It is a *continuous line*, not a dot cloud (that is the tell vs Clifford). Watch how long two nearby starts track before diverging — that sensitivity is deterministic chaos, not noise.

**Draw it by hand** — _Not a pen-and-paper shape._ Tools: graph paper, calculator.
1. The full butterfly needs numerical integration — not a hand shape.
2. Nearest hands-on: take about 30 small Euler steps (x += ẋ·dt, …) and plot; watch the path bend between two lobes.

You feel the flow, not the finished attractor. An honest limit of pen and paper.

**Don't confuse.**
- The σ in Lorenz's equations (a fluid parameter, =10) is NOT the σ order-parameter your installation uses for chaos→symmetry. Same Greek letter, different jobs.
- Lorenz (continuous ODE flow) ≠ Clifford (discrete map). Both "strange attractors," fundamentally different objects.

**Established.** Foundational chaos theory (Lorenz 1963). Rigorous; the attractor's existence was later proved.

**Interpretation (marked).** "Butterfly effect" is a real technical property (sensitive dependence), often mis-told as "tiny causes always cause huge effects everywhere." It means *forecast error grows exponentially in this system*, not a life philosophy.

**In your work.** Lorenz (symmetry.js:1038) · Aizawa · Thomas — Your Aizawa and Thomas exhibits are other continuous-ODE attractors — the flow family.

**Exercise.** Integrate the Lorenz system from (0,1,0) and from (0,1.001,0). Plot both. They overlap, then separate — you have just measured chaos.

---

## Mandelbrot & Julia sets
*Fractals — escape-time — one feedback loop, infinite coastline*

**Picture.** For every pixel, run a tiny loop — square the number, add the pixel, repeat — and ask: does it run off to infinity, or stay put forever?

**Intuition.** The dark set is the points that never escape. Colour the escapees by how fast they flee and an infinitely detailed, self-studded coastline appears — all from one short rule.

**Mathematics.** Iterate zₙ₊₁ = zₙ² + c. Mandelbrot set: fix z₀=0, let c be the pixel — the set of c for which the orbit stays bounded. Julia set: fix c, let z₀ be the pixel — the boundary between bounded and escaping orbits for that c. Every point of the Mandelbrot set indexes a different Julia set.

```
zₙ₊₁ = zₙ² + c   (z, c complex).   Bounded ⇒ inside.
```

**What the equation does.** Squaring a complex number doubles its angle and squares its length — a stretch-and-wrap. Adding c nudges it. Points near the boundary are pathologically sensitive to that nudge, which is what makes the edge infinitely crinkly (its boundary has fractal dimension 2).

**Mental picture.** Think: "does this seed blow up?" — asked a million times.

**What to notice.** The Mandelbrot is a *map of all Julia sets*: pick a c inside the main cardioid and its Julia set is a connected blob; pick c outside and the Julia set shatters into dust. That c-vs-z swap is the single most important idea here.

**Draw it by hand** — _Not a pen-and-paper shape._ Tools: calculator.
1. Per-pixel escape tests — not drawable by hand.
2. The atom: pick one c, iterate z ← z²+c about 10 times, decide bounded or escaped. You just computed ONE pixel.

Colour a whole grid that way and you would have it — but that is thousands of calculations. Genuinely a computer's job.

**Don't confuse.**
- Mandelbrot (c varies, z₀=0) ≠ Julia (z varies, c fixed). Same formula z²+c, opposite variable held fixed.
- Escape-time fractal (Mandelbrot, Julia, Newton) ≠ IFS fractal (Koch, Sierpiński) ≠ strange attractor (Clifford, Lorenz). Three different machines that all make fractals.

**Established.** Rigorous complex dynamics. The Mandelbrot set is connected (proved). Self-similar-ish but NOT exactly self-similar — it has quasi-copies, not identical ones.

**Interpretation (marked).** Often called "the thumbprint of God" — that is a vibe, not maths. The awe is fine; the claim is decoration on a two-symbol formula.

**In your work.** Mandelbrot (symmetry.js:1166) · Julia set · Newton fractal — Newton fractal colours each pixel by which root of a polynomial Newton's method lands on — a different escape-time idea (basins of attraction).

**Exercise.** Pick c = −0.8 + 0.156i and iterate a few pixels. Some stay bounded, some escape — the boundary between them is that c's Julia set.

---

## Koch, Sierpiński, Dragon, fern
*Fractals — self-similar (IFS) — exact self-similarity by rule-replacement*

**Picture.** Start with a triangle. On the middle of every edge, push out a smaller triangle. Repeat forever. You get a perfect six-sided snowflake with an infinitely long border.

**Intuition.** These are built by replacing each piece with several smaller copies of the whole — a rule applied over and over. Zoom in and you find literal, exact copies (unlike Mandelbrot's near-copies).

**Mathematics.** An Iterated Function System: a small set of contraction maps whose union, applied repeatedly, converges to a unique fixed "attractor" set. Fractal (Hausdorff) dimension = log(#copies)/log(1/scale). Koch: log4/log3 ≈ 1.262. Sierpiński triangle: log3/log2 ≈ 1.585.

```
Koch edge → 4 edges at ⅓ scale.   dim = log 4 / log 3 ≈ 1.262
```

**What the equation does.** Each pass multiplies length by 4/3 (Koch) while the shape stays bounded — so the border tends to infinite length enclosing finite area. The dimension formula measures exactly how "space-filling" that roughness is: between a line (1) and a plane (2).

**Mental picture.** Think: each part is a smaller copy of the whole.

**What to notice.** True self-similarity: an exact miniature at every zoom. The Barnsley fern is the same IFS idea with four affine maps chosen by weighted chance — every frond is a shrunk whole fern.

**Draw it by hand** — _Drawable by hand._ Tools: ruler, pencil.
1. Koch: draw a line; on its middle third build an outward triangular bump (1 segment → 4).
2. Repeat on every new segment. Two or three levels is plenty by hand.
3. Sierpiński: draw a triangle, join the midpoints, repeat on the three outer triangles.

You are literally copying the whole rule into each part — exact self-similarity you can feel.

**Don't confuse.**
- IFS/self-similar (Koch, Sierpiński, Dragon, fern — exact copies) ≠ escape-time (Mandelbrot — quasi-copies) ≠ space-filling (Hilbert — a curve of dimension 2 that visits every point).
- Dragon curve fills a region (boundary dimension ≈1.52) and famously TILES the plane — it is not just a wiggly line.

**Established.** Exact fractal dimensions are theorems. The fern's IFS is a real, tiny 4-map program.

**Interpretation (marked).** "Fractals are everywhere in nature" is half-true: many natural objects are *statistically* self-similar over a limited range of scales, not exactly self-similar forever. Coastlines are fractal-ish between metres and kilometres, not at every scale.

**In your work.** Koch snowflake (1230) · Sierpiński carpet · Dragon curve · Hilbert curve · Barnsley fern — Chaos game (below) reaches the SAME Sierpiński attractor by randomness instead of rule-replacement.

**Exercise.** Compute Sierpiński's dimension: 3 copies at half scale → log3/log2 ≈ 1.585. It is "more than a line, less than a triangle" — and that number says exactly how much.

---

## The chaos game
*Fractals — self-similar (IFS) — randomness that builds order*

**Picture.** Mark three dots (a triangle). Drop a point anywhere. Repeatedly: pick a corner at random, jump halfway toward it, mark. Out of pure randomness, the Sierpiński triangle appears.

**Intuition.** Random *choices*, deterministic *rule*. The "jump halfway to a random vertex" rule can never land a point in the central holes, so the holes stay empty and the fractal emerges.

**Mathematics.** A random Iterated Function System: repeatedly apply one of the IFS contraction maps chosen at random. The orbit visits the same attractor as the deterministic IFS (here, the Sierpiński triangle), because the attractor is invariant under every map in the set.

```
pₙ₊₁ = ½·(pₙ + V_random)     with V a random one of 3 vertices
```

**What the equation does.** Halving the distance to a vertex is a contraction toward that vertex; the three contractions share the Sierpiński gasket as their common fixed set, so *any* sequence of them paints it. The randomness only controls the order of painting, not the picture.

**Mental picture.** Think: random path, fixed destination.

**What to notice.** The picture is identical to the rule-built Sierpiński — proof that the *randomness is cosmetic*. Change the jump fraction or vertex count and a different gasket appears.

**Draw it by hand** — _Drawable by hand._ Tools: paper, ruler, a die.
1. Mark 3 corners of a triangle. Put a dot anywhere inside.
2. Roll the die: 1–2 → corner A, 3–4 → B, 5–6 → C.
3. Mark the midpoint between your last dot and that corner.
4. Repeat 100+ times.

The best pen-and-paper demo in the guide: pure randomness paints the exact Sierpiński triangle. Order out of dice.

**Don't confuse.**
- Chaos game randomness ≠ actual disorder. It is randomness constrained by contraction maps, which is why it produces exact order. "Chaos" here is a name, not entropy.

**Established.** A theorem (Barnsley). The attractor is reached with probability 1.

**Interpretation (marked).** A great antidote to "random = messy." Constraint shapes randomness into structure — the honest lesson, no mysticism.

**In your work.** Chaos game (symmetry.js) · Sierpiński carpet — Same target set as the IFS Sierpiński; different route there.

**Exercise.** Play it with 4 vertices and jump ratio ½ — you get a filled square, NOT a fractal. Now ratio ⅔ with 4 vertices — a carpet. The ratio decides everything.

---

## Ulam & Sacks spirals
*Primes on a grid — the primes refuse to scatter*

**Picture.** Write 1,2,3,4… on a square spiral winding outward, then light up only the primes. They line up on diagonals instead of scattering.

**Intuition.** The diagonals are not a fluke: many are prime-rich quadratics like n²+n+41. The Sacks spiral lays the same numbers on a smooth √-spiral so those broken diagonals unroll into clean arcs.

**Mathematics.** Ulam: place integer n on a square-lattice spiral, mark primes. Diagonal lines correspond to quadratic polynomials 4n²+bn+c, some of which (Euler's n²+n+41) are unusually prime-dense. Sacks: place n at radius √n, angle 2π√n — because both depend on √n, Sacks is an Archimedean spiral sampled at the integers, with perfect squares on one ray.

```
Ulam: n on a square spiral · mark primes
Sacks: (r,θ) = (√n, 2π√n)
```

**What the equation does.** There is no formula for the *shape* — it is a portrait of the primes themselves. The visible structure comes from prime-generating polynomials landing on straight lines (Ulam) or smooth arcs (Sacks). It brushes against deep unsolved problems (Hardy–Littlewood).

**Mental picture.** Think: primes have secret rows.

**What to notice.** FIELD NOTE / a real discrepancy: Sacks *looks* like a Fermat spiral (r=√n) but is actually **Archimedean** — because θ=2π√n means r = θ/2π, linear in angle. Same trick as the Spiral of Theodorus (√n radii, but the angle also grows like √n, netting linear spacing). Radii alone do not tell you the growth law; you must account for the angle.

**Draw it by hand** — _Drawable by hand._ Tools: squared paper.
1. Write 1 in a central square; spiral outward 2, 3, 4, 5…
2. Circle every prime as you go.
3. Keep going to about 100–150.

Tedious but real — the diagonal streaks of primes appear with no help from you.

**Don't confuse.**
- Ulam's diagonals are real structure, but "primes are secretly periodic" is FALSE — the diagonals are prime-*dense*, not prime-*only*, and primes remain provably aperiodic.
- Sacks spiral (r=√n) is Archimedean, NOT Fermat — despite the √n radius. See the field note.

**Established.** The polynomial-diagonal explanation is solid. Prime-density along quadratics connects to genuine open conjectures.

**Interpretation (marked).** "Hidden order in the primes proves a cosmic pattern" — no. There is structure (density biases), and there is also proven randomness-like behaviour. Both true; neither mystical.

**In your work.** Ulam spiral (682) · Sacks spiral (775) — Same integers, two lattices; the Sacks arcs are the Ulam diagonals unrolled.

**Exercise.** Circle 41, 43, 47, 53, 61, 71, 83 (that is n²+n+41 for n=0…6). All prime. Now find where they sit on the Ulam spiral: one diagonal.

---

## Kuramoto fireflies
*Synchrony — this IS your σ order-parameter*

**Picture.** A field of fireflies each blinking at its own pace. Let each nudge its rhythm toward its neighbours' and — past a threshold — they all flash as one.

**Intuition.** Each oscillator feels a pull toward the average phase. Weak coupling: everyone stays independent (incoherent). Strong coupling: a sudden collective lock-in. There is a sharp transition, not a gradual blend.

**Mathematics.** The Kuramoto model: dθ_i/dt = ω_i + (K/N)·Σ_j sin(θ_j − θ_i). Coherence is measured by the order parameter R·e^{iψ} = (1/N)·Σ_j e^{iθ_j}, with R ∈ [0,1]: R=0 fully incoherent, R=1 fully synchronised. Above a critical coupling K_c, R jumps off zero.

```
dθ_i/dt = ω_i + (K/N)·Σ_j sin(θ_j − θ_i)
R·e^{iψ} = (1/N)·Σ_j e^{iθ_j}
```

**What the equation does.** The sin(θ_j−θ_i) term pulls each oscillator toward the crowd; K is how hard. R is literally the length of the average of all phase-arrows on the unit circle — scattered arrows cancel (R≈0), aligned arrows add (R≈1).

**Mental picture.** Think: fireflies deciding to blink together.

**What to notice.** This is the mathematical twin of your whole installation. Your σ (chaos→symmetry) is an order parameter exactly like Kuramoto's R — 0 = desynchronised/chaotic, 1 = phase-locked/symmetric. Your Kuramoto exhibit's throb IS R. Watch the sudden lock-in as coupling crosses K_c; that is a phase transition, not a fade.

**Draw it by hand** — _Not a pen-and-paper shape._ Tools: a group of people (or metronomes).
1. Not a drawing — it is a synchrony you enact.
2. Metronomes on a wobbly board, or a crowd told "clap in time with your neighbours," drift into lock-step.

The honest version: this one you perform, not sketch. It is R climbing in the real world.

**Don't confuse.**
- Kuramoto's R (a measured order parameter, an output) ≠ the coupling K (the control knob, an input). Raising K makes R jump; they are cause and effect, not the same quantity.

**Established.** Rigorous, widely validated (fireflies, pacemaker cells, power grids, applause). K_c is derivable.

**Interpretation (marked).** The firefly story is a real instance, not a metaphor — this is one of the rare cases where the poetry is also the mathematics.

**In your work.** Kuramoto fireflies (symmetry.js) — σ = the coupling K; the throb the exhibit shows is the true order parameter R. The clearest bridge in your catalog between the art's central idea and a named model.

**Exercise.** Simulate 100 oscillators with spread-out natural frequencies. Sweep K up: R stays ~0, then snaps toward 1 at K_c. Plot R vs K — you drew a phase transition.

---

## Quasicrystal & Penrose tiling
*Waves & aperiodic order — ordered but never repeating*

**Picture.** Overlay several tilted ripple-patterns (plane waves) at equal angles. Where five of them cross, a starry pattern appears that has fivefold symmetry but never exactly repeats.

**Intuition.** Ordinary crystals repeat by sliding (translation). A quasicrystal has long-range order and rotational symmetry (5-, 8-, 10-fold) that a repeating lattice mathematically *cannot* have — so it orders without ever tiling periodically.

**Mathematics.** Sum N plane waves at equal angular spacing: f(x,y) = Σ_{k=0}^{N−1} cos( x·cosθ_k + y·sinθ_k ), θ_k = πk/N. For N=5 this yields a pattern with fivefold symmetry and no translational period — the Fourier signature of a Penrose tiling / quasicrystal.

```
f(x,y) = Σ_{k} cos( x·cos θ_k + y·sin θ_k ),   θ_k = πk/N
```

**What the equation does.** Each cosine is one direction of ripples; summing several tilted sets creates interference maxima. When N gives a symmetry forbidden to periodic lattices (5-fold), the maxima can never line up into a repeating grid — order without periodicity.

**Mental picture.** Think: ordered, but it never quite repeats.

**What to notice.** You can find local patches that look identical, but you can never shift the whole pattern onto itself. That "same-but-never-repeats" is the defining discrepancy vs a normal lattice.

**Draw it by hand** — _Partly drawable._ Tools: tracing paper, ruler.
1. Rule a set of equally-spaced parallel lines.
2. Copy the same ruling onto 5 sheets of tracing paper.
3. Rotate each sheet by 36° and stack them.
4. Look through the stack.

The overlaid interference IS the sum of 5 plane waves — a fivefold quasicrystal, by hand, no computer.

**Don't confuse.**
- Quasicrystal / Penrose (aperiodic: long-range order, NO translational symmetry) ≠ periodic crystal (repeats by sliding). Fivefold symmetry is possible for the first and impossible for the second (crystallographic restriction theorem).
- Aperiodic ≠ random. A quasicrystal is highly ordered; it just is not periodic.

**Established.** Real physics — Shechtman's quasicrystals won the 2011 Nobel; Penrose tilings are rigorous aperiodic sets. The plane-wave construction is exact.

**Interpretation (marked).** "Impossible fivefold symmetry" is a great hook and it is literally true for *periodic* crystals — the resolution (aperiodic long-range order) is the actual content, not a paradox.

**In your work.** Quasicrystal (symmetry.js) · Moiré interference · Chladni plate · Standing wave — All four are interference of waves; the quasicrystal is the aperiodic 5-wave case.

**Exercise.** Add 2 tilted cosine gratings → a periodic checker/moiré. Add 5 at equal angles → a fivefold star that never repeats. The jump from 2 to 5 is the jump from crystal to quasicrystal.

---

## The spiral growth-law table

The single most useful page for telling your spirals apart. They all "wind outward"; the growth law is where they truly differ. Read the r(θ) column first — everything else follows from it.

| Spiral | Law  r(θ) | Turn spacing | Self-similar? | Signature to look for | Your exhibit |
| --- | --- | --- | --- | --- | --- |
| Archimedean | r = a + bθ | constant (2πb) | no | equal gaps everywhere | Involute, (Sacks*) |
| Logarithmic | r = a·e^{bθ} | multiplies ×e^{2πb}/turn | YES | constant crossing-angle; looks same at every zoom | Logarithmic, Galaxy, Doyle |
| Fermat | r = a·√θ | shrinks outward | no | gaps get tighter; two arms; equal area/turn | Fermat, Phyllotaxis |
| Hyperbolic | r = a/θ | grows then loosens; straight asymptote | no | never reaches centre; straight-line asymptote outward | Hyperbolic |
| Euler / clothoid | κ(s) = c·s | n/a (curvature-defined) | no | straight in the middle, curls tighter at both ends | Euler |
| Theodorus* | vertices at r=√n | → π (asymptotically) | no | discrete right-triangles; secretly Archimedean | Spiral of Theodorus |
| Sacks* | r=√n, θ=2π√n | constant | no | squares on one ray; IS Archimedean (r=θ/2π) | Sacks |

> * FIELD NOTE: Theodorus and Sacks both place points at radius √n, which *looks* like Fermat — but their angle also grows like √n, so the net law is r ∝ θ, i.e. Archimedean. Radii alone never tell you the growth law; you must divide out the angle. This is exactly the kind of discrepancy the guide exists to catch.

---

## The three kinds of "chaos"

Your catalog bins these together as "beautiful chaos," but they are three different machines. Knowing which one you are looking at tells you how it is drawn and how it behaves.

| Machine | Object | Rule | Drawn as | Members in your catalog |
| --- | --- | --- | --- | --- |
| Iterated map | discrete orbit on a fractal attractor | xₙ₊₁ = f(xₙ) — a jump each step | a cloud of scattered dots (density = shape) | Clifford, De Jong, Hopalong |
| Continuous flow | smooth trajectory of an ODE | ẋ = f(x) — a rate at every instant | one continuous ribbon/line | Lorenz, Aizawa, Thomas |
| Escape-time fractal | set of points by a boundedness test | zₙ₊₁ = z²+c — does it blow up? | coloured pixels (escaped how fast) | Mandelbrot, Julia, Newton |

> Tell them apart instantly: dot cloud → iterated map; smooth line → ODE flow; coloured pixel field → escape-time. All three are deterministic; none is random.

---

## The kinds of fractal (self-similarity is not one thing)

"Fractal" covers several distinct constructions with different *kinds* of self-similarity. Do not assume a fractal contains exact copies of itself — most do not.

| Kind | How it is built | Self-similarity | Members |
| --- | --- | --- | --- |
| IFS / L-system | replace each part with smaller copies of the whole | EXACT (literal miniatures) | Koch, Sierpiński, Dragon, Barnsley fern |
| Escape-time | boundedness of z²+c per pixel | quasi-self-similar (near-copies, not exact) | Mandelbrot, Julia, Newton |
| Space-filling | a curve routed to visit every point | exact, dimension = 2 | Hilbert curve |
| Random IFS | IFS maps chosen at random (chaos game) | exact (randomness only picks the order) | Chaos game → Sierpiński |
| Statistical | pattern-forming PDE / natural process | statistical, over a limited scale range | Reaction–diffusion; real coastlines |

> The Mandelbrot set is the classic trap: it is NOT exactly self-similar — its mini-Mandelbrots are subtly different, joined by filaments. "Fractals repeat forever identically" is false for most of this table.

---

## Don't confuse — the master list

**Golden spiral ≠ Fibonacci spiral.** The golden spiral is a true logarithmic spiral (smooth, growth φ/quarter-turn). The Fibonacci spiral is quarter-circle arcs in Fibonacci-sized squares — piecewise circular, curvature jumps at each seam, only an approximation.

**Fibonacci numbers ≠ the golden ratio.** Fibonacci are integers (1,1,2,3,5,8…). Their consecutive RATIO converges to φ, but no Fibonacci number equals φ. The connection is a limit, not an identity.

**Golden angle ≠ golden ratio.** φ≈1.618 is a number. The golden angle ≈137.508° is a full circle divided by φ² — a geometric consequence of φ, not φ itself.

**A curve resembling a log spiral ≠ an actual log spiral.** The nautilus is a genuine log spiral — but with growth ≈1.3/quarter-turn, NOT φ. Resemblance is not identity, and a fitted spiral is not a measured law.

**Mathematical relationship ≠ sacred-geometry claim.** φ genuinely appears where packing must be non-repeating or growth self-similar. "φ is in the Parthenon / your face / the stock market" is mostly retrofitted numerology. Keep the theorem, drop the temple — unless it is measured.

**Ulam diagonals ≠ periodic primes.** The diagonals are prime-DENSE (quadratics), not prime-only. Primes are provably not periodic; the structure is a density bias, not a hidden clock.

**Strange attractor ≠ randomness.** Lorenz/Clifford are fully deterministic. They look erratic because of sensitive dependence, but the same start always gives the same orbit.

**σ (order parameter) ≠ σ (Lorenz parameter).** In your installation and in Kuramoto, σ/R means "how synchronised, 0→1." In the Lorenz equations σ is a fluid constant (=10). Same letter, unrelated roles.

---

## Things I thought I understood

- A √n radius means "Fermat spiral." — No: if the angle also grows like √n (Sacks, Theodorus), the net law is Archimedean. Always divide out the angle.
- The nautilus is the golden ratio. — No: it is a logarithmic spiral, growth ≈1.3/quarter-turn, not φ.
- Fibonacci spiral = golden spiral. — No: one is circular arcs (approximation), one is a smooth log spiral.
- Even-k rose curves have k petals. — No: even k gives 2k petals; only odd k gives k.
- Fractals are exactly self-similar. — Mostly no: Mandelbrot is only quasi-self-similar; natural "fractals" are statistical over a limited range.
- Chaos = randomness. — No: deterministic chaos is fully repeatable; "random"-looking is sensitivity, not noise.
- The chaos game is random art. — No: the randomness only sets painting order; the picture (Sierpiński) is fixed by the maps.
- Fivefold symmetry is impossible. — Only for PERIODIC crystals; quasicrystals achieve it with aperiodic long-range order.
- More epicycles / a flexible formula "explains" a shape. — No: enough terms fit anything. Fit is not mechanism.

---

## Full taxonomy — all 66 exhibits by family

**Spirals.** Logarithmic spiral · Fermat spiral · Hyperbolic spiral · Euler spiral · Spiral of Theodorus · Sacks spiral · Doyle spiral · Involute spiral · Galaxy · Spherical spiral · Recamán · Double helix

**Periodic curves.** Rose curve · Maurer rose · Mystic rose · Lissajous · Harmonograph · Lemniscate · Hypocycloid · Epicycloid gears · Spirograph · Times-table cardioid · Superformula · Supershape · Superellipse bloom · Star polygon · Roots of unity · String art

**Chaos — maps.** Clifford attractor · De Jong attractor · Hopalong

**Chaos — flows.** Lorenz attractor · Aizawa attractor · Thomas attractor

**Fractals — escape-time.** Mandelbrot set · Julia set · Newton fractal

**Fractals — self-similar.** Koch snowflake · Sierpiński carpet · Dragon curve · Hilbert curve · Barnsley fern · Chaos game

**Primes.** Ulam spiral · Sacks spiral

**Waves & interference.** Chladni plate · Standing wave · Quasicrystal · Moiré interference · Plasma · Reaction diffusion

**Synchrony & agents.** Kuramoto fireflies · Flocking · Flow field · Game of Life · Cellular automaton

**Tilings & packings.** Truchet tiles · Voronoi shatter · Ford circles · Metaballs · Penrose (see Quasicrystal)

**Symmetry & ornament.** Kaleidoscope · Mandala · Guilloché · Icosahedron · Torus · Torus knot

---

*Authored and checked in one voice. Formulas match `web/viz/symmetry.js`; where the code differs from the ideal shape (e.g. Lissajous fixes its x-frequency at 3), that is noted as a discrepancy, not hidden. Firewall holds: math and shapes only. This document is meant to grow — add a shape, tighten a proof, mark a new confusion.*
