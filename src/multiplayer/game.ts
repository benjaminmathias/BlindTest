import { getAttemptScore, MAX_ATTEMPTS } from '../game'
import { getCanonicalSongKey, isSameSong, type SongIdentity } from '../song'
import type { AttemptResult, MultiplayerRound, PlayerGuess } from './realtime'

type ScoreGuessOptions = {
  isHost: boolean
  round: MultiplayerRound | null
  correctTrack: SongIdentity | null
  catalog: ReadonlyMap<string, SongIdentity>
  activePlayerIds: Set<string>
  finishedPlayerIds: Set<string>
  attempts: Map<string, number>
  triedAnswerKeys: Map<string, Set<string>>
  scores: Map<string, number>
  guess: PlayerGuess
  now: number
  roundDurationMs: number
  maxRoundScore: number
}

export function scorePlayerGuess(options: ScoreGuessOptions): AttemptResult | null {
  const { guess, round } = options
  if (!options.isHost || !round || !options.correctTrack
    || guess.roundId !== round.roundId
    || options.now < round.startAt
    || options.finishedPlayerIds.has(guess.playerId)
    || !options.activePlayerIds.has(guess.playerId)
    || !options.catalog.has(guess.answerId)) {
    return null
  }

  const answer = options.catalog.get(guess.answerId)!
  const answerKey = getCanonicalSongKey(answer)
  const tried = options.triedAnswerKeys.get(guess.playerId) ?? new Set<string>()
  if (tried.has(answerKey)) return null

  tried.add(answerKey)
  options.triedAnswerKeys.set(guess.playerId, tried)
  const attemptsUsed = (options.attempts.get(guess.playerId) ?? 0) + 1
  options.attempts.set(guess.playerId, attemptsUsed)
  const remainingTime = Math.max(0, round.startAt + options.roundDurationMs - options.now)
  const isCorrect = remainingTime > 0 && isSameSong(answer, options.correctTrack)
  const finished = isCorrect || attemptsUsed >= MAX_ATTEMPTS || remainingTime <= 0
  if (finished) options.finishedPlayerIds.add(guess.playerId)
  const addedScore = isCorrect
    ? getAttemptScore(remainingTime, options.roundDurationMs, options.maxRoundScore, attemptsUsed)
    : 0
  const totalScore = (options.scores.get(guess.playerId) ?? 0) + addedScore
  options.scores.set(guess.playerId, totalScore)

  return {
    roundId: guess.roundId,
    guessId: guess.guessId,
    playerId: guess.playerId,
    isCorrect,
    attemptsUsed,
    attemptsRemaining: MAX_ATTEMPTS - attemptsUsed,
    finished,
    addedScore,
    totalScore,
  }
}
