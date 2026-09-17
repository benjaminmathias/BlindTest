import type { Track } from './api'
import { oneOf } from './shared/validate'
import { getCanonicalSongKey, getDisplaySongTitle, normalizeComparableText } from './song'

export const ROUND_COUNT_OPTIONS = [5, 10, 15, 20] as const
export const ROUND_DURATION_OPTIONS = [15, 20, 30] as const
export const MAX_ATTEMPTS = 5

export type RoundCount = (typeof ROUND_COUNT_OPTIONS)[number]
export type RoundDuration = (typeof ROUND_DURATION_OPTIONS)[number]

export type GuessOption = Pick<Track, 'id' | 'title' | 'artist'>

export type RoundOutcome = 'correct' | 'failed' | 'timeout' | 'skipped'

export const MIN_SEARCH_LENGTH = 2
export const MAX_SUGGESTIONS = 5

export const isRoundCount = (value: unknown): value is RoundCount =>
  oneOf(value, ROUND_COUNT_OPTIONS)

export const isRoundDuration = (value: unknown): value is RoundDuration =>
  oneOf(value, ROUND_DURATION_OPTIONS)

export function formatGuessOption(track: GuessOption): string {
  return `${getDisplaySongTitle(track.title)} — ${track.artist}`
}

export function normalizeSearchText(value: string): string {
  return normalizeComparableText(value)
}

export function findGuessOption(options: GuessOption[], value: string): GuessOption | null {
  const normalized = normalizeSearchText(value)
  return options.find((option) => normalizeSearchText(formatGuessOption(option)) === normalized) ?? null
}

type RankedGuess = {
  option: GuessOption
  score: number
  order: number
}

export function searchGuessOptions(
  options: readonly GuessOption[],
  query: string,
  limit = MAX_SUGGESTIONS,
  excludedKeys: ReadonlySet<string> = new Set<string>(),
): GuessOption[] {
  const needle = normalizeSearchText(query)

  if (needle.length < MIN_SEARCH_LENGTH || limit <= 0) {
    return []
  }

  const ranked: RankedGuess[] = []
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()

  options.forEach((option, order) => {
    if (seenIds.has(option.id)) {
      return
    }

    const title = normalizeSearchText(getDisplaySongTitle(option.title))
    const artist = normalizeSearchText(option.artist)

    let score = -1
    if (title.startsWith(needle)) score = 0
    else if (artist.startsWith(needle)) score = 1
    else if (title.includes(needle)) score = 2
    else if (artist.includes(needle)) score = 3

    if (score === -1) {
      return
    }

    const key = getCanonicalSongKey({ title: option.title, artist: option.artist })
    if (excludedKeys.has(key) || seenKeys.has(key)) {
      return
    }

    seenIds.add(option.id)
    seenKeys.add(key)
    ranked.push({ option, score, order })
  })

  ranked.sort((first, second) => first.score - second.score || first.order - second.order)

  return ranked.slice(0, limit).map(({ option }) => option)
}

export function getRandomTrack(availableTracks: Track[]): Track {
  if (availableTracks.length === 0) {
    throw new Error('Aucun morceau disponible')
  }

  const track = availableTracks[Math.floor(Math.random() * availableTracks.length)]
  if (!track) {
    throw new Error('Aucun morceau disponible')
  }
  return track
}

export function pickUnplayedTrack(tracks: readonly Track[], playedTrackIds: Set<string>): Track {
  let availableTracks = tracks.filter((track) => !playedTrackIds.has(track.id))

  if (availableTracks.length === 0) {
    playedTrackIds.clear()
    availableTracks = [...tracks]
  }

  // Privilégie un artiste pas encore entendu dans la partie pour éviter les
  // répétitions ; si le catalogue ne le permet pas, on retombe sur tous les
  // morceaux non joués.
  const playedArtists = new Set(
    tracks
      .filter((track) => playedTrackIds.has(track.id))
      .map((track) => normalizeComparableText(track.artist)),
  )
  const freshArtistTracks = availableTracks.filter(
    (track) => !playedArtists.has(normalizeComparableText(track.artist)),
  )
  const track = getRandomTrack(freshArtistTracks.length > 0 ? freshArtistTracks : availableTracks)

  playedTrackIds.add(track.id)
  return track
}

export function getRoundScore(
  remainingTime: number,
  roundDurationMs: number,
  maxRoundScore: number,
): number {
  if (
    !Number.isFinite(remainingTime)
    || !Number.isFinite(roundDurationMs)
    || !Number.isFinite(maxRoundScore)
    || roundDurationMs <= 0
    || maxRoundScore <= 0
    || remainingTime <= 0
  ) {
    return 0
  }

  const ratio = remainingTime / roundDurationMs
  return Math.max(1, Math.min(maxRoundScore, Math.floor(maxRoundScore * ratio)))
}

export function getAttemptScore(
  remainingTime: number,
  roundDurationMs: number,
  maxRoundScore: number,
  attempt: number,
): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_ATTEMPTS) return 0
  const timeScore = getRoundScore(remainingTime, roundDurationMs, maxRoundScore)
  return timeScore === 0 ? 0 : Math.max(1, Math.floor(timeScore * (6 - attempt) / 5))
}
