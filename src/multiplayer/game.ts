import { getAttemptScore, MAX_ATTEMPTS } from '../game'
import type { AttemptResult, MultiplayerRound, PlayerGuess } from './realtime'

type ScoreGuessOptions = {
  isHost: boolean
  round: MultiplayerRound | null
  correctTrackId: string | null
  catalogIds: Set<string>
  activePlayerIds: Set<string>
  finishedPlayerIds: Set<string>
  attempts: Map<string, number>
  triedAnswerIds: Map<string, Set<string>>
  scores: Map<string, number>
  guess: PlayerGuess
  now: number
  roundDurationMs: number
  maxRoundScore: number
}

export function scorePlayerGuess(options: ScoreGuessOptions): AttemptResult | null {
  const { guess, round } = options
  const tried = options.triedAnswerIds.get(guess.playerId) ?? new Set<string>()
  if (!options.isHost || !round || !options.correctTrackId
    || guess.roundId !== round.roundId
    || options.finishedPlayerIds.has(guess.playerId)
    || !options.activePlayerIds.has(guess.playerId)
    || !options.catalogIds.has(guess.answerId)
    || tried.has(guess.answerId)) {
    return null
  }

  tried.add(guess.answerId)
  options.triedAnswerIds.set(guess.playerId, tried)
  const attemptsUsed = (options.attempts.get(guess.playerId) ?? 0) + 1
  options.attempts.set(guess.playerId, attemptsUsed)
  const remainingTime = Math.max(0, round.startAt + options.roundDurationMs - options.now)
  const isCorrect = options.now >= round.startAt && remainingTime > 0
    && guess.answerId === options.correctTrackId
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
