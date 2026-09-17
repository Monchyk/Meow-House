# The Sacred Geometry Lightshow Playbook: Implementing Math Patterns for VJing, Lasers, LEDs & DMX

## TL;DR
- **The highest-payoff wins are shader-based:** the times-table cardioid, phyllotaxis (Vogel) morphing, kaleidoscope-fold feedback, and Julia-set c-orbiting are all 20–60 lines of GLSL that score 9–10 on "woah dude" while running at 60fps. Build them as **ISF shaders** (open format, runs in Resolume/VDMX/free ISF editor) or in **Hydra** (browser live-coding, free) for instant results, and reserve **TouchDesigner** (free non-commercial) for audio-reactive patching and hardware output.
- **Match pattern to medium:** dense fractals (Mandelbrot/Julia, reaction-diffusion) belong on projectors/LED walls; parametric curves (Lissajous, roses, spirographs) are *the* native laser-galvo content; low-res patterns (Game of Life, phyllotaxis dots, cellular automata) shine on WS2812B/APA102 LED matrices; and pan/tilt curves (Lissajous, circles, figure-eights) drive DMX moving-head beam arrays via QLC+'s EFX engine.
- **Audio-reactivity is the amplifier:** split FFT into bass/mid/treble, smooth with attack/release envelopes, map **bass→scale/zoom**, **beat/onset→discrete parameter jumps** (palette, symmetry count), **spectral centroid→color**. Always respect photosensitivity limits — **keep full-field flashing under 3 flashes/second** (W3C WCAG 2.2 SC 2.3.1, Level A: "Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds") to avoid triggering seizures.

## Key Findings

1. **Free/open-source is a complete pipeline.** You can go math→screen→hardware entirely on Linux with free tools: GLSL/ISF for the visuals, Hydra or glslViewer for live-coding, TouchDesigner (free tier) or Python (moderngl/numpy) for logic, and stupidArtnet/OLA/WLED/xLights/FPP/QLC+ for output over Art-Net/sACN/DMX. The only paid links in the chain are optional (Resolume, Pangolin laser software).

2. **The "woah dude" ceiling is set by motion, symmetry, and color-cycling, not by pattern complexity.** A trivially simple times-table cardioid animated by sweeping its multiplier is more hypnotic than a static high-detail fractal. Radial symmetry (kaleidoscope folding), feedback (fractal zoom), and Íñigo Quílez cosine-palette cycling are the three universal "amplifiers."

3. **Parametric curves and lasers are a perfect marriage.** A laser draws with a single moving beam (vector), so anything expressible as (x(t), y(t)) — Lissajous, rose, spirograph, harmonograph, spiral — renders natively without rasterization. This is why these are the classic laser looks.

4. **Moving heads are mechanically slow (~0.2–25.5 s per move on pro fixtures), so they trace curves at low temporal resolution** — the opposite of laser galvos (20–40 kpps). QLC+'s EFX function already implements Circle/Eight/Lissajous/Diamond/Leaf paths with exactly the frequency/phase parameters you'd expect.

5. **Safety is non-negotiable at events:** the 3-flashes-per-second rule (Harding test / WCAG 2.3.1), and for lasers, US FDA variance requirements that effectively prohibit audience scanning without specially-certified projectors.

---

## Details

### PART 1 — PER-PATTERN IMPLEMENTATION PLAYBOOKS

Each playbook gives: core math, parameters to animate, audio mapping, color strategy, and ratings on 1–10 scales for **Woah** (psychedelic impact), **Difficulty**, and **GPU/CPU cost** (higher = more expensive).

---

#### 1.1 Phyllotaxis / Vogel Sunflower Spiral — Woah 9 | Difficulty 2 | Cost 2
**Core math (Vogel 1979):** In polar coordinates, seed *n* is placed at
θ = n · α, r = c·√n, where α = 360°/φ² ≈ **137.50776°** (the golden angle), φ = (1+√5)/2.
The √n spacing gives equal area per seed; the golden angle guarantees no two seeds align, producing the interlocking Fibonacci-number spiral families (21/34/55/89…).

**Animate for max effect:** Sweep the divergence angle α through a tiny window around 137.5° (e.g. 137.3°→137.7°). This is the single most hypnotic move in the whole catalog — the spiral arms visibly "breathe," reverse, and re-lock. Also animate c (zoom/scale) and dot size.

**Audio mapping:** bass RMS → c (breathing scale); onset/beat → nudge α by a few hundredths of a degree (each beat re-locks the arms); treble → dot brightness/size.

**Color:** index each dot by n through an IQ cosine palette (below); or hue = fract(n/φ) for a golden-ratio rainbow.

**Medium:** superb on LED matrices/rings (each seed = one pixel; low pixel count is fine) and screens. As dots it's cheap on CPU (a few thousand points).

```
// pseudocode, N points
for n in 0..N:
  a = n * 137.50776 * PI/180.0 + t*wobble
  r = c * sqrt(n)
  plot(center + r*(cos a, sin a), palette(n / N))
```

---

#### 1.2 Times-Table Cardioid / Modular Multiplication Circle — Woah 9 | Difficulty 2 | Cost 2
**Core math:** Place M points equally on a circle (point k at angle 2πk/M). For multiplier b, draw a chord from k to (b·k mod M). b=2 → **cardioid**; b=3 → **nephroid**; b=4 → epicycloid with 3 cusps; large M with fractional b → shimmering caustic envelopes. Popularized by Mathologer's 2015 video "Times Tables, Mandelbrot and the Heart of Mathematics" (Burkard Polster), who credits the discovery: "The discovery of the stunning patterns that I discuss in this video is due to the mathematician Simon Plouffe."

