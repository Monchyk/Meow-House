# The cage, the heartbeat, and the butterfly

A creative brief and an interview in progress. This records the intended experience, not a claim that it is already implemented. The latest description leads; proposed direction and unanswered questions are identified below.

## First implementation for review

The page we are reviewing together is `http://127.0.0.1:8800/scenes/scene-01-icosahedron-butterfly.html`, served from `web/scenes/scene-01-icosahedron-butterfly.html`. Its animation now lives in `web/scenes/treasure-chest.js`.

The first revised pass implements overlapping growth, a fixed final ico size, a continuous double heartbeat, contact against the projected outer silhouette, separating/fading edges, and a gradual butterfly morph. The first contact triggers release for this pass; multiple warning contacts remain a creative choice to discuss. The enclosure holds its geometry while its edge light follows the pulse. Automatic Synaptic overlay and independent zoom have been removed from this study. Zoom is manually adjustable.

The default ico finishes growing at scene second 19; contact occurs around 22.6; the butterfly is fully revealed around 34. Default playback speed is 0.65, stretching these moments in real time. Pause, restart, scrubbing, before-contact and butterfly cues allow us to review together. Controls expose growth duration, following delay, final ico size, heartbeat strength/tempo, rotation, zoom, opening duration, screen glow and palette. Colour progression and screen glow share the scene clock. Physical room lights are not connected in this standalone pass.

Code checks confirm contact follows the growth stop at the default and tested extreme settings, the morph completes, seeking backward restores the enclosure, and pause freezes scene time. The local server serves the revised files. Visual approval still belongs to the shared viewing session; browser inspection was unavailable in Firefox.

## What you said

> The cube should start out smaller around the harmonograph, and get bigger earlier then stop at a certain size, then the harmonograph follows the same pattern by getting bigger while beating like a beating heart, once the harmonograph and the cube touch, the cube breaks/bursts open and the harmonograph changes into the butterfly.

Everything needs to align beautifully: tempo, colour, zoom, transitions, colour fades, and lights. The scene needs to be slowed down and manipulatable.

### Confirmed in the follow-up

- The enclosure is the **icosahedron** already used in the scene. “Cube” in the original quote was shorthand.
- The harmonograph starts growing **slightly behind the icosahedron, while the icosahedron is still growing**. Their growth overlaps.
- The guiding image is **“a pulsating, beating treasure chest.”** This describes the feeling of the scene; it does not request a literal chest model.
- Whether the first contact or several contacts trigger the opening remains unanswered.

## Saying it back

We begin with a small icosahedron enclosing a small, living harmonograph. There is room between them. The icosahedron leads the movement: it begins growing early, expands smoothly, and settles at a deliberate final size. Its stop matters. It establishes the boundary that the inner life will eventually reach.

The harmonograph follows slightly behind, beginning its growth while the icosahedron is still expanding. Their growth overlaps. It grows while beating like a heart. There are two motions to perceive together: its gradual increase in size, and its smaller recurring expansions and relaxations. Each relaxation can make it slightly smaller for a moment even while its overall size increases.

“A pulsating, beating treasure chest” gives this movement its emotional character: an enclosure holding something alive and precious, with that life building toward revelation. This is our interpretation of the metaphor. Whether the enclosure itself visibly swells with each heartbeat, or conveys the pulse through light and the movement inside it, still needs to be established.

Once the icosahedron has settled, the distance between the harmonograph and its boundary becomes the focus. The audience has time to see that gap close. Contact is the turning point: the living form reaches its enclosure, the enclosure gives way, and the harmonograph transforms into the butterfly. Those events must feel causally connected, as if the growth and heartbeat made the release inevitable. Whether it yields at the first touch or after repeated touches remains open.

The butterfly is the same entity revealed. The existing scene notes explicitly describe the harmonograph as its disguise and the heartbeat as continuous across both forms. Position, motion, colour, and pulse should carry that identity through the transformation.

Slowing down means giving each change enough time to be felt: the initial smallness, the icosahedron's growth and settling, the heart's approach, the contact, the opening, and the butterfly's emergence. Growth overlap is confirmed; the exact delay, durations, and quality of the release still need your answers.

## Proposed choreography

These are creative recommendations to discuss, not decisions attributed to you.

| Phrase | Shape and movement | Relationship to the other elements |
| --- | --- | --- |
| Establish | Small enclosure, smaller living form, visible space between them. | Give the eye time to understand the composition. Keep the heartbeat readable. |
| Make room | Icosahedron grows first and eases into its final size. | Keep the camera calm enough that this reads as the enclosure physically growing. |
| Build life | Harmonograph begins growing slightly behind, while the icosahedron is still growing, with an ongoing heartbeat. | These growth phrases overlap; the enclosure then holds its final size while the inner form continues catching up. Colour and light can gradually build anticipation. |
| Reach the boundary | The remaining gap closes visibly. | A heartbeat crest is a proposed contact moment; the actual visible geometry must agree with the cue. |
| Release | Contact begins the burst/opening and the butterfly reveal. | Coordinate the release, colour change, and lighting accent around this shared event. Their durations can differ. |
| Let it live | Butterfly completes its emergence and keeps beating. | Give it time to exist after the reveal; let debris, trails, and light settle at chosen rates. |

The growth phrases overlap, with the harmonograph slightly behind. The order is clear: icosahedron leads, harmonograph joins its growth, icosahedron reaches a limit, inner growth reaches that boundary, contact leads to release. The precise delay and whether release needs one or several contacts remain open.

