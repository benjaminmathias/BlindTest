# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Francophone groups of friends playing together on phones and laptops, often in the same room, plus solo players chasing a personal best on phone or desktop. Joining must be possible in seconds from a shared 4-character room code, with no account and no install.

## Product Purpose

A music blind-test game: players hear a short extract of a song and must guess the title. Solo mode scores five attempts per round; multiplayer runs the same rounds in real time so a whole room competes on the same extract. Success is a room that starts playing fast, stays in sync, and wants a rematch.

## Positioning

Instant, account-free browser play with real-time multiplayer rooms: one player creates a game, shares a short code, and everyone hears the same extract at the same moment with a live leaderboard. No app download, no sign-up, real track previews.

## Operating Context

Play happens in a shared physical space — a living room, a party, a car, a shared table — where several people each hold a phone and one screen may anchor the group. Rounds are short and timed; the lobby is where a room waits for people to join; the result screen is what the group reacts to and decides "one more" from. Solo play happens alone, usually listening through headphones or a small speaker.

## Capabilities and Constraints

- Solo game: configurable catalogue (French/international), theme, round count (5/10/15/20) and round duration (15/20/30 s), five typed guesses per round with autocomplete, skip, per-round score and persisted high score.
- Multiplayer: Supabase Realtime rooms (host + joiners via code), host-controlled catalogue/theme/rounds/duration, synchronized clock, live leaderboard, per-round reveal, final ranking, rematch.
- Music catalog and audio previews come from the iTunes Search API; Supabase provides realtime transport only.
- Stack is TypeScript + Vite with no UI framework; DOM is built imperatively and styling is plain CSS.
- Entirely French-language interface and copy.
- Round count and duration are limited to the offered options; catalogue is French or international (iTunes storefront FR vs US); themes are all / pop / rock / rap / electro / chanson française / funk-disco.

## Brand Commitments

- Product name: **Blindtest**.
- Voice: informal French, direct, second person singular ("tu"), no corporate tone.
- Existing mark: a music-note glyph in the favicon.

## Evidence on Hand

No testimonials, metrics, press, or customer names exist. Audio previews are used as a demo per the iTunes terms. Future work must not invent commercial claims, benchmarks, or social proof.

## Product Principles

- Sound first: the extract is the product; the interface must never get between the player and the moment of recognition.
- A room is a social object: joining, syncing and reacting together matter as much as individual scoring.
- Playable in seconds: no account, no install, no configuration before the first round.
- Legible under pressure: during a timed round, state, timer and answer input must be readable at a glance.
- Solo and group share one world: the same surfaces serve one player at a desk and twelve people in a room.

## Accessibility & Inclusion

Keyboard navigation, visible focus, live-region announcements for status and timers, and reduced-motion support are expected to be preserved or improved. Play often happens in dim rooms and in noisy, distracted social settings, so legibility and touch-target size are functional requirements.
