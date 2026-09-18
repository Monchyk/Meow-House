# WOW-MOMENT QUERY KIT — mine your own history

_Search vocabulary to pull the cool moments / wow-factor ideas you've described across chats,
so you + the friend can handpick them into the story. Terms drawn from how you actually talk in
the corpus. Run against the vault chats._

Corpus: `claude-vault/chats/` (the whole history) — narrow to the gig with the
`Deep-House`, `neon-cat`, `Meow-House` chat folders.

## 1 — Delight markers (find the moments you got excited)
`wow` · `so cool` · `really cool` · `i love` · `love this` · `beautiful` · `gorgeous` ·
`insane` · `sick` · `amazing` · `incredible` · `magic` / `magical` · `goosebumps` ·
`obsessed` · `perfect` · `stunning` · `mesmeriz` · `hypnotic` · `that's the one` ·
`nailed it` · `this is it` · `favourite` / `favorite` · `holy` · `damn`

## 2 — Desire / vision language (what you WANTED a moment to be)
`i want it to` · `i want` · `imagine` · `what if` · `it should feel` · `picture this` ·
`the cool thing` · `the magic` · `the moment where` · `wouldn't it be` · `we should` ·
`could we` · `dream` · `vision` · `i'm thinking`

## 3 — Named effects / mechanics (the concrete pieces)
`ebb and flow` · `chaos` · `symmetry` · `breath` / `tide` · `droste` · `kaleido` · `spiral` ·
`tunnel` · `vortex` · `possession` / `possess` · `slime` · `synapse` · `superfluid` ·
`organism` · `mosaic` · `stained glass` · `tile` / `lamp` · `BANG` · `bit crush` · `glitch` ·
`disintegrate` · `galaxy` / `void` / `black hole` · `scarf` · `wheel` · `butterfly` ·
`harmonograph` · `icosahedron` · `treasure chest` · `heartbeat` · `beam` · `snake` / `comet` ·
`gravity` / `well` · `phyllotaxis` · `doyle` · `feedback` · `warp` · `screensaver`

## 4 — Feel / aesthetic (the vibe words)
`liquid` · `smooth` · `breathe` / `swell` · `crawl` · `pulse` · `seam-free` · `infinite` /
`endless` · `psychedelic` · `immersive` · `alive` · `organic` · `pull` / `push` ·
`in and out` · `loop` / `reloop` · `slow to a crawl` · `no hard seams`

## 5 — The physical layer (the train + room)
`train` · `loop` · `clock` · `tempo` · `plateau` · `passenger` · `driver` · `in the room`

## Ready-to-run (git-bash)
```bash
cd "/c/Users/klaas/Documents/Claude/Projects/Obsidian/Claude Organisation/claude-vault/chats"

# delight moments across everything
grep -rniE "wow|so cool|really cool|i love|beautiful|gorgeous|insane|magic|goosebumps|obsessed|that'?s the one|nailed it|favou?rite" .

# what you wanted a moment to BE
grep -rniE "i want it to|imagine|what if|it should feel|the cool thing|the moment where|wouldn'?t it be" .

# gig-only: restrict to the three project chat folders
grep -rniE "wow|beautiful|the moment where|BANG|butterfly|mosaic|possess|ebb and flow" \
  *Deep-House* *neon-cat* *Meow-House*
```
Tip: add `-l` for just filenames, or `-C2` for two lines of context around each hit.
Graph is built? `graphify query "<term>"` may cluster related moments better than a flat grep.
