/* guide.js — The Guide.
 *
 * A dry, pun-forward brain-tour host. This is a CHARACTER — a costume with
 * the seams deliberately showing. None of this is the artist's sincere voice, and
 * that's the point: the bit is on the billboard, the person is not.
 * Trim, cut, or rewrite any line below. It's just arrays.
 */
window.GUIDE = {

  boot: [
    "Welcome to the inside of my skull. Mind the wiring. It's load-bearing and slightly on fire.",
    "Calibrating neurotransmitters… close enough.",
    "Three rooms are open tonight. The rest are under renovation. Since 1994."
  ],

  lobby: [
    "Pick a room. The doors don't lock. Mostly.",
    "It's all one open-plan office in here. Terrible acoustics, excellent lighting.",
    "Thoughts wipe their feet on the way in. Usually.",
    "Tour runs continuously. The exits are decorative.",
    "You are here. Statistically, so am I."
  ],

  lockedDoor: [
    "Access denied. Bears. Beets. Boundaries.",
    "That room is load-bearing. And private. Mostly load-bearing.",
    "Locked. The key is under a mat I also lost.",
    "Nothing behind this door but drywall and formative experiences."
  ],

  feelings: {
    intro: [
      "The Feelings Room. Everything is colour-coded because the words kept filing complaints.",
      "Pick a feeling. The house will feel it with you. That's not a metaphor — check the lamps.",
      "Words are a second language in here. Light is the first.",
      "Ten feelings on tap. The rest are homebrew and not up to code."
    ],
    applied: [
      "Noted. Broadcasting to every lamp within emotional range.",
      "The house is feeling that now too. You're welcome, house.",
      "Filed under: the walls know.",
      "Good choice. The ceiling agrees — look up.",
      "Transmitted. Somewhere a lightbulb just understood you."
    ],
    offline: [
      "The lamps aren't answering. Rude. The feeling still counts.",
      "Lights offline — you'll have to imagine the colour. You're in a brain, imagining is local."
    ]
  },

  math: {
    intro: [
      "Math goes brrr. This is the sound the universe makes when nobody's watching.",
      "Primes incoming. They arrive unannounced and follow no pattern. Relatable.",
      "This room runs itself. Best employee I have.",
      "No feelings past this point. Only numbers, which is its own feeling."
    ],
    flip: [
      "Different math, same brrr.",
      "Rotating the numbers. They don't mind.",
      "New equation on deck. It converges. Eventually. Like me."
    ]
  },

  gallery: {
    intro: [
      "The Gallery. It's all noise right now. Up to you whether it stays that way.",
      "Tune it. The mess wants to become a shape — it just needs a hand.",
      "Chaos on the left, symmetry on the right. The house feels wherever you land.",
      "Nudge the numbers toward order. Watch what the whole place does when you do."
    ],
    tuning: [
      "Warmer. It's finding itself.",
      "There it is — the tangle's remembering it has a shape.",
      "Keep going. Order is a verb in here."
    ],
    next: [
      "New pattern. Same job: pull it into symmetry.",
      "Fresh chaos. You know what to do.",
      "Different equation, same ask — bring it home."
    ],
    locked: [
      "Symmetry. The house exhales — and somewhere a locked thing loosens.",
      "There. Perfect balance. Feel the rest of the house settle with it.",
      "You did that. Not me. The whole place just got a little clearer.",
      "Regulation isn't a mood that arrives. It's a thing you just built by hand."
    ]
  },

  decks: {
    intro: [
      "Fewer feelings, more bass. Finally.",
      "The Decks. Where the BPM is made up and the lights obey anyway.",
      "Feed me a beat. Mic or spacebar — the lamps aren't picky, and neither am I.",
      "This is the room where overthinking goes to dance."
    ],
    tap: [
      "Tap detected. Percussion is just math with confidence.",
      "Keep tapping. The house keeps time better than I do."
    ],
    micOn: [
      "Listening. Play something. The lamps have opinions.",
      "Mic open. Every beat you drop, a lightbulb drops it harder."
    ],
    micDenied: [
      "No mic? No problem. Spacebar is an instrument now.",
      "Microphone declined. Fair. Tap the spacebar on the beat instead."
    ]
  },

  archive: {
    intro: [
      "The Archive. The renovation's done in here — turns out it was always the point.",
      "Every shelf is a story you can walk. Pick a thread. The house lights it as you go.",
      "Careful in here. The wiring's honest. That's rarer than it sounds.",
      "These aren't feelings on tap — they're feelings with a plot. Choose one and follow it."
    ],
    walk: [
      "Keep going. The next beat's already warming up the lamps.",
      "Down for forward, up to sit with the last one. The house keeps pace.",
      "This is the part where the colour does the talking."
    ]
  },

  lightsLost: [
    "Lights offline. The house is ignoring me. It happens.",
    "Lost contact with the lamps. The tour continues on imagination power."
  ],
  lightsBack: [
    "Lamps reacquired. As I was saying —",
    "The house is speaking to me again. We've agreed not to discuss it."
  ],

  backFromLobby: [
    "You're already inside. There's no going back. There never was.",
    "Exit? Bold of you. This is a brain, not a hallway."
  ],

  /* ── THE FIELD ──────────────────────────────────────────────────────
   * PLACEHOLDER COPY. The engine is complete; these lines are scaffolding so
   * the hooks have something to say. Rewrite freely — nothing references the
   * text, and the Guide is an openly-costume host, never sincere-K voice.
   * Keep the display boundary: no prose about anyone, ever.
   * ────────────────────────────────────────────────────────────────────── */
  field: {
    intro: [
      "Oh good, you found the dark part. Mind the wiring.",
      "No corridors tonight. Just what's next to what."
    ],
    arrive: [
      "Something here. Not sure what yet. That's your job.",
      "New one. It's been waiting, apparently."
    ],
    readMatch: [
      "Mm. That's what it thought too.",
      "Agreed. Rare, that."
    ],
    readMiss: [
      "That's not what it thought. Doesn't make you wrong.",
      "Noted. The house disagrees, politely, and stays."
    ],
    caseWalked: [
      "That's all of that one. You'll notice it isn't finished.",
      "Walked. Whether it's solved is a different question."
    ],
    phase: {
      2: ["Things are starting to stay lit. That's new."],
      3: ["...", "Give it a moment."],
      4: ["It's not still. It was never going to be still."]
    }
  },

  pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
};
