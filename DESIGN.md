---
name: Blindtest
description: An analogue DJ console for a music blind-test played solo or in real time with friends.
colors:
  void: "#08090a"
  chassis: "#101114"
  plate: "#17181c"
  plate-high: "#1e1f24"
  well: "#0d0e11"
  hairline: "#2a2b31"
  hairline-strong: "#3a3c44"
  cream: "#ede6d6"
  cream-muted: "#aaa395"
  cream-dim: "#807a6d"
  signal: "#f0522f"
  signal-bright: "#ff6c48"
  signal-deep: "#c23b1b"
  signal-ink: "#180a05"
  cue-cyan: "#5ec8d6"
  vu-green: "#79c98d"
  hazard-red: "#dd4b57"
  peak-amber: "#efb64a"
  dial-cream: "#ded5c2"
  walnut-high: "#6b4a32"
  walnut-deep: "#392519"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.1rem, 7vw, 3.1rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.45rem, 4.4vw, 1.85rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 600
    letterSpacing: "0.14em"
  counter:
    fontFamily: "Doto, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 8.5vw, 3.6rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "14px"
  display: "5px"
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
    backgroundColor: "{colors.signal}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
  button-secondary:
    backgroundColor: "{colors.plate-high}"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cream-muted}"
    rounded: "{rounded.md}"
    padding: "0.35rem 0.7rem"
  field:
    backgroundColor: "{colors.well}"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "0.7rem 0.85rem"
  faceplate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.cream}"
    rounded: "{rounded.lg}"
    padding: "clamp(1.35rem, 4vw, 1.9rem)"
  attempt-slot:
    backgroundColor: "{colors.well}"
    textColor: "{colors.cream-muted}"
    rounded: "{rounded.sm}"
    padding: "0.42rem 0.7rem"
  level-meter-track:
    backgroundColor: "{colors.dial-cream}"
    textColor: "{colors.chassis}"
    rounded: "{rounded.xs}"
    height: "14px"
  platter:
    backgroundColor: "{colors.well}"
    textColor: "{colors.signal}"
    rounded: "{rounded.lg}"
    width: "min(72vw, 300px)"
---

# Design System: Blindtest

## Overview

**Creative North Star: "The Analogue Console"**

Blindtest is a physical two-channel DJ console sitting in a dim living room, not a dark-mode web app. Every screen is a faceplate: brushed graphite metal with walnut end-cheeks and corner screws, cream screen-printed legends, and incandescent indicator lamps. Nothing glows, nothing is glass, and nothing floats — state is shown by a switch, a lamp, or a meter, the way it is on real hardware.

The world was chosen for a room of friends passing phones and sharing one laptop: the product is a music machine, and it should read as one before a single word is parsed. The extract is a record on a platter; the round timer is a cream-faced meter with a printed scale and a black pointer; the volume is a fader with a metal cap; the primary action is a record-armed pad. The visual identity was replaced wholesale while the screens, flows and layout were preserved exactly.

Density is low and deliberate. Large plates, generous separation between groups, and tight gaps inside a group. Type does the hierarchy work: tracked uppercase legends name every control, Archivo carries the words, and a dot-matrix face carries measurement. The charm lives in the small physical details — bevels, ticks, a spun platter, a lamp that goes dark when the round is answered.

**Key Characteristics:**
- Graphite faceplates with walnut end-cheeks, corner screws, and inset hardware bevels.
- Cream screen-print ink on dark metal; no pure black text and no gray.
- One saturated signal orange-red for the record-armed primary; cue-cyan for the selected/active track; VU-green correct; hazard-red wrong.
- A cream-faced analogue meter as the round clock, with a black pointer.
- Dot-matrix numerals reserved for large readouts: timer, room code, best score.

## Colors

A warm graphite chassis carrying one saturated signal color, a small set of panel LEDs, and a cream "printed ink" family. Color is never decorative; each hue has a job.

