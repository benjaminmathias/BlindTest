import { isMusicTheme, type MusicTheme } from '../api'
import {
  isRoundCount,
  isRoundDuration,
  type GuessOption,
  type RoundCount,
  type RoundDuration,
} from '../game'
import {
  isArrayOf,
  isBoolean,
  isFiniteNumber,
  isInt,
  isNonNegative,
  isRecord,
  isShape,
  isString,
  isText,
  optional,
} from '../shared/validate'

export type HostSettings = {
  musicTheme: MusicTheme; roundCount: RoundCount; roundDuration: RoundDuration
}

export type Player = {
  playerId: string; name: string; isHost: boolean
  musicTheme?: MusicTheme; roundCount?: RoundCount; roundDuration?: RoundDuration
  gameStarted?: boolean
}

export type GameCatalog = { gameId: string; options: GuessOption[] }

export type MultiplayerRound = {
  gameId: string; roundId: string; round: number; startAt: number; audioUrl: string
}

export type RoundReveal = {
  roundId: string; correctTrackId: string; title: string; artist: string; imageUrl: string
}

export type PlayerGuess = {
  roundId: string; guessId: string; playerId: string; answerId: string
}

export type AttemptResult = {
  roundId: string; guessId: string; playerId: string; isCorrect: boolean
  attemptsUsed: number; attemptsRemaining: number; finished: boolean
  addedScore: number; totalScore: number
}

export type ScoreUpdate = Pick<AttemptResult, 'roundId' | 'playerId' | 'totalScore'>
export type RoundComplete = { roundId: string; round: number }
export type FinalScore = { playerId: string; name: string; score: number }
export type GameOver = { gameId: string; scores: FinalScore[] }
export type GameStart = HostSettings & { gameId: string; startedBy: string; catalog: GuessOption[] }
export type ClockSyncResult = { offsetMs: number; rttMs: number }

export type RoomConnection = {
  startGame: (gameId: string, settings: HostSettings, catalog: GuessOption[]) => Promise<void>
  updateGameSettings: (settings: HostSettings) => Promise<void>
  sendCatalog: (catalog: GameCatalog) => Promise<void>
  sendRound: (round: MultiplayerRound) => Promise<void>
  sendGuess: (guess: Omit<PlayerGuess, 'playerId'>) => Promise<void>
  sendAttemptResult: (result: AttemptResult) => Promise<void>
  sendScoreUpdate: (update: ScoreUpdate) => Promise<void>
  sendRoundReveal: (reveal: RoundReveal) => Promise<void>
  sendRoundComplete: (result: RoundComplete) => Promise<void>
  sendGameOver: (gameOver: GameOver) => Promise<void>
  syncClock: () => Promise<ClockSyncResult>
  leave: () => Promise<void>
}

export type ClockPing = { pingId: string; playerId: string }
export type ClockPong = ClockPing & { hostNow: number }

export type RoomHandlers = {
  onPlayers: (players: Player[]) => void
  onGameStart: (gameStart: GameStart) => void
  onGameCatalog: (catalog: GameCatalog) => void
  onRoundStart: (round: MultiplayerRound) => void
  onPlayerGuess: (guess: PlayerGuess) => void
  onAttemptResult: (result: AttemptResult) => void
  onScoreUpdate: (update: ScoreUpdate) => void
  onRoundReveal: (reveal: RoundReveal) => void
  onRoundComplete: (result: RoundComplete) => void
  onGameOver: (gameOver: GameOver) => void
}

export const isPlayer = isShape<Player>({
  playerId: isString, name: isString, isHost: isBoolean,
  musicTheme: (value) => optional(value, isMusicTheme),
  roundCount: (value) => optional(value, isRoundCount),
  roundDuration: (value) => optional(value, isRoundDuration),
  gameStarted: (value) => optional(value, isBoolean),
})

export function getRoomAdmissionError(players: Player[], isHost: boolean): string | null {
  const hosts = players.filter((player) => player.isHost)

  if (isHost && hosts.length > 0) return 'Ce code de partie est déjà utilisé.'
  if (!isHost && hosts.length === 0) return 'Partie introuvable.'
  if (!isHost && hosts.some((host) => host.gameStarted === true)) {
    return 'Cette partie a déjà commencé.'
  }

  return null
}

const isGuessOption = isShape<GuessOption>({ id: isString, title: isString, artist: isString })

const isGuessOptionList = (value: unknown): value is GuessOption[] =>
  isArrayOf(value, isGuessOption) && value.length > 0

export const isGameStart = isShape<GameStart>({
  gameId: isString, startedBy: isString, musicTheme: isMusicTheme,
  roundCount: isRoundCount, roundDuration: isRoundDuration, catalog: isGuessOptionList,
})

export const isGameCatalog = isShape<GameCatalog>({
  gameId: isString, options: isGuessOptionList,
})

// round_start ne doit jamais transporter la solution.
const hidesSolution = (value: unknown): boolean =>
  isRecord(value) && !('correctTrackId' in value) && !('title' in value)
  && !('artist' in value) && !('imageUrl' in value)

const isRoundShape = isShape<MultiplayerRound>({
  gameId: isString, roundId: isString, round: (value) => isInt(value, 1),
  startAt: isFiniteNumber, audioUrl: isString,
})

export const isMultiplayerRound = (value: unknown): value is MultiplayerRound =>
  hidesSolution(value) && isRoundShape(value)

export const isPlayerGuess = isShape<PlayerGuess>({
  roundId: isString, guessId: isString, playerId: isString, answerId: isString,
})

export const isAttemptResult = isShape<AttemptResult>({
  roundId: isString, guessId: isString, playerId: isString, isCorrect: isBoolean,
  attemptsUsed: (value) => isInt(value, 1), attemptsRemaining: (value) => isInt(value),
  finished: isBoolean, addedScore: isNonNegative, totalScore: isNonNegative,
})

export const isScoreUpdate = isShape<ScoreUpdate>({
  roundId: isString, playerId: isString, totalScore: isNonNegative,
})

export const isRoundComplete = isShape<RoundComplete>({
  roundId: isString, round: (value) => isInt(value, 1),
})

export const isRoundReveal = isShape<RoundReveal>({
  roundId: isString, correctTrackId: isString, title: isString,
  artist: isString, imageUrl: isText,
})

const isFinalScore = isShape<FinalScore>({
  playerId: isString, name: isString, score: isNonNegative,
})

export const isGameOver = isShape<GameOver>({
  gameId: isString, scores: (value) => isArrayOf(value, isFinalScore),
})

export const isClockPing = isShape<ClockPing>({ pingId: isString, playerId: isString })

export const isClockPong = (value: unknown): value is ClockPong =>
  isClockPing(value) && 'hostNow' in value && isFiniteNumber(value.hostNow)
