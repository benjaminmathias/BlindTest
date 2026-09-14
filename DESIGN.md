---
name: Blindtest
description: A contemporary now-playing music screen for a blind-test played solo or in real time with friends.
colors:
  room-black: "#0c0a09"
  recessed: "#131110"
  plate: "#171412"
  plate-high: "#1e1a17"
  well: "#100e0d"
  hairline: "#2a2623"
  hairline-strong: "#3a352f"
  ink: "#f4f1ec"
  ink-muted: "#a8a29a"
  ink-dim: "#8a847c"
  now-playing-green: "#31d982"
  green-bright: "#4be495"
  green-ink: "#04160c"
  miss-red: "#ff6b6b"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.4rem, 9vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.032em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.6rem, 5vw, 2.1rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
    letterSpacing: "0.01em"
  numeric:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(2.1rem, 8vw, 2.9rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.01em"
rounded:
  sm: "12px"
  md: "14px"
  lg: "18px"
  pill: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  "7": "3rem"
components:
  button-primary:
    backgroundColor: "{colors.now-playing-green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.sm}"
    padding: "0.75rem 1.15rem"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.green-bright}"
  button-secondary:
    backgroundColor: "{colors.plate-high}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.75rem 1.15rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.4rem 0.7rem"
    height: "40px"
  button-tonal:
    backgroundColor: "{colors.plate-high}"
    textColor: "{colors.now-playing-green}"
    rounded: "{rounded.sm}"
    padding: "0.75rem 1.15rem"
  field:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 0.85rem"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "clamp(1.5rem, 4.5vw, 2.25rem)"
  attempt-slot:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 0.85rem"
  stat:
    backgroundColor: "{colors.plate-high}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1rem"
  progress-track:
    backgroundColor: "{colors.hairline-strong}"
    rounded: "{rounded.pill}"
    height: "6px"
---

# Design System: Blindtest

## Overview

**Creative North Star: "The Listening Room"**

Blindtest is a contemporary music player's now-playing screen, not a game console. Every screen is the same warm near-black room lit only by the album art: flat plates, 1px hairlines, soft radii, and a lot of quiet space. Nothing is textured, bevelled, glassy, or glowing. Where a state needs to speak — hit play, time running out, right answer, wrong answer — a single vivid green or a single red does the whole job.

The world was chosen for a room of friends passing phones and sharing one laptop: the extract is the product, so the cover is the only saturated object and the interface steps back. The mystery tile holds the secret track, the clock runs down beside it, and the real cover resolves out of the tile when the round ends. Colour is never decoration; it is either the artwork or a verdict.

Density is low and deliberate. Groups are tight, sections are generous, and the hierarchy is carried by one grotesque for words and one mono for measurement. The charm lives in restraint — a green progress line, a spinning note, a cover that arrives.

**Key Characteristics:**
- A warm near-black ground with flat plates and 1px hairlines; no texture, bevel, glow, or hardware.
- One vivid green accent for action, progress, and correct; one red for wrong. Nothing else is coloured.
- Album art as the only broad source of colour, front and centre on the game stage.
- Schibsted Grotesk for UI and display; Geist Mono for timecode numerals.
- Soft 12–18px radii, pill-shaped meters and chips, generous whitespace.

## Colors

The system is a warm neutral room plus two functional signals. Album art supplies every other hue. Colour is never used decoratively; each token has a job.

### Primary
- **Now-Playing Green** (`#31d982`): the single accent. The one primary action per screen ("Jouer en solo", "Valider", "Manche suivante"), the countdown and progress fill, correct-answer tints and marks, the current player's name, the winner's rank, and a new record. It is the only saturated field the UI itself paints.
- **Green Bright** (`#4be495`): the primary button's hover fill.
- **Green Ink** (`#04160c`): text sitting on the green pad; a near-black green, never pure black.

### Secondary
- **Miss Red** (`#ff6b6b`): wrong answers only — failed attempt slots, the incorrect result row, validation errors, and the clock's final seconds. It never appears outside a wrong or urgent state.

