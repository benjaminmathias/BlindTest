import type { Track } from './api'

export const ROUND_COUNT_OPTIONS = [5, 10, 15, 20] as const
export const ROUND_DURATION_OPTIONS = [15, 20, 30] as const
export const MAX_ATTEMPTS = 5

export type RoundCount = (typeof ROUND_COUNT_OPTIONS)[number]
export type RoundDuration = (typeof ROUND_DURATION_OPTIONS)[number]

export type GuessOption = Pick<Track, 'id' | 'title' | 'artist'>

export function isRoundCount(value: unknown): value is RoundCount {
  return typeof value === 'number' && (ROUND_COUNT_OPTIONS as readonly number[]).includes(value)
}

export function isRoundDuration(value: unknown): value is RoundDuration {
  return typeof value === 'number'
    && (ROUND_DURATION_OPTIONS as readonly number[]).includes(value)
}

export function formatGuessOption(track: GuessOption): string {
  return `${track.title} — ${track.artist}`
}

function normalizeGuess(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function findGuessOption(options: GuessOption[], value: string): GuessOption | null {
  const normalized = normalizeGuess(value)
  return options.find((option) => normalizeGuess(formatGuessOption(option)) === normalized) ?? null
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

export function getAnswerTracks(allTracks: Track[], correctTrack: Track): Track[] {
  const incorrectCandidates = shuffleTracks(
    allTracks.filter((track) => track.id !== correctTrack.id),
  )
  const usedIds = new Set([correctTrack.id])
  const usedTitles = new Set([correctTrack.title.trim().toLowerCase()])
  const incorrectTracks: Track[] = []

  for (const track of incorrectCandidates) {
    const normalizedTitle = track.title.trim().toLowerCase()

    if (usedIds.has(track.id) || usedTitles.has(normalizedTitle)) {
      continue
    }

    usedIds.add(track.id)
    usedTitles.add(normalizedTitle)
    incorrectTracks.push(track)

    if (incorrectTracks.length === 3) {
      break
    }
  }

  if (incorrectTracks.length < 3) {
    throw new Error('Pas assez de morceaux pour créer les réponses')
  }

  return shuffleTracks([correctTrack, ...incorrectTracks])
}

export function shuffleTracks(tracksToShuffle: Track[]): Track[] {
  const shuffled = [...tracksToShuffle]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentTrack = shuffled[index]
    const randomTrack = shuffled[randomIndex]
    if (!currentTrack || !randomTrack) {
      continue
    }
    shuffled[index] = randomTrack
    shuffled[randomIndex] = currentTrack
  }

  return shuffled
}

export function getRoundScore(
  remainingTime: number,
  roundDurationMs: number,
  maxRoundScore: number,
): number {
  if (roundDurationMs <= 0 || maxRoundScore <= 0 || !Number.isFinite(remainingTime)) {
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
