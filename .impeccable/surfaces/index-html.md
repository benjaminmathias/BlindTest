---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface brief — Blindtest (whole app)

- **Scope:** every existing screen and flow; the exact composition, DOM, class names and behavior stay. Visual identity only.
- **Mode:** Operate (party game; the visitor plays, doesn't read or decide).
- **Audience & scene:** francophone friends at a party, phones in hand plus a laptop, dim room; also solo players on phone or desktop.
- **Job:** start or join a room fast, hear the extract, guess the title under time pressure, see who leads, rematch.
- **Memorable moment:** the neutral mystery tile holding the secret track, the clock running down beside it, then the real cover resolving out of it as the round ends.
- **Constraints:** all screens, copy, French voice, features and flows preserved; keyboard focus, aria live regions and reduced-motion preserved or improved; no framework; iTunes previews + Supabase unchanged; no invented claims.

## Direction contract

THESIS: The app is a contemporary music player's now-playing screen, not a game console. It refuses the analogue-hardware costume it replaces and the neon-on-black club cliché: the album art is the only saturated object, and every state reads as a clean, modern player control.

OWN-WORLD: A warm near-black ground with flat surface plates and 1px hairlines — no texture, no bevels, no glow, no walnut. Soft 12–18px radii, generous whitespace, one vivid green accent (`#31D982`) for the primary action, progress and correct answers, one red (`#FF6B6B`) for wrong answers, and album art as the sole source of broad colour. Type: Schibsted Grotesk for UI and display, Geist Mono for timecode numerals (timer, room code, scores). Recognizable with all content removed as a music player.

STORY: A visitor sees a cover, a clock and a search field and understands "hear it, name it, before the clock ends." They set a game, play, watch the mystery tile resolve into the real cover, and read the room's scores together.

FIRST VIEWPORT (home): a centred, airy column; the Blindtest wordmark set large over a single-line description and a compact personal-best chip; an open settings group of labelled selects and a volume fader; one full-width green "Jouer en solo" pad; below a hairline, a multiplayer group with pseudo and code fields, a tonal "Rejoindre" and a neutral "Créer une partie".

FORM: the user's pinned direction, my top-ranked grounded candidate — a contemporary streaming now-playing screen; seed key 69932c79; pinned over the roll's assigned candidate 6.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