### Primary
- **Record-Arm Orange** (`#f0522f`): the one primary action per screen ("Jouer en solo", "Rejoindre", "Manche suivante"). It is a hot orange-red like a record button, and it is the only large saturated field on the page.
- **Record-Arm Bright** (`#ff6c48`): the top of the primary pad's vertical gradient and its hover state; also highlighted search matches.
- **Record-Arm Deep** (`#c23b1b`): the bottom of the primary pad gradient and the start of the meter's level fill.
- **Armature Ink** (`#180a05`): text sitting on the orange pad; near-black warm brown, never pure black.

### Secondary
- **Cue Cyan** (`#5ec8d6`): the headphone-cue color. Marks the currently selected or focused thing — keyboard focus rings, the active search field, the hovered suggestion, the current player in a leaderboard. It never competes with the orange action.
- **VU Green** (`#79c98d`): correct answers only — attempt marks, recap marks, timeline segments.
- **Hazard Red** (`#dd4b57`): wrong answers, validation errors, and the final seconds of a round.
- **Peak Amber** (`#efb64a`): scores and readouts; the "record" number; the count in a players list.

### Neutral
- **Room Void** (`#08090a`): the page ground beneath everything.
- **Chassis** (`#101114`): the body falloff the page ground fades to.
- **Faceplate** (`#17181c`): the main panel surface, always under a soft diagonal sheen.
- **Faceplate High** (`#1e1f24`): raised secondary surfaces and popover panels.
- **Recessed Well** (`#0d0e11`): inputs, selects, slots, settings panels, stat readouts — anything sunk into the plate.
- **Hairline** (`#2a2b31`) and **Hairline Strong** (`#3a3c44`): 1px panel rules, borders, and dividers.
- **Screen-Print Cream** (`#ede6d6`): primary text and the dial face.
- **Screen-Print Muted** (`#aaa395`): secondary text, legends, placeholders, artists.
- **Screen-Print Dim** (`#807a6d`): decorative-only marks; never body text.
- **Dial Cream** (`#ded5c2`): the meter face and the best-score display.
- **Walnut High** (`#6b4a32`) / **Walnut Deep** (`#392519`): the end-cheeks painted at the left and right edges of every faceplate.

### Named Rules
**The No-Glow Rule.** Nothing emits light. Indicator lamps are flat filled dots; there is no text-shadow glow, no outer halo, and no neon. "Lit" is a saturated fill, not radiance.

**The Lamp Palette Rule.** Red, amber and cyan appear only as small lamps, meter fills and marks, or one primary pad — never as page-scale fields, never as background washes.

## Typography

**Display Font:** Archivo (Google Fonts; fallback `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`)
**Body Font:** Archivo (same stack)
**Counter Font:** Doto (Google Fonts; fallback `Archivo`, then the same sans stack)

**Character:** Archivo is a neutral, slightly technical grotesque that behaves like screen-print legend on a metal panel; it stays out of the way at small sizes and holds tight, confident headlines. Doto is a dot-matrix display face borrowed from a hardware readout window — used only where a real console would have a segmented or dot display, so its texture reads as instrumentation rather than as a retro costume.

### Hierarchy
- **Display** (800, clamp(2.1rem, 7vw, 3.1rem), 1, -0.035em): the home wordmark only.
- **Headline** (700, clamp(1.45rem, 4.4vw, 1.85rem), 1.2): screen headings ("Quel est ce titre ?", "Partie terminée", "Lobby"). Result-screen `h1` runs slightly larger at clamp(1.75rem, 5vw, 2.5rem).
- **Title** (600, 1.05rem, 1.3): section headings and card-scale titles.
- **Body** (400, 0.95rem, 1.5): descriptions and status copy; muted cream by default, full cream for emphasis.
- **Label** (600, 0.68rem, 0.14em, uppercase): every screen-print legend — field labels, "MANCHE 1 / 5", "SCORE", "RÉCAPITULATIF", "CLASSEMENT", stat labels, result statuses.
- **Counter** (900, clamp(2.4rem, 8.5vw, 3.6rem), 1): the round timer; also the room code (up to 3.6rem) and the best-score and peak-stat readouts at reduced sizes.