**Animate:** Continuously sweep the multiplier b (e.g. 2.00 → 100.00 slowly). The envelope morphs through cardioid→nephroid→multi-lobed caustics endlessly. Also animate M.

**Audio mapping:** map b to a smoothed bass envelope for pulsing morphs, or step b on each beat for snappy transitions; map line alpha to RMS.

**Color:** color each chord by its length or by k, cycled through a cosine palette; complementary-strobe the chord color on the beat.

**Medium:** screen/projector (line-dense); also gorgeous single-color on a laser (it's pure vector lines). "20 lines, instant crowd-pleaser" tier.

---

#### 1.3 Maurer Rose — Woah 8 | Difficulty 3 | Cost 2
**Core math (Maurer 1987):** Take the rose r = sin(nθ). Walk 361 points at θ = k·d degrees (k=0…360), connecting them with straight segments. The "walk step" d turns a smooth rose into a web of straight-line chords that create interference-like lattices.
Point k: (r cosθ, r sinθ) with r = sin(n·k·d°), θ = k·d°.

**Animate:** Rotate the degree step d (e.g. animate d from 1→179). Each integer d is a distinct mandala; sweeping d is a continuous morph. Also animate petal count n.

**Audio mapping:** onset → increment d (discrete mandala changes on the beat); bass → n; RMS → global rotation.

**Color:** stroke color cycled by segment index; add glow (1/dist) for a neon look.

**Medium:** laser (vector-native, classic), screen. On lasers keep segment count within galvo budget (see §3.4).

---

#### 1.4 Rose Curves / Rhodonea — Woah 7 | Difficulty 2 | Cost 1
r = a·cos(kθ): k odd → k petals; k even → 2k petals; rational k=p/q → more complex closure. The simplest "always looks good" polar curve. Animate k continuously (non-integer k gives slowly-rotating multi-petal blooms). Great on lasers and LED rings.

---

#### 1.5 Lissajous Figures — Woah 8 | Difficulty 1 | Cost 1
**Core math:** x = A sin(a·t + δ), y = B sin(b·t). The frequency ratio a:b sets the knot topology; the phase δ makes it rotate/breathe in 3D-looking ways.

**Animate:** Slowly drift δ (the whole figure appears to rotate through a 3D volume); nudge the ratio a:b for topological "rethreading."

**Audio mapping:** δ ← phase accumulator scaled by RMS; a,b step on beats; brightness ← kick.

**Color:** hue ← t (draws a rainbow along the curve).

**Medium:** **THE** canonical laser figure (single vector beam), oscilloscope XY, and DMX moving-head beam arrays (see §3.2/§3.3). Also trivial on screen.

---

#### 1.6 Spirograph — Hypotrochoids / Epitrochoids — Woah 8 | Difficulty 3 | Cost 2
**Epitrochoid:** x = (R+r)cosθ − d·cos((R+r)/r·θ), y = (R+r)sinθ − d·sin((R+r)/r·θ).
**Hypotrochoid** (Spirograph toy): swap signs / use (R−r). Ratios R/r that are rational close into rosettes; near-irrational ratios fill the disk with dense lace.

**Animate:** slowly vary d (pen offset) and the R/r ratio. Guilloché/"security-printing" look.

**Audio:** d ← bass; ratio steps on beat; per-orbit hue rotation.

**Medium:** laser (vector), screen, harmonograph-style plotting.

---

#### 1.7 Harmonograph — Woah 8 | Difficulty 3 | Cost 1
Sum of decaying sinusoids per axis:
x(t) = Σ Aᵢ sin(fᵢ t + pᵢ)·e^(−dᵢ t), similarly y(t). Models a damped multi-pendulum drawing. Produces organic, asymmetric Lissajous-like figures that decay inward. Animate frequencies slightly detuned; loop by resetting damping. Laser/screen. Beautiful with slow envelope.

---

#### 1.8 Mandelbrot / Julia Zoom — Woah 10 | Difficulty 5 | Cost 8
**Core math:** iterate z_{n+1} = z_n² + c. Mandelbrot: z₀=0, c=pixel. Julia: c=fixed, z₀=pixel. Escape when |z|>2; color by smooth iteration count μ = n − log₂(log|z|).

**Animate — the killer move:** For the Julia set, **orbit c around the boundary of the Mandelbrot set** (or near "atom" attachment points between bulbs). A useful path is the main cardioid c = 0.5·e^{iφ} − 0.25·e^{2iφ} with φ sweeping; small orbit radius (0.005–0.02) gives smooth continuous morphs, large radius jumps between Julia "families." For Mandelbrot, animate a logarithmic zoom into a boundary point plus a rotating palette offset.

**Audio mapping:** bass → zoom speed; onset → jump c to a new boundary point; spectral centroid → palette phase (d in the cosine palette); RMS → iteration count (detail bloom).

**Color:** IQ cosine palette fed by μ; rotate palette offset over time for the classic "flowing contours" psychedelia.

**Medium:** projector/LED wall/screen only (needs resolution & GPU). Fragment-shader "hello world"; GPU cost scales with max iterations.

---

#### 1.9 Newton Fractal — Woah 8 | Difficulty 5 | Cost 7
Iterate Newton's method z − f(z)/f'(z) for e.g. f(z)=z³−1; color by which root each pixel converges to + iteration count. Animate the polynomial's roots orbiting → the basins swirl and merge. Screen/projector. Similar cost profile to Julia.

---

#### 1.10 Reaction–Diffusion (Gray–Scott) — Woah 9 | Difficulty 6 | Cost 7
**Core math:** two chemicals A,B on a grid:
A' = A + (Dₐ∇²A − AB² + F(1−A))·Δt
B' = B + (D_b∇²B + AB² − (F+K)B)·Δt
Ping-pong two textures; ∇² via a 3×3 Laplacian kernel. Parameters F (feed), K (kill) select regime: F≈0.0545,K≈0.062 → mitosis/cell-division; other values → coral, fingerprints, spots, "soap-bubbles" (F≈0.090,K≈0.059).

**Animate:** slowly drift F,K (ideally as a function of screen x, so multiple regimes coexist); inject "seed" splats on beats. Runs entirely in a fragment/compute shader at 1080p on a moderate GPU.

**Audio:** beat → inject B splats (patterns bloom on the kick); bass → diffusion rate; treble → F/K drift.

**Color:** map B through a cosine palette; add bump-mapping/specular from the gradient for a wet organic look.

**Medium:** projector/LED wall (needs a 2D framebuffer with feedback). GPU state-machine — the archetypal "living texture."

---

#### 1.11 Truchet Tiles — Woah 7 | Difficulty 3 | Cost 3
Fill a grid; in each cell randomly place one of two rotations of a tile (e.g. two quarter-circle arcs). Adjacent arcs connect into flowing maze/labyrinth networks. In a shader: `id = floor(uv*scale); rnd = hash(id); draw arc rotated by rnd>0.5`. **Animate:** re-randomize with a time-seeded hash (tiles flip), or rotate each tile continuously; combine with kaleidoscope fold for "geometric tunnels." Audio: beat → reseed. Great on LED matrices (grid-native) and screens.

---

#### 1.12 Penrose / Aperiodic Tilings (incl. hat/spectre monotile) — Woah 8 | Difficulty 8 | Cost 4
Non-repeating tilings (Penrose P3 rhombs via de Bruijn's pentagrid, or the 2023 "hat"/"spectre" aperiodic monotile). High "sacred geometry" appeal but hard to generate live; usually precompute geometry, then animate color/inflation ("deflation" zoom looks like an infinite non-repeating fractal). Screen/projector, or laser as line art. Difficulty is in the tiling algorithm, not the rendering.

---

#### 1.13 Conway's Game of Life — Woah 6 | Difficulty 3 | Cost 3
B3/S23 rule on a toroidal grid, ping-pong textures (like reaction-diffusion but binary). Not "trippy" alone but mesmerizing on an LED matrix; reseed on beats, color cells by age through a palette. **Medium: made for LED matrices** (a 16×16 or 32×32 WS2812B panel runs it perfectly — the WLED/GlowBit demos literally show Life). Cheap.

---

#### 1.14 Strange Attractors (Lorenz, De Jong, Clifford, Aizawa) — Woah 9 | Difficulty 5 | Cost 5
**Lorenz:** ẋ=σ(y−x), ẏ=x(ρ−z)−y, ż=xy−βz (σ=10, ρ=28, β=8/3) — the butterfly.
**De Jong:** xₙ₊₁=sin(a·yₙ)−cos(b·xₙ), yₙ₊₁=sin(c·xₙ)−cos(d·yₙ).
**Clifford:** xₙ₊₁=sin(a·yₙ)+c·cos(a·xₙ), yₙ₊₁=sin(b·xₙ)+d·cos(b·yₙ).
Iterate hundreds of thousands of points, accumulate into a density buffer, color by visit count.

**Animate:** slowly vary the parameters (a,b,c,d) — De Jong/Clifford metamorphose continuously through wildly different forms. For Lorenz, animate a particle swarm flowing along the trajectory.

**Audio:** parameters ← smoothed FFT bands; particle count/brightness ← RMS.

**Medium:** screen (density plot), or 3D Lorenz as instanced particles in TouchDesigner. De Jong/Clifford also render beautifully on lasers if you draw the trajectory as a path.

---

#### 1.15 Spirals (Logarithmic/Golden, Archimedean, Fermat, Doyle) — Woah 8 | Difficulty 3 | Cost 3
**Logarithmic:** r = a·e^(bθ) (self-similar; the "golden spiral" is the special case b=ln(φ)/(π/2)). **Archimedean:** r=a+bθ. **Fermat:** r=±√θ (Vogel is Fermat-based). **Doyle spiral:** a circle-packing of tangent circles forming interlocking logarithmic-spiral arms — extremely "sacred geometry."

**Animate:** rotate θ-offset (spiral appears to rotate/tunnel inward); animate b (tightness). A rotating log-spiral with feedback = instant hypnosis / vortex.

**Audio:** rotation speed ← RMS; b (tightness) ← bass; arm count ← beat.

**Medium:** LED rings (spirals are the natural fit — map arm to ring index), laser (vector), screen. Combine with a tunnel shader (§6) for depth.

---

#### 1.16 Prime spirals (Ulam, Sacks) — Woah 6 | Difficulty 3 | Cost 2
Ulam: lay integers on a square spiral, mark primes. Sacks: on an Archimedean spiral (n at angle 2π√n, radius √n) — reveals prime-rich polynomial curves. More "intellectual woah" than rave-woah; nice slow-evolving backdrop or LED-matrix texture. Animate by marching the integer count.

---

#### 1.17 Cellular Automata (Rule 30/90/110) — Woah 5 | Difficulty 2 | Cost 1
1D elementary CA drawn row-by-row: Rule 90 → Sierpiński triangle; Rule 30 → chaos; Rule 110 → Turing-complete complexity. Cheap, great as a scrolling texture on a 1D LED strip (each frame = one strip state, scroll upward on a matrix). Low trippiness solo, high as a texture layer.

---

#### 1.18 Moiré / Interference — Woah 8 | Difficulty 2 | Cost 2
Overlay two periodic patterns (line gratings, concentric circles, dot grids) with a slight scale/angle/phase difference; the beat pattern is the moiré. `sin(x*f1) * sin(x*f2)` or two rotated `sin(r*k)` fields. **Animate the relative angle/phase** → giant slow-moving interference bands sweep the field. Extremely effective and cheap. Audio: relative phase ← beat accumulator; frequency ← bass. Screen, projection, and stunning on dual physical LED layers.

---

### PART 2 — PLATFORM / TOOLCHAIN PLAYBOOKS

#### 2.1 GLSL fragment shaders (Shadertoy / ISF / glslViewer) — the canonical route
The core toolkit of tricks:
- **Polar coordinates:** `vec2 p = uv-0.5; float a=atan(p.y,p.x), r=length(p);` — everything radial (spirals, roses, kaleidoscopes, tunnels) lives here.
- **Kaleidoscope fold** (the workhorse of "trippy"): reduce the full circle to one wedge and mirror it:
  ```
  a = mod(a, TAU/segments);
  a = abs(a - (TAU/segments)*0.5);   // mirror → stained-glass symmetry
  ```
  Whatever you draw in the wedge is repeated around all segments; animate `segments` and pattern-in-wedge for endless mandalas.
- **Domain repetition:** `uv = fract(uv*n) - 0.5;` tiles space infinitely (Truchet, grids).
- **Tunnel:** map screen to (angle, 1/r) then scroll the 1/r axis → infinite tube.
- **fbm/noise + domain warping:** feed noise into itself (`noise(p + noise(p))`) for fluid smoke/plasma.
- **IQ cosine palette** (memorize this — it's the universal color engine):
  ```
  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
    return a + b*cos(6.28318*(c*t+d));
  }
  ```
  Rainbow preset: a=b=0.5, c=1, d=(0.0,0.33,0.67). Animate by adding time to `t` or `d`.
- **Raymarching** for 3D spirals/SDF scenes: sphere-trace signed distance fields; more expensive but enables 3D tunnels and volumetric mandalas.

**ISF (Interactive Shader Format)** is the key open standard: a GLSL fragment shader + a JSON header declaring inputs (sliders, colors, points). It was created by VIDVOX in 2013, is free/open, and runs across Resolume, VDMX, Magic Music Visuals, TouchDesigner and more — write once, run everywhere. Tools: the free ISF editor at editor.isf.video, and an "Import from Shadertoy/GLSL Sandbox" feature that auto-converts most Shadertoy shaders. **This is the recommended packaging format** for your math shaders because it's the lingua franca of VJ software. `glslViewer` (open source, Linux CLI) is great for local dev and even runs on Raspberry Pi.

#### 2.2 TouchDesigner (free non-commercial)
Node-based, GPU-accelerated. The free license is fully functional but caps output resolution to **1280×1280** and has a few pro-only features — fine for many gigs, not for high-res festival walls. Strengths: **GLSL TOPs** (drop your shaders in directly), **Audio Analysis via the Audio Spectrum CHOP** (FFT with logarithmic scaling; recommend FFT size 1024–2048 for ~50ms latency), **instancing** (draw a million phyllotaxis dots / attractor particles), and **feedback TOPs** (video feedback = fractal zoom). Community gold: Bileam Tschepe (elekktronaut) beat-detection and audio-reactive tutorials. Best used as the show "brain": analyze audio, drive shader uniforms, composite, and output to screen/NDI/Spout/Art-Net.

#### 2.3 Processing / p5.js
Easiest on-ramp; ideal for **prototyping LED-matrix patterns** (draw to a small canvas, sample pixels, push to Art-Net) and for the point-based patterns (phyllotaxis, times-table, Maurer, attractors) which are more natural in immediate-mode drawing than in fragment shaders. p5.js runs in-browser and pairs with the Web Audio API for FFT.

#### 2.4 Python routes
- **Prototyping:** numpy + matplotlib for static/anim math exploration (Maurer, attractors, spirals).
- **Real-time:** **moderngl** (OpenGL context, run your GLSL fragment shaders from Python) or pygame for CPU pattern rendering.
- **Output:** `stupidArtnet` (pip, MIT — simplest Art-Net DMX sender, has a threaded persistent-send mode at ≥30 Hz), `aioartnet` (async, pure-Python, builds a live model of Art-Net nodes), or **OLA** (Open Lighting Architecture — C++/Python, the serious open-source lighting stack; supports Art-Net, sACN/E1.31, ENTTEC USB DMX Pro, Open DMX USB and more on Linux/Mac). This fits your C#/Python/Linux stack perfectly: compute pattern in numpy → flatten to a DMX/pixel buffer → ship over Art-Net.

#### 2.5 Hydra (live-coding, browser, free/open)
Analog-synth-style chained functions: `osc().kaleid().modulate().out()`. Sources (osc, noise, voronoi, shape, gradient), geometry (rotate, scale, **kaleid**, repeat), color, blend, and **modulate** (warp one source by another). Built-in **FFT audio reactivity** via the `a` object: `a.fft[0]` (bass) … chained into any parameter, e.g. `osc(40).modulate(noise(3), ()=>a.fft[0]).kaleid(48).out()`. Uses Meyda for analysis; set `a.setBins(n)`, smoothing, and min/max. Perfect for improvised festival visuals; runs on any WebGL browser (Chrome/Chromium). Every parameter can be a function of `time`, so animating the golden angle or Maurer step is one arrow-function.

#### 2.6 VJ software integration
- **Resolume Arena/Avenue** (paid): natively supports ISF since v7.8; also its own "Wire" node patcher. Package your math shaders as ISF and they appear as sources/effects.
- **VDMX** (paid, macOS): the original ISF host.
- **MadMapper** (paid): ISF + projection mapping + can drive Art-Net/DMX pixels.
- **Magic Music Visuals** (paid, affordable): ISF + node graph, strong audio-reactive.
- **Open/free alternative:** run ISF/GLSL in TouchDesigner free, glslViewer, or GLMixer (open source, has kaleidoscope shaders built in), and composite there.

#### 2.7 Godot / Unity shader options
- **Godot 4** (open source, MIT): write fragment shaders in its GLSL-like shading language; `CanvasItem` shaders are essentially fragment shaders — a great free way to run math visuals with a full engine around them (good for interactive installations, OSC/MIDI input via GDScript). Recommended for you given the free/local-first preference.
- **Unity:** Shader Graph (node-based) or HLSL; heavier, proprietary, but VFX Graph is excellent for GPU particle attractors/phyllotaxis.

---

### PART 3 — HARDWARE OUTPUT PLAYBOOKS

#### 3.1 LED pixel mapping (WS2812B / APA102 matrices, strips, rings)
- **WLED** (open source, ESP32/ESP8266): drives WS2812B, APA102/SK9822, WS2815, SK6812 and many more. Has native **2D matrix support** with serpentine/panel mapping, an **AudioReactive** usermod (mic/line-in/network), 250 presets, and — crucially — accepts **E1.31 (sACN), Art-Net, and DDP** as a real-time pixel node (170 LEDs / 510 channels per universe; up to 9 universes). Custom pixel maps via `ledmap.json` let you address irregular geometry (rings, ∞-shapes, gaps as `-1`). **Workflow:** compute your math pattern on a PC (Python/TouchDesigner/xLights), stream frames over Art-Net/DDP to WLED-flashed ESP32s. For standalone gigs, WLED's onboard 2D effects + audio usermod run without a computer.
- **xLights** (open source): design/sequence pixel models, map 2D/3D geometry, output E1.31/Art-Net/DDP/DMX. Great for pre-composed shows and for mapping video/effects onto irregular pixel props.
- **FPP (Falcon Player)** (open source, Raspberry Pi/SBC): plays back FSEQ sequences from xLights and streams E1.31/DDP/DMX/Pixelnet; can drive WS281x directly off the Pi GPIO, or P10 RGB panels via an Octoscroller cape; supports HDMI "virtual matrix." The standard local-first, computer-free show player.
- **Protocols:** **Art-Net** and **sACN (E1.31)** carry DMX-over-UDP (512 ch/universe); **DDP** is more efficient for large pixel counts (supported by WLED 0.12+, FPP, ESPixelStick). Art-Net devices typically live on 2.x.x.x / 10.x.x.x subnets.
- **Which patterns:** low-res patterns win here — **phyllotaxis dots, Game of Life, cellular automata, plasma, Truchet, moiré**. Spirals map beautifully onto **LED rings** (arm index → ring position). A 16×16 or 32×32 matrix with a diffuser is a superb math-pattern canvas.

#### 3.2 DMX moving heads (pan/tilt curves)
Moving heads position a beam via **pan (~540°) and tilt (~220–270°, model-dependent)** channels, each usually **16-bit** (coarse MSB + fine LSB adjacent channels = 65,536 steps). Per Pro Lights & Staging News (PLSN, "Bits and Bobs: 8-Bit vs. 16-Bit DMX Control"): 16-bit control means "we can increase the number of values to control a parameter from 256 to 65536," turning a 4-minute pan sweep from "a step nearly every four seconds" (8-bit) into "68 steps per second." Mapping a normalized curve point (x,y ∈ [−1,1]) to DMX:
```
pan16  = round(32768 + x*32767)   # center = 32768
tilt16 = round(32768 + y*32767)
pan_coarse = pan16 >> 8;  pan_fine = pan16 & 0xFF   # MSB first
```
(ETC EOS confirms the linear map: for ±270°, DMX 0 → −270°, 32767 → 0°, 65535 → +270°.) Send with stupidArtnet/OLA.

**Curves on beam arrays:** trace **Lissajous** (x=sin(a·t+δ), y=sin(b·t)), circles, figure-eights, or spiral chases across a row of heads; stagger each fixture's phase (serial/asymmetric ordering) so the beams "wave." **Critical constraint:** heads are **mechanically slow** — a full move takes ~0.2–25.5 s on a Robe Spiider's pan/tilt-time channel, and fine channels are meaningless while the head is physically traveling. So throttle your curve update rate to the fixture's slew limit; don't stream 16-bit steps at 50 Hz expecting the head to follow. xLights' "DMX Moving Head Advance" model exposes exactly these params (Range of Motion°, Slew Limit °/s, Min/Max limits, reverse/upside-down).

#### 3.3 QLC+ EFX — the free tool that already does the math (moving heads)
**QLC+** (Q Light Controller Plus, free/open, by Massimo Callegari) has an **EFX function** that generates geometric pan/tilt paths natively. Confirmed supported patterns (from docs.qlcplus.org): **Circle, Eight, Line, Line2, Diamond, Square, SquareChoppy, Leaf, and Lissajous.** Parameters: Width, Height, X/Y Offset (center), Rotation (0–360°), Start Offset (0–360°), and for Lissajous: **X Frequency, Y Frequency (0–32), X Phase, Y Phase (0–360°)** — i.e. exactly x=sin(fx·t+φx), y=sin(fy·t+φy). Fixture ordering **Parallel / Serial / Asymmetric** gives synchronized vs. phase-staggered chases across an array; Relative mode layers the EFX on top of an XY-pad position. This is the fastest path to math-driven moving-head looks with zero code. (Common gotcha: if only Pan/Tilt Fine moves, set Pan/Tilt to "coarse MSB" in the fixture editor.)

#### 3.4 Laser shows (ILDA, galvos, parametric curves)
- **Why parametric curves rule lasers:** a laser draws with a **single beam steered by two galvanometer mirrors (X, Y)** plus a blanking (on/off) channel — a pure vector plotter. Any (x(t), y(t)) — Lissajous, rose, spirograph, harmonograph, spiral, Maurer — draws perfectly without rasterization. Dense area-fill fractals do **not** suit lasers.
- **ILDA:** the International Laser Display Association standard; **.ILD files** hold frames of X/Y point coordinates + color/blanking. Galvos are rated in **kpps** (kilo-points/sec). Point rate trades against optical scan angle: per Pangolin Laser Systems, "For 30K-tuned scanners, this angle is about 8 degrees optical or less" (at 8° the pattern width is roughly one-seventh of the scanner-to-screen distance), and their True 50K scanners meet the ILDA test pattern at a narrower ~7°. More points/curve = fewer frames/sec, so keep your curve's point count within (kpps / target_fps).
- **Software:** Pangolin **QuickShow/BEYOND** (paid, industry standard, with FB4 DAC) and Laserworld **Showeditor** (free tier, exports ILDA); open/DIY: **LaserBoy** (ILDA editor), **LaserOS**, and DIY DAC routes (Ether Dream, or Raspberry Pi + MCP4822 SPI DAC driving galvo X/Y + GPIO blanking — a documented C++ project). You can also drive galvos directly from a sound-card DAC (16-bit, up to ~48 kpps).
- **Generating curves in code:** compute (x,y) point arrays for your parametric curve, scale to the DAC's ±full-scale, set blanking on, stream at the galvo's point rate. TouchDesigner has an Ether Dream workflow that makes Lissajous/abstracts easy.
- **SAFETY (see §7):** lasers used in shows are Class 3B/4; **audience scanning is prohibited in the US without an FDA variance and a specially-certified projector** — keep beams above/away from people (≥3.0 m vertical / 2.5 m lateral separation from audience per typical variance conditions).

#### 3.5 Projection mapping
Put shader output on real surfaces via MadMapper (paid) or open tools (e.g. Splash, or TouchDesigner's built-in mapping / CamSchnappr). Warp/mask per-surface; feed any of the Part-1 patterns as the source. Good for turning architecture into a fractal/kaleidoscope canvas.

---

### PART 4 — AUDIO-REACTIVITY DEEP DIVE

- **FFT & band splitting:** take an FFT of the incoming audio (44.1 kHz, window 1024–2048 samples ≈ 23–46 ms). Integrate magnitude over bands: **bass** ~20–250 Hz (kick/bass), **mid** ~250–2 kHz (vocals/snare body), **treble** ~2–16 kHz (hats/cymbals/air). Use **logarithmic** frequency scaling so octaves get equal weight (TouchDesigner's Audio Spectrum CHOP has a log mode; Hydra bins similarly).
- **Beat/onset detection:** for kick/snare, detect onsets via spectral-flux or energy-threshold with a rolling average. **Libraries:** **aubio** (C with Python bindings — real-time onset/tempo, ideal on Linux), **librosa** (Python, offline analysis / pre-analysis of tracks), **Web Audio API AnalyserNode** (browser/Hydra/p5), and TouchDesigner's Audio Analysis / beat components (elekktronaut's kick+snare CHOP recipe).
- **Smoothing = the difference between pro and amateur:** raw FFT is jittery. Apply an **attack/release envelope** (fast attack ~5–20 ms so hits pop, slow release ~100–400 ms so it decays smoothly): `env = max(input, env*release)` per frame, or a one-pole `env += (input-env)*k`. Hydra exposes `.smooth()`; TouchDesigner uses Lag/Filter CHOPs.
- **Mapping strategy (the canonical rig):**
  - **Bass energy → scale / zoom / spiral tightness** (the visual "breathes" with the low end).
  - **Beat / onset → discrete jumps:** increment Maurer step d, jump Julia c, reseed Game of Life / reaction-diffusion, flip kaleidoscope segment count, trigger a palette swap. Discrete changes on the beat read as "the visuals are dancing."
  - **Spectral content → color:** spectral centroid (brightness of sound) → palette phase / hue; treble → sparkle/particle brightness.
  - **RMS/overall level → global intensity / rotation speed.**
- Keep a **failover scene** and normalize input gain so quiet intros and loud drops both behave.

---

### PART 5 — MASTER RANKING TABLES

**Table A — Ranked by "Woah Dude" psychedelic impact (the hippy-trap rating).**

| Rank | Pattern | Woah | Difficulty | Cost | Best medium | Audio potential |
|---|---|---|---|---|---|---|
| 1 | Mandelbrot/Julia c-orbit zoom | 10 | 5 | 8 | Projector/wall | High |
| 2 | Reaction–diffusion (Gray–Scott) | 9 | 6 | 7 | Projector/wall | High |
| 3 | Phyllotaxis (Vogel) angle-morph | 9 | 2 | 2 | LED matrix/ring, screen | High |
| 4 | Times-table cardioid sweep | 9 | 2 | 2 | Screen, laser | High |
| 5 | Kaleidoscope-fold feedback | 9 | 3 | 3 | Any (screen/projector) | Very high |
| 6 | Strange attractors (De Jong/Clifford) | 9 | 5 | 5 | Screen, laser | High |
| 7 | Log/golden spiral + tunnel | 8 | 3 | 3 | LED ring, screen, laser | High |
| 8 | Lissajous | 8 | 1 | 1 | Laser, moving heads, scope | High |
| 9 | Spirograph / guilloché | 8 | 3 | 2 | Laser, screen | Med |
| 10 | Maurer rose | 8 | 3 | 2 | Laser, screen | High |
| 11 | Moiré / interference | 8 | 2 | 2 | Screen, dual LED layers | High |
| 12 | Harmonograph | 8 | 3 | 1 | Laser, screen | Med |
| 13 | Newton fractal | 8 | 5 | 7 | Screen | Med |
| 14 | Penrose / hat monotile | 8 | 8 | 4 | Screen, laser | Low |
| 15 | Rose / rhodonea curves | 7 | 2 | 1 | Laser, LED ring | Med |
| 16 | Truchet tiles | 7 | 3 | 3 | LED matrix, screen | Med |
| 17 | Plasma (demoscene) | 7 | 2 | 2 | Any | Med |
| 18 | Doyle spiral / Apollonian | 8 | 6 | 4 | Screen, laser | Low |
| 19 | Game of Life | 6 | 3 | 3 | LED matrix | Med |
| 20 | Prime spirals (Ulam/Sacks) | 6 | 3 | 2 | Screen, LED matrix | Low |
| 21 | Elementary CA (Rule 30/90/110) | 5 | 2 | 1 | LED strip/matrix | Low |

**Table B — Best effort-to-payoff ("20 lines, instant crowd-pleaser").** In order: (1) Times-table cardioid, (2) Phyllotaxis angle-morph, (3) Kaleidoscope-fold on any source, (4) Lissajous, (5) Moiré, (6) Plasma, (7) Rose curves, (8) Log-spiral tunnel. All are ≤ ~60 lines and score Woah ≥7 at Cost ≤3.

**Table C — Best pattern per output medium.**

| Medium | Top picks | Why |
|---|---|---|
| Projector / LED wall (high-res GPU) | Mandelbrot/Julia, reaction-diffusion, kaleidoscope, plasma, Newton | Need pixels + GPU; area-fill detail |
| LED matrix / ring (low-res) | Phyllotaxis dots, Game of Life, plasma, Truchet, spirals-on-rings, CA | Grid/point-native, low pixel count fine |
| Laser (galvo vector) | Lissajous, rose, spirograph, harmonograph, Maurer, spirals | Single-beam parametric curves = native |
| DMX moving heads | Lissajous, circle, figure-eight, spiral chase (via QLC+ EFX) | Pan/tilt = 2D parametric path; slow |

---

### PART 6 — CLASSIC PSYCHEDELIC / DEMOSCENE AMPLIFIERS

These turn a plain math pattern into a lightshow. Stack them.
- **Feedback loops (video feedback = fractal zoom):** route the output back as an input, scaled/rotated slightly each frame → infinite tunnels, trails, and self-similar fractal zoom. TouchDesigner Feedback TOP; Hydra `src(o0).scale(1.01).rotate(0.01)`; in GLSL, sample last frame's texture.
- **Kaleidoscope mirroring (polar domain folding):** §2.1 fold — the #1 "make it trippy" operator. Animate segment count on the beat.
- **Tunnel effect:** polar remap with 1/r depth + scrolling texture → fly through infinite tube. Combine with a spiral for a vortex.
- **Plasma:** sum of sines `sin(x)+sin(y)+sin((x+y))+sin(√(x²+y²))` mapped through a cosine palette; the OG demoscene warm-up (originated on the Amiga/VGA era, Bret Mulvey 1988).
- **Moiré / phase-shifted layering:** overlay two copies of a pattern at slightly different scale/rotation.
- **Slit-scan:** build the image one column/row at a time from a moving source → time-smearing warps.
- **Chromatic aberration:** sample R, G, B at slightly offset UVs (offset ← bass) → psychedelic color fringing that pulses with the music.
- **Bloom / glow:** threshold bright areas, blur, add back → neon "light bleeding," essential for the laser/neon aesthetic. `glow = intensity/(dist+eps)` for line art.
- **Color-cycling:** rotate the palette offset over time (the Amiga-era trick that makes static patterns flow).

A canonical "instant festival visual" recipe: **noise/plasma source → kaleidoscope fold → feedback zoom → cosine-palette color-cycle → bloom**, with bass on zoom and beat on segment count.

---

### PART 7 — SAFETY NOTES

- **Photosensitive epilepsy (PSE):** affects a minority of people; seizures are most readily triggered by flashes in roughly the **3–30 Hz range** (peak risk ~15–20 Hz), especially over a large field of view and with saturated red. (W3C notes WCAG 1.0 originally barred any flashing "within a broad frequency range (3 to 50 Hz)"; WCAG 2.2 now defines a "general flash" as "a pair of opposing changes in relative luminance of 10% or more of the maximum relative luminance where the relative luminance of the darker image is below 0.80.") The universally adopted rule (Harding test; **W3C WCAG 2.2 SC 2.3.1/2.3.2**; Ofcom): **do not flash more than 3 times in any one second** on any large area, and avoid rapid full-field red flashes and high-contrast oscillating patterns (stripes/bars changing direction). The infamous 1997 Pokémon incident illustrates the risk: the episode "Dennō Senshi Porygon," broadcast once on TV Tokyo on December 16, 1997, contained a ~4-second scene that "rapidly flashes red and blue lights," and per Wikipedia "Over 600 people, mostly children, were taken to hospitals" (Japanese Fire Defense Agency figures cited elsewhere put it at 685 children). **Practical rules:** cap full-field strobe at ≤3 Hz; keep any faster flashing to small screen areas; avoid full-screen red flashes; ramp intensity rather than hard-cutting. Free checkers: PEAT (Trace Center, free for web/non-commercial) and the commercial Harding FPA.
- **Strobe best practice at events:** post signage ("strobe/laser effects in use"), give warnings before intense sections, keep house/emergency lighting independent, and prefer sub-3-Hz on big washes.
- **Laser safety:** show lasers are typically **Class 3B (5–499 mW) or Class 4 (≥500 mW)** — capable of eye damage from direct or specularly-reflected beams. In the US, Class 3B/4 demonstration laser products require an **FDA variance**; **audience scanning is prohibited unless the projector is specifically designed, reported, and certified for it** (an FDA variance was actually revoked over unauthorized audience scanning). Keep scanned beams above the audience (typical variance: **≥3.0 m vertical, ≥2.5 m lateral** separation from any surface people can stand on), never allow a static beam toward people, use beam stops at pan/tilt extremes, and for outdoor shows file the FAA notice (Form 7140-1). Always wear correct-wavelength eyewear while tuning galvos; the real danger is a static/undeflected beam. When in doubt, hire/consult a certified laser safety officer.

---

## Recommendations

**Stage 1 — Prove the pipeline this week (zero cost).** Install Hydra (browser) and glslViewer/TouchDesigner-free on your Linux box. Build three shaders: (a) times-table cardioid with a swept multiplier, (b) Vogel phyllotaxis with a wobbling golden angle, (c) a kaleidoscope-fold + feedback + cosine-palette "amplifier" you can put on top of anything. Wire Hydra's `a.fft` (or TD Audio Spectrum CHOP) so bass drives zoom and beats jump a parameter. These three alone cover 80% of "woah."

**Stage 2 — Package for reuse.** Convert your best shaders to **ISF** (JSON header + GLSL) via editor.isf.video so they run in any VJ host and you can expose sliders. Keep a Git repo of ISF sources — this is your portable "instrument library."

**Stage 3 — Light up hardware you already understand.** Since you have DMX/live-event experience: (a) drive a WS2812B matrix/ring with WLED, streaming Art-Net frames of phyllotaxis/Life/plasma from Python (stupidArtnet) or xLights; (b) in **QLC+**, build EFX Lissajous/circle/figure-eight looks across your moving heads and stagger phase for beam waves. Both are free and map onto your existing rig.

**Stage 4 — Add lasers last, carefully.** Prototype parametric curves (Lissajous, rose, spirograph) as ILDA frames in LaserBoy/Showeditor or a Pi+MCP4822 DAC. Respect galvo point-rate budgets and, above all, the audience-scanning prohibition — beams above heads only.

**Benchmarks that change the plan:**
- If TouchDesigner free's **1280×1280** cap or watermark blocks a high-res wall gig → move to a paid TD license or output via ISF in MadMapper/Resolume.
- If **Art-Net frame rate stutters** on big pixel counts → switch WLED/controllers to **DDP** and segment universes.
- If moving heads **can't follow** your curve → lower the curve update rate to the fixture's slew limit (or accept 8-bit for fast moves, 16-bit only for slow reveals).
- If a venue/broadcast requires PSE compliance → run output through PEAT and cap flashing at 3 Hz before doors.

---

## Caveats
- **Ratings are subjective.** "Woah dude," difficulty, and cost are my calibrated estimates for a festival/rave context and your skill level, not measured benchmarks — treat them as a starting sort, not gospel. GPU cost especially depends on resolution and iteration counts.
- **Tilt range and DMX layouts vary by fixture** (220°/270°/360°); always pull the specific fixture's DMX chart before mapping pan/tilt.
- **TouchDesigner licensing** and Resolume/MadMapper/Pangolin costs can change; verify current free-tier limits before relying on them.
- **Laser and PSE regulations vary by country** and this is not legal/medical advice — the US FDA/FAA specifics above may differ in the EU/UK/AU; consult local regs and a laser safety officer for any public show.
- Some cited implementation details come from community blogs/forums rather than primary specs; the math (equations, golden angle, iteration formulas) is well-established, but always test a given library/tool version yourself.