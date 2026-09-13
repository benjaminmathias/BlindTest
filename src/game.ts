import type { Track } from './api'

export const ROUND_COUNT_OPTIONS = [5, 10, 15, 20] as const

export type RoundCount = (typeof ROUND_COUNT_OPTIONS)[number]

export function isRoundCount(value: unknown): value is RoundCount {
  return typeof value === 'number' && (ROUND_COUNT_OPTIONS as readonly number[]).includes(value)
}

export function getRandomTrack(availableTracks: Track[]): Track {
  if (availableTracks.length === 0) {
    throw new Error('Aucun morceau disponible')
  }

  return availableTracks[Math.floor(Math.random() * availableTracks.length)]
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
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = currentTrack
  }

  return shuffled
}

export function getRoundScore(
  remainingTime: number,
  roundDurationMs: number,
  maxRoundScore: number,
): number {
  const ratio = remainingTime / roundDurationMs
  return Math.max(1, Math.min(maxRoundScore, Math.floor(maxRoundScore * ratio)))
}
