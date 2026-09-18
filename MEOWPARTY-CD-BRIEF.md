# MEOWPARTY — Creative-Director brief (north star + build-map)

_The vision, plus what's real vs new and what's safe to hand a builder. 2026-09-18._
**Rule (from K.'s own history, `projects/Deep-House/2026-09-03_watching-mejulie-arc.md:61-66`):**
don't fan the *creative/felt* loop out to agents — it flattened the watching-night magic.
So: builders get the **concrete plumbing**; the **story, sequence, palettes, and emergent combos
stay live with K. + the friend.**

## The north star (the run-of-show — direction, not a spec)
Dark room. A real toy train loops its plateau and **sets the tempo** — the heartbeat, not a
metaphor. The cat sits centre, calm, wobbling. Behind it a tunnel of frosted tiles lights one by
one, a snake ebbing in/out on the train's clock. Someone walks in and the room **leans toward
them** — steered live, not by presets (the way mejulie was born from an audience). Chaos rises,
tiles scatter off-kilter, the cat is pulled into the throat; at the turn, as the train passes the
front — **BANG** — the treasure chest breaks and the butterfly is the same creature, revealed,
still beating. The train keeps looping; the room becomes *a record of what people made.*

## Build-map — beat → status → who does it

| Beat | Status in code | Gig? | Delegate to a builder? |
|---|---|---|---|
| Tunnel of lit mosaic tiles + snake ebb | **EXISTS** — `neon-cat/spiral-tiles.html` | yes | ✅ port/wire as a scene |
| Butterfly from the treasure chest | **EXISTS** — "meowparty" director scene | yes | ✅ already a scene |
| Cat centre, calm wobble | exists (cat layer) | yes | ✅ small |
| Scene player cycling scenes | **in progress** — `player.html` (canon) | yes | ✅ but see punch-list |
| Palette picker (live recolor) | **spec'd** — `PALETTE-PICKER-SPEC.md` | yes | ✅ concrete, non-taste |
| Chaos↔symmetry arc / cat pulled to throat | exists in `spiral-cat.html`, not in tile engine | maybe | ✅ port (plumbing) |
| Room "leans toward a person" (spatial) | **NEW** — Deep-House FieldProjection dream | **post-gig** | later |
| Train sets tempo; BANG on train-pass | **NEW hardware** — `docs/TRAIN-CLOCK.md` | **post-gig** | later (software tap-hook is small) |
| Which scenes / the sequence / the story | — | yes | ❌ **KEEP LIVE (K.+friend)** |
| The palettes chosen; emergent combos (mejulie-style) | — | yes | ❌ **KEEP LIVE** |

## Safe builder delegation NOW (concrete plumbing only)
From the player quality review + specs — none of these need taste:
1. **`dispose()` on scene-swap** + strip self-rAF when porting studies (fps over a long night).
2. **Autoplay + per-scene duration** in the canon player (the "cycle 6–8" deliverable).
3. **Palette picker** per `PALETTE-PICKER-SPEC.md` (setActive hook + expose the 12 + auto→manual).
4. **Wire `spiral-tiles` in as a registered scene** (register() factory).
5. Optional: **seam-free transition** (snapshot-crossfade, one live loop — spec in the parked player).

## Do NOT delegate (keep for the live session with the friend)
Scene selection, ordering, the story/narrative, palette choices, and the emergent "watch-together"
discoveries. That is the felt work the history says degrades when fanned out. Curate it live.