### Named Rules
**The Doto-Is-A-Display Rule.** Doto is used only for a large measurement inside a display — the timer, the room code, the best score, the peak stat. Inline data (scores in the topbar and leaderboard, volume percentage, slot indices, round numbers) stays in Archivo with `font-variant-numeric: tabular-nums`. If a Doto number would sit below ~1.3rem in a busy row, it is the wrong face.

**The Legend Carries The Weight Rule.** Small uppercase tracked Archivo labels name the controls; headings are never preceded by an eyebrow or kicker, because the legend already does that job.

## Layout

A single centered column on every screen, widening from 540px (home, result) to 560px (lobby, game). The column is a faceplate: `padding: clamp(1.35rem, 4vw, 1.9rem)` with 8–12px of walnut painted at the left and right edges, so content keeps a safe inner margin on all breakpoints. The page ground is a fixed radial falloff from the top center into the void.

Spacing follows one 0.25rem-based scale (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3rem). Groups are tight (0.5–0.75rem inside a field), sections are generous (1.5–2rem), and a heading always has more space above it than below. The game screen is a vertical stack: topbar, round timeline, stage (platter + meter), question, guess area, status, leaderboard, leave.

Responsive behavior is two breakpoints. At **560px** every multi-column arrangement collapses to one column — the settings grid, the multiplayer form, the guess search, and the action pairs — and the faceplate padding tightens to 1.2rem. At **380px** the score summary collapses to one column and the platter/meter width eases to `min(78vw, 280px)`. The settings and rules grids are two columns above 560px, with duration and volume taking the full row.

## Elevation & Depth

Depth is **inset, not cast**. There are no drop shadows on panels, buttons or inputs: surfaces are milled into the plate. Raised elements (the primary pad, popovers) get a 1px top highlight and an inset bottom shadow; recessed elements (wells, slots, the settings panel) get a dark inner shadow and a 1px lower highlight. The only outer shadow in the system floats the autocomplete popover above the plate. Plates carry a soft **103° diagonal sheen** to read as brushed aluminium rather than flat paint.

### Shadow Vocabulary
- **Plate bevel** (`inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.55)`): every faceplate.
- **Pad top light** (`inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -3px 5px rgba(0,0,0,0.28)`): primary and secondary buttons; inverted on `:active` to `inset 0 1px 3px rgba(0,0,0,0.5)`.
- **Well recess** (`inset 0 2px 6px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.03)`): inputs, selects, slots, stat panels.
- **Popover lift** (`0 22px 44px -16px rgba(0,0,0,0.85)`): the suggestion list only.
- **Sheen** (`linear-gradient(103deg, rgba(255,255,255,0.05), transparent 22%, transparent 72%, rgba(255,255,255,0.022))`): the top background layer of every faceplate.

### Named Rules
**The Milled-Not-Floating Rule.** Elevation is expressed as a bevel: highlight on top, shadow inside the bottom. A raised element never adds an outer drop shadow, and a card is never a card within a card — nested surfaces are recessed wells.

## Shapes

Corners are gently milled, never pill-shaped: 14px for faceplates, 10px for the settings panel, stat readouts and popovers, 8px for buttons and fields, 6px for attempt slots, 4px for timeline and meter segments. The meter and score displays cap at 5px. Borders are always 1px hairlines; the only heavier rules are the 2px signal underline beneath the lobby room code and the 3px black pointer at the meter fill's leading edge. Nothing is clipped, masked or shaped into a circle except the authored vinyl disc and LED lamps.

## Components

### Buttons
- **Shape:** gently milled 8px corners; min-height 48px (40px for ghost).
- **Primary:** a record-armed pad — vertical gradient from Record-Arm Bright to Record-Arm Deep, Armature Ink text, tracked uppercase 700, with a top highlight and inset bottom shadow. Used once per screen for the main action.
- **Secondary:** a dark rubber pad — Faceplate-High gradient, hairline-strong border, cream text, same bevel. Pairs with the primary in a two-column action grid.
- **Ghost:** transparent, muted-cream text, no border; used for low-priority controls ("Copier", "Passer") and hovers to Faceplate-High.
- **Hover / Focus:** hover brightens the surface by one step; focus-visible is a 2px Cue Cyan outline at 2px offset; `:active` presses 1px down and swaps the bevel for an inner shadow; disabled drops to 40% opacity with no shadow.