## How the elements should agree

**Tempo.** Use one controllable scene timeline with distinct phrase lengths and an adjustable heartbeat relationship. We still need to establish whether music drives that timeline. A slow scene may contain several heartbeats within one growth phrase. Avoid treating every beat as a cue to advance the story.

**Scale and zoom.** Object growth and camera zoom need separate controls. A camera pulling back at the same rate as the icosahedron grows could conceal the very movement you want to see. Proposed starting direction: a steady opening view, a gentle optional move as tension develops, and enough room for the burst and wings. Camera movement must preserve the legibility of contact.

**Colour and fades.** Choose a connected palette journey for enclosure, inner entity, contact, and butterfly. The butterfly should inherit enough colour from the harmonograph to feel continuous. Set when each fade begins, how long it takes, and how it eases. Exact hues remain yours to specify; no palette is assumed here.

**Light.** Distinguish the rendered glow on screen from optional physical room lights. Both can follow the same emotional phrase while using different intensities and fade durations. Proposed direction: a restrained beginning, a gentle pulse associated with the heart, a deliberate release accent, and a slow settling into the butterfly's atmosphere. Whether that release is soft or brilliant remains open. If physical lights are used, account for their response delay when aligning them with visible contact.

**Transitions.** Preserve the entity's centre, pulse phase, and visual continuity through the morph. Start the release from contact; decide together whether the butterfly unfolds during the opening or becomes recognisable just after it. Let the audience see the transformation. Trails and bloom should support the silhouette and the moment of touch.

**Manipulation.** The intended controls should let us rehearse a moment, hold it, and tune it while looking at it. Desired controls: overall speed; play/pause; scene scrubbing; phrase durations and overlap; both starting scales; icosahedron's final scale; inner growth; heartbeat rate and strength; contact/release behaviour; burst duration and spread; morph progress; camera zoom; palette and fade timing; glow; and optional room-light intensity and fades. These are requirements for future implementation, not existing-control claims.

Slowing or pausing the whole scene should preserve alignment between its parts. Independent adjustments should remain available for creative tuning. Seeking back before contact should restore the enclosure and entity consistently, so the same release can be rehearsed repeatedly.

## The interview

We should work through these in conversation, beginning with the image and the turning point. Answers should update this brief. Where words fall short, a reference image or a demonstrated motion can settle the detail.

1. **Describe the first frame as if I cannot see it.** How much of the frame does the icosahedron occupy? How much space surrounds the harmonograph inside it? Are we looking straight on, from above, or at a tilted, rotating object?
2. **How does the treasure chest express its heartbeat?** The enclosure is confirmed as the icosahedron. Does it physically swell with the harmonograph's pulse, or does it hold its shape while light and the life inside make it feel as though it is beating? Are its edges luminous lines, are its faces visible, or is it something else?
3. **Show us the delay with your hands.** The harmonograph is confirmed to follow slightly behind while the icosahedron is still growing. How slight is that delay: part of a heartbeat, a whole beat, or longer? Does “the same pattern” mean the same easing and duration, with that delay?
4. **What does its heartbeat feel like?** A single swell and release, a double “lub-dub,” or another rhythm? Does it remain steady or gather urgency? How many pulses should we experience before contact?
5. **What exactly makes the enclosure give way?** Your latest wording suggests the first touch triggers it. Earlier notes describe several touches, with coloured electrical impulses along connected edges before the burst. Which sequence do you see now? Does the form press against the boundary before release?
6. **What kind of opening is it?** Brittle edges shattering, faces separating, a shell peeling back, or a pressure burst? Where do the pieces go, and how long should we see them? Does the release feel tender, powerful, startling, or relieving?
7. **Describe the instant the butterfly becomes recognisable.** Do wings unfold out of the existing curves as the enclosure opens, or is there a pause between the opening and the reveal? Which butterfly from the experiments is the reference? Earlier notes specifically request picture validation of that form.
8. **Give us the colour journey.** What colours are the background, enclosure, and harmonograph at the beginning? What changes as pressure builds? What is the butterfly's colour? Does contact send colour along edges, and should that colour become part of the wings?
9. **Where is the viewer during all this?** Do we stay still, drift inward, pull back, or orbit? What must remain fully visible at contact and after the wings open? Should the burst come toward us?
10. **What do you mean by lights in this scene?** Screen glow, room lights, or both? Should the room breathe on each heartbeat or follow the longer emotional arc? What should the release feel like in brightness and colour?
11. **What sets the time?** A particular track or BPM, a free-running heartbeat, or a person performing the controls? Roughly how long should the whole passage feel, and which moment deserves the longest hold? Is “earlier” relative to the current scene or to a specific musical cue?
12. **What happens after the emergence?** Does the butterfly hover and beat, fly away, fill the view, or lead into another scene? Is this a one-way transformation or a cycle? Which parts do you want to manipulate live, and which should run automatically once cued?

## How we will know we understood

Watch one slow pass together. We should be able to identify the icosahedron leading, the inner form beginning to grow slightly behind while both are still expanding, the enclosure's growth stopping, the inner form catching up while pulsing, visible contact, the resulting opening, and the same life becoming a butterfly. It should feel like a pulsating, beating treasure chest. Colour, camera, and lighting should make those relationships easier to feel. We should also be able to pause near contact, change the timing, and replay the release without losing that relationship.

The sequence is understood. The exact shared image is still being discovered; the unanswered choices above should stay visible until you resolve them.