### Neutral
- **Room Black** (`#0c0a09`): the page ground; a warm near-black, never blue-black.
- **Recessed** (`#131110`): the low chip background (personal best) and deep backgrounds.
- **Plate** (`#171412`): the main card surface on every screen.
- **Plate High** (`#1e1a17`): raised surfaces — secondary buttons, stat plates, the suggestion panel.
- **Well** (`#100e0d`): inputs, selects, attempt slots — anything sunk below the plate.
- **Hairline** (`#2a2623`) and **Hairline Strong** (`#3a352f`): 1px borders, dividers, progress-track fill.
- **Ink** (`#f4f1ec`): primary text and numerals.
- **Ink Muted** (`#a8a29a`): secondary text, labels, placeholders, artists.
- **Ink Dim** (`#8a847c`): tertiary data — ranks, meta lines, slot indices, empty-state copy.

### Named Rules
**The Art-Is-The-Color Rule.** Broad colour comes only from album art. The interface itself paints exactly two signals — green and red — and nothing else. If a surface wants a new hue, it is wrong.

**The One-Accent Rule.** Green means *action, progress, or correct*; red means *wrong or urgent*. A green element that carries none of those meanings is decoration and does not ship.

## Typography

**Display Font:** Schibsted Grotesk (Google Fonts; fallback `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`)
**Body Font:** Schibsted Grotesk (same stack)
**Numeric Font:** Geist Mono (Google Fonts; fallback `ui-monospace, "SFMono-Regular", Menlo, monospace`)

**Character:** Schibsted Grotesk is a clean, confident grotesque with just enough character to feel designed rather than default; it stays legible at label sizes and holds a tight, calm headline. Geist Mono is a precise contemporary mono used only where a player would show a number — a timecode, a code, a score — so its fixed width reads as instrumentation rather than as a costume.

### Hierarchy
- **Display** (800, clamp(2.4rem, 9vw, 3.4rem), 1, -0.032em): the home wordmark only.
- **Headline** (700, clamp(1.6rem, 5vw, 2.1rem), 1.1): screen headings ("Partie terminée", "Lobby", "Partie interrompue").
- **Title** (600, 1.05rem, 1.3): section headings and card-scale titles.
- **Body** (400, 0.95rem, 1.5): descriptions, status copy, suggestion rows.
- **Label** (500, 0.82rem, 0.01em, sentence case): field labels and quiet section labels. Labels are sentence case and untracked — never uppercase hardware legends.
- **Numeric** (500, Geist Mono): the round timer, room code, scores, ranks, player count and volume percentage, always with `font-variant-numeric: tabular-nums`.

### Named Rules
**The Timecode-Is-Mono Rule.** Geist Mono is reserved for measurement — timer, room code, scores, ranks, percentages. It never sets a word. If a string is prose, it is Schibsted Grotesk.

**The Sentence-Case Rule.** Labels are sentence case at 0.82rem, not tracked uppercase. The old screen-print legend voice is gone; a control is named quietly.

## Layout

Every screen is one centred column. The content column is `min(100% - 2rem, 560px)` on home, lobby, result and game — there is no wide desktop layout and no sidebar; the phone-shaped column is the product. Plates pad at `clamp(1.5rem, 4.5vw, 2.25rem)`.

Spacing follows one 0.25rem-based scale (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3rem). Groups are tight (0.5–0.75rem), sections are generous (1.5–2rem), and a heading always has more space above it than below. The game screen is a deliberate vertical stack with every duplicate stripped out: topbar (round number, score, volume), stage (cover + clock), the guess area, the leaderboard, and leave. The round timeline lives only on the result screen; the status line stays empty and collapses until it has something real to say (a wrong answer, a check, an error). On reveal the round result takes the clock's place in the same fixed slot — the clock hides, the card appears, and nothing below moves — and the guess field is replaced in place by the round's primary action, so the bottom slot always holds "what happens next".