### Cards / Containers
- **Corner Style:** 14px faceplates; 10px recessed panels.
- **Background:** Faceplate under a diagonal sheen, or Recessed Well for nested content.
- **Shadow Strategy:** plate bevel only — see Elevation & Depth.
- **Border:** 1px Hairline (Hairline Strong for popovers). Walnut strips and corner screws are painted as background layers of the plate.
- **Internal Padding:** `clamp(1.35rem, 4vw, 1.9rem)` on plates, 1rem on recessed panels.

### Inputs / Fields
- **Style:** Recessed Well background, 1px Hairline border, 8px corners, inner recess shadow, cream text, orange caret.
- **Focus:** border and a 0.5-alpha ring shift to Cue Cyan; the search field moves the same treatment to its wrapper on `:focus-within`.
- **Error / Disabled:** `aria-invalid` switches border and ring to Hazard Red; disabled is 40% opacity.

### Fader (volume)
- **Style:** a 10px recessed groove with printed 12px tick marks and a metal thumb — 16×30px, 3px corners, warm-cream gradient, a dark center grip line.
- **State:** the percentage readout is Archivo tabular in Peak Amber; the compact in-round variant shrinks the track to 8px and the cap to 13×24px.

### Level Meter (round timer)
- **Style:** a 14px Dial-Cream face with printed ink ticks and a 1px metal border, recessed; the level is an orange-red gradient whose leading edge is a 3px black pointer.
- **State:** full track while the extract plays, emptying left-to-right; in the final 5 seconds both the readout and the fill switch to Hazard Red.

### Platter (artwork)
- **Style:** a square recessed deck (14px corners, inner vignette) holding a 96% authored SVG vinyl disc — grooved rings, an orange label, a cream index mark, a spindle hole.
- **Behavior:** the disc rotates 360° over 5.5s while the extract plays and pauses the moment the round is revealed; the reveal fades the real cover in over it. The disc rotation is disabled under `prefers-reduced-motion`.

### Attempt Slots
- **Style:** stacked recessed wells (6px corners) with an Archivo tabular index in muted cream.
- **State:** wrong fills and borders tint Hazard Red; correct tint VU Green; both animate in with a 3px lift over 200ms.

### Leaderboard Rows
- **Style:** hairline-separated rows on a 1.9rem rank / name / score grid; rank and score in Archivo tabular, score in Peak Amber.
- **State:** the current player's name turns Cue Cyan; the winner's rank turns Peak Amber.

## Do's and Don'ts

### Do:
- **Do** keep exactly one orange-red primary action per screen; pair it with at most one secondary pad.
- **Do** name every control with a small tracked uppercase Archivo legend.
- **Do** sink form controls, slots and stat readouts into the plate as wells; raise only the actions and the popover.
- **Do** set `font-variant-numeric: tabular-nums` on every number that changes (timers, scores, counts, percentages).
- **Do** reserve Doto for large measurement displays, and fall back to Archivo beneath ~1.3rem in a busy row.
- **Do** keep the cream inks warm and tinted — muted text is `#aaa395`, never a neutral gray.
- **Do** disable the platter rotation, transitions and animations under `prefers-reduced-motion`.

### Don't:
- **Don't** add glow, text-shadow halos, neon edges, glass or backdrop blur — the No-Glow Rule is absolute.
- **Don't** put the three lamp colors on large fields, gradients or backgrounds; they exist as lamps, meter fills and marks.
- **Don't** use pure black text, pure gray text, or any gray that is not the warm cream family.
- **Don't** add an outer drop shadow to a panel, button, input or card; use an inset bevel.
- **Don't** nest a card inside a card; interior groups are recessed wells.
- **Don't** use gradient text, pills, or radii above 16px.
- **Don't** add an eyebrow or kicker above a heading, or section numbers; the legend above a control is the only label a section gets.
- **Don't** replace the authored SVG icons and vinyl disc with emoji or unicode glyphs.
