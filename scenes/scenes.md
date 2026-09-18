# Scene Forge baseline

Every live scene made tonight starts from the **actual Party performance baseline**, unless a scene note explicitly says otherwise. “Ebb and flow” means the motion already felt in `web/party.html`: its shared chaos ↔ symmetry swing, zoom pendulum, palette movement, trails, bloom, tempo, live dashboard, keyboard/mic input and optional organism mixer. It does **not** mean that every scene must contain the Synaptic organism. The dashboard's selected organism mix remains available and is only present when its controls ask for it.

`web/meowparty.html` is the scene-performance surface. It deliberately reuses `web/party-main.js` unchanged, so scenes inherit Party's real runtime instead of imitating it. A scene supplies only the visual director it needs. `web/dashboard.html` remains the main live controller. Separate refinement/query pages can come later; standalone artifacts keep the subtle development controls used to discover parameter combinations.

**Scene 1**

icosahedron with harmonograph inside.

They both start out very petite.
Everytime the inside spiral (in this case the harmonograph) touches one of the lines of the icosahedron.
It creates an electric impulse (visualised by a color) that ripples over the extension of the of the line's conjunction.
As the harmongraph starts growing inside the icosahedron it starts pulsing like heartbeat.
after a few instances where the harmonograph touches the icosahedron, the icosahedron bursts open which makes the harmonograph change shape into a butterly (ask for picture validation as this is something we have aqcuired from the experiments page.)

**Entity truth:** the Butterfly is the beating heart of the scene from its first frame. It does not arrive from elsewhere or replace the Harmonograph. The Harmonograph is the Butterfly's disguise; the morph control reveals how much of the underlying entity is visible. Heartbeat therefore remains active in both forms.

**First playable study:** `web/scenes/scene-01-icosahedron-butterfly.html`

**Live MeowParty version:** `web/meowparty.html`

The first pass deliberately stops before contact impulses and the burst. It establishes the small rotating icosahedron, the harmonograph living inside it, and an equation-level Harmonograph → Butterfly morph based on the Spiral Mash reference images. The lab exposes morph, both scales, chaos, symmetry, heartbeat, spin, trails, echoes, wing loops, palette and optional automatic transformation. Presets provide petite, touching and butterfly states. It is linked from `web/index.html`.

The earlier standalone study's oversized **SYNAPTIC VOID** control was a too-literal interpretation of the Party baseline. Treat it as a lab branch, not the authoritative live scene. In MeowParty the native Party zoom and swing drive the scene, while Synaptic, slime, fluid, Vicsek, wiring and ferrofluid remain optional dashboard-controlled layers exactly as they are in Party.

The MeowParty pass keeps Party's canonical Harmonograph renderer inside the rotating icosahedron and overlays the Spiral Mash butterfly equation as the entity's hidden form. The shared Party swing folds the wings in and out; the first 18 seconds grow the initially petite cage and entity into the ongoing ebb/flow. Near the ordered/grown end, coloured impulses travel across cage edges. Party's native zoom mode, palette, trails, bloom, organism mix, remote dashboard, keyboard and mic behavior are preserved rather than reimplemented.

The colour layer now has a small ADSR envelope in the shared dashboard and in MeowParty's three-stripe drawer: attack, decay, sustain and release set brightness/bleed behaviour, with phase buttons for deliberate standstills. `colorBleed` adds scene-local frame clearing so old pixels do not wash the palette pale; it does not alter regular Party.

**Scene 2**
# Scene Forge Catalogue

Standalone experiments live beside this notebook. Tonight favours distinct visual findings over a shared scene framework.

## Scene 01 — Pendulum Well

**Status:** promising experiment

**Files**

* `scenes/scene-01-pendulum-well.html`

**Visual idea**

A four-pendulum harmonograph hangs inside a Doyle circle-packing field. Reprojecting the previous frame slightly inward turns the outer orbit into a gravity well: circles fall toward the damped knot, then the scene can unwind to its original open field.

**Source systems**

* `web/viz/symmetry.js` — Harmonograph, Doyle spiral and superfluid bloom
* `web/palettes.js` — existing palette atlas
* Scene-local, single-buffer inward feedback

**Primary controls**

* `chaos` detunes both source systems, increases counter-rotation and destabilizes their phase relationship.
* `symmetry` locks the harmonograph ratios and regularizes the circle packing.
* `collapse` contracts the outer Doyle field, tightens feedback toward the centre and feeds the central bloom.
* `fusion` transfers visual authority from the orbital circles to the harmonograph rather than acting as only an opacity crossfade.
* `feedback`, `trail fade`, `intensity` and `speed` remain available as useful low-level controls.

**Important parameter ranges**

* Open/origin: collapse `0.05–0.22`, fusion `0.25–0.48`, feedback `0.68–0.80`.
* Deep well: collapse `0.78–0.96`, fusion `0.76–0.94`, feedback `0.86–0.94`.
* Feedback above about `0.94` is intentionally excluded; it muddies the pendulum line faster than it adds depth.

**Motion / state behaviour**

The optional cycle follows `ORIGIN → DEVELOPMENT → EXTREME → RETURN`. Symmetry and collapse rise toward the extreme while chaos peaks during the journey rather than at either endpoint. Touching any slider pauses the cycle for manual tuning.

**Emotional / narrative role**

Attraction becoming inevitability: a loose celestial field discovers a centre, falls inward, briefly reads as a single thinking mechanism, then releases.

**Transition possibilities**

* Enters naturally from a wide phyllotaxis, galaxy or particle field by matching the outer circles first.
* Can leave through the central harmonograph into a tighter line-based scene, or reverse the feedback to suggest an eruption.

**Interesting discoveries**

* Chaos and symmetry are not strict opposites here: moderate values of both create a strained, almost-locked pendulum that feels more alive than either endpoint.
* Contracting the Doyle geometry while feedback also scales inward creates perceived depth without a tunnel mesh or extra particle system.
* A low-opacity superfluid bloom makes collapse feel luminous instead of merely smaller.

**Problems / TODO**

* Tune on the intended projector; feedback persistence and line brightness will depend on black level.
* Explore a reversible outward-feedback variant as a related scene rather than adding another mode to this page.

## Forge notes

* `scenes/story.md` is intentionally unchanged: Scene 01 supports the broad transformation/return idea but does not yet force a new story beat.
* The existing neon-cat experiment is an image substrate plus organism possession path in `web/party-main.js` and `web/viz/symmetry.js`; it is a useful visual source, not a reusable control-panel component.