Responsive behaviour is driven by a few narrow breakpoints. At **560px** the multi-column arrangements collapse to one column — the settings grid, the multiplayer form, the action pairs, the score summary — the faceplate padding tightens to 1.35rem, and the stage eases to `min(56vw, 230px)` so the clock and guess field stay in view on a phone. The guess field and its submit keep sharing one line down to about **400px**, where they finally stack. Around **430px** the game topbar is allowed to wrap so the round label, score and volume never overflow. At **380px** the stage tightens to `min(58vw, 195px)`, the clock drops to a 1.85rem floor, the stage's bottom margin shrinks, and the page padding tightens again — the intent being to keep both the guess field and its action above the fold on common phones (around 360×800), though this depends on the browser's viewport and zoom.

## Elevation & Depth

Depth is **flat and bordered**. The system uses no drop shadows on plates, buttons, inputs, or cards: a surface is either a plate at `Plate`, a raised element at `Plate High`, or a well at `Well`, each separated by a 1px hairline. The only shadow in the system floats the autocomplete suggestion panel and the in-game volume popover above the plate, and the only other shadow is the focus ring. There is no texture, no inner bevel, and no gradient surface.

### Shadow Vocabulary
- **Popover lift** (`0 24px 48px -12px rgba(0, 0, 0, 0.78)`): the guess suggestion panel and the in-game volume popover.
- **Focus ring** (`0 0 0 3px rgba(49, 217, 130, 0.18)`): inputs and the search field on focus, paired with a green border. Error fields use `0 0 0 3px rgba(255, 107, 107, 0.16)`.

### Named Rules
**The Flat-Plate Rule.** Elevation is tone plus a hairline, never a cast shadow. The floating surfaces in the product are the suggestion panel and the in-game volume popover; adding a shadow anywhere else is drift.

## Shapes

Corners are soft and modern, never pill-shaped for containers. Plates and the artwork frame carry 18px; stat plates, the search field, round-result cards and the suggestion panel carry 14px; buttons, inputs, selects, attempt slots and suggestion rows carry 12px. Pills (999px) are reserved for meters, progress bars, chips and badges. Borders are always 1px hairlines. Nothing is clipped or masked into a circle except the authored disc and the small indicator dots.

## Components

### Buttons
- **Shape:** 12px corners; min-height 48px (ghost 40px); sentence-case labels.
- **Primary:** solid Now-Playing Green with Green Ink text; used once per screen for the main action ("Jouer en solo", "Valider", "Manche suivante").
- **Tonal:** Plate High fill, green text, green hairline — the multiplayer "Rejoindre", so the home screen keeps a single solid primary.
- **Secondary:** Plate High fill with a hairline-strong border and Ink text; pairs with the primary.
- **Ghost:** transparent with muted text; low-priority controls ("Copier").
- **Hover / Focus:** primary brightens to Green Bright; secondary lifts one tone; hover states only apply on fine pointers (`@media (hover: hover) and (pointer: fine)`); focus-visible is a 2px green outline at 2px offset; `:active` presses 1px down and scales to 0.96; disabled drops to 42% opacity.

### Cards / Containers
- **Corner Style:** 18px plate; 14px nested plate.
- **Background:** Plate, with Plate High for raised content.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** 1px Hairline.
- **Internal Padding:** `clamp(1.5rem, 4.5vw, 2.25rem)` on plates; 1rem on stat plates.

### Inputs / Fields
- **Style:** Well background, 1px Hairline border, 12px corners, Ink text, green caret.
- **Focus:** border and a 3px soft green ring; the guess search moves the same treatment to its wrapper on `:focus-within`.
- **Error / Disabled:** `aria-invalid` switches border and ring to Miss Red; disabled is 42% opacity.

### Attempt Slots
- **Style:** stacked compact wells (12px corners) with a Geist Mono index in Ink Dim and a faint em-dash placeholder for unused rows.
- **State:** wrong fills and borders tint Miss Red; correct tints green; both lift in over 200ms. On reveal the whole stack softens in place (`blur(2px)` at 50% opacity) so the result card is the only sharp verdict, the space never reads empty, and nothing below shifts.
- **Marks:** correct ✓, failed ✗, timeout ○ and skipped ▶| are drawn at a uniform 2px weight; the filled skip-forward mark keeps the 'passer' meaning legible at 15px.

### Clock & Progress
- **Style:** a Geist Mono readout (clamp 2.1–2.9rem) over a 6px pill track filled with Now-Playing Green.
- **State:** the fill scales left-to-right; in the final 5 seconds both the readout and the fill switch to Miss Red.

### Round Result
- **Style:** a full-width Plate High bar (14px corners, 1px hairline) that takes the clock's slot on reveal; a 26px well chip holds the verdict mark, then the track — artist, with the round's points in Geist Mono at the right. It stays under the clock's height so the reveal never moves the layout.
- **State:** correct tints the border and chip green; wrong tints them Miss Red; timeout and skip stay neutral (Hairline Strong border, Well chip, Ink Muted mark). The bar lifts in over 240ms and the awarded points land with a short pop.

### Artwork Stage
- **Style:** a square 18px plate (`min(72vw, 300px)`) holding either the mystery mark or the cover. On phones it eases to `min(56vw, 230px)` at ≤560px and `min(58vw, 195px)` at ≤380px to help keep the guess field and its action in view.
- **Behaviour:** the mystery mark is two faint rings and a green note that rotates slowly (8s) while the extract plays, pausing on reveal; the cover scales from 1.05 to 1 as it fades in over 380ms while the mystery mark scales down and fades over 280ms. Both are disabled under `prefers-reduced-motion`.

### Suggestion Panel
- **Style:** Plate High, 14px corners, 0.35rem padding, floating on the popover lift above the search field.
- **State:** the hovered/active row tints green-soft; the matched substring is green.

### Volume
- **Style:** the home screen shows the fader inline as a full-width row. During a round it collapses to a 44px authored speaker icon in the topbar that opens the same fader in a Plate High popover on the popover lift; the icon swaps to a muted mark at 0%.
- **Behaviour:** the popover closes on Escape or an outside tap, and focus moves to the slider when it opens.

### Chips & Badges
- **Style:** pills. The host badge is green text on green-soft with a green border; the personal-best chip is Recessed with muted text and an Ink numeral.

### Leaderboard Rows
- **Style:** hairline-separated rows on a 1.9rem rank / name / score grid; rank and score in Geist Mono, rank in Ink Dim.
- **State:** the current player's name turns green; the winner's rank turns green.

## Do's and Don'ts

### Do:
- **Do** keep exactly one solid green primary action per screen; pair it with at most one secondary or tonal button.
- **Do** let album art be the only broad colour; the UI itself paints only green (action/progress/correct) and red (wrong).
- **Do** name controls with quiet sentence-case labels at 0.82rem, not tracked uppercase legends.
- **Do** set `font-variant-numeric: tabular-nums` on every changing number, and set measurement in Geist Mono.
- **Do** express elevation as tone plus a 1px hairline; reserve the popover lift for the suggestion panel.
- **Do** keep radii within 12–18px and reserve 999px pills for meters, chips and badges.
- **Do** disable the disc rotation, the reveal scale and all transitions under `prefers-reduced-motion`.

### Don't:
- **Don't** add texture, bevels, screws, walnut, brushed metal, or any skeuomorphic hardware — the analogue-console world is retired.
- **Don't** add glow, neon, backdrop blur, glass, or gradient text.
- **Don't** introduce a third signal colour; a new hue means the surface is off-system.
- **Don't** tint scores, ranks or the leaderboard with the accent except for the current player and the winner.
- **Don't** use pure black or pure gray ink; every neutral is warm.
- **Don't** set words in Geist Mono, or write an uppercase eyebrow/kicker above a heading.
- **Don't** nest a card inside a card; interior groups are flat tone changes or wells.
- **Don't** replace the authored SVG icons, the mystery mark, or the music-note favicon with emoji or unicode glyphs.
