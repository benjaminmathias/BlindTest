import { isMusicTheme, type MusicTheme } from '../api'
import {
  isRoundCount,
  isRoundDuration,
  type GuessOption,
  type RoundCount,
  type RoundDuration,
} from '../game'
import { isArrayOf, isFiniteNumber, isInt, isRecord, isString } from '../shared/validate'

export type HostSettings = {
  musicTheme: MusicTheme
  roundCount: RoundCount
  roundDuration: RoundDuration
}

export type Player = {
  playerId: string
  name: string
  isHost: boolean
  musicTheme?: MusicTheme
  roundCount?: RoundCount
  roundDuration?: RoundDuration
  gameStarted?: boolean
}

export type GameCatalog = {
  gameId: string
  options: GuessOption[]
}

export type MultiplayerRound = {
  gameId: string
  roundId: string
  round: number
  startAt: number
  audioUrl: string
}

export type RoundReveal = {
  roundId: string
  correctTrackId: string
  title: string
  artist: string
  imageUrl: string
}

export type PlayerGuess = {
  roundId: string
  guessId: string
  playerId: string
  answerId: string
}

export type AttemptResult = {
  roundId: string
  guessId: string
  playerId: string
  isCorrect: boolean
  attemptsUsed: number
  attemptsRemaining: number
  finished: boolean
  addedScore: number
  totalScore: number
}

export type ScoreUpdate = Pick<AttemptResult, 'roundId' | 'playerId' | 'totalScore'>

export type RoundComplete = {
  roundId: string
  round: number
}

export type FinalScore = {
  playerId: string
  name: string
  score: number
}

export type GameOver = {
  gameId: string
  scores: FinalScore[]
}

export type GameStart = {
  gameId: string
  startedBy: string
  musicTheme: MusicTheme
  roundCount: RoundCount
  roundDuration: RoundDuration
  catalog: GuessOption[]
}

export type ClockSyncResult = {
  offsetMs: number
  rttMs: number
}

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

export type ClockPing = {
  pingId: string
  playerId: string
}

export type ClockPong = ClockPing & {
  hostNow: number
}

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

const optional = <T>(value: unknown, check: (input: unknown) => input is T): boolean =>
  value === undefined || check(value)

export function isPlayer(value: unknown): value is Player {
  return isRecord(value)
    && isString(value.playerId)
    && isString(value.name)
    && typeof value.isHost === 'boolean'
    && optional(value.musicTheme, isMusicTheme)
    && optional(value.roundCount, isRoundCount)
    && optional(value.roundDuration, isRoundDuration)
    && optional(value.gameStarted, (input): input is boolean => typeof input === 'boolean')
}

export function getRoomAdmissionError(players: Player[], isHost: boolean): string | null {
  const hosts = players.filter((player) => player.isHost)

  if (isHost && hosts.length > 0) return 'Ce code de partie est déjà utilisé.'
  if (!isHost && hosts.length === 0) return 'Partie introuvable.'
  if (!isHost && hosts.some((host) => host.gameStarted === true)) {
    return 'Cette partie a déjà commencé.'
  }

  return null
}

const isGuessOption = (value: unknown): value is GuessOption =>
  isRecord(value) && isString(value.id) && isString(value.title) && isString(value.artist)

const isGuessOptionList = (value: unknown): value is GuessOption[] =>
  isArrayOf(value, isGuessOption) && value.length > 0

export const isGameStart = (value: unknown): value is GameStart =>
  isRecord(value)
  && isString(value.gameId)
  && isString(value.startedBy)
  && isMusicTheme(value.musicTheme)
  && isRoundCount(value.roundCount)
  && isRoundDuration(value.roundDuration)
  && isGuessOptionList(value.catalog)

export const isGameCatalog = (value: unknown): value is GameCatalog =>
  isRecord(value) && isString(value.gameId) && isGuessOptionList(value.options)

export const isMultiplayerRound = (value: unknown): value is MultiplayerRound =>
  isRecord(value)
  && isString(value.gameId)
  && isString(value.roundId)
  && !('correctTrackId' in value)
  && !('title' in value)
  && !('artist' in value)
  && !('imageUrl' in value)
  && isInt(value.round, 1)
  && isFiniteNumber(value.startAt)
  && isString(value.audioUrl)

export const isPlayerGuess = (value: unknown): value is PlayerGuess =>
  isRecord(value)
  && isString(value.roundId)
  && isString(value.guessId)
  && isString(value.playerId)
  && isString(value.answerId)

export const isAttemptResult = (value: unknown): value is AttemptResult =>
  isRecord(value)
  && isString(value.roundId)
  && isString(value.guessId)
  && isString(value.playerId)
  && typeof value.isCorrect === 'boolean'
  && isInt(value.attemptsUsed, 1)
  && isInt(value.attemptsRemaining)
  && typeof value.finished === 'boolean'
  && isFiniteNumber(value.addedScore)
  && value.addedScore >= 0
  && isFiniteNumber(value.totalScore)
  && value.totalScore >= 0

export const isScoreUpdate = (value: unknown): value is ScoreUpdate =>
  isRecord(value)
  && isString(value.roundId)
  && isString(value.playerId)
  && isFiniteNumber(value.totalScore)
  && value.totalScore >= 0

export const isRoundComplete = (value: unknown): value is RoundComplete =>
  isRecord(value) && isString(value.roundId) && isInt(value.round, 1)

export const isRoundReveal = (value: unknown): value is RoundReveal =>
  isRecord(value)
  && isString(value.roundId)
  && isString(value.correctTrackId)
  && isString(value.title)
  && isString(value.artist)
  && typeof value.imageUrl === 'string'

const isFinalScore = (value: unknown): value is FinalScore =>
  isRecord(value)
  && isString(value.playerId)
  && isString(value.name)
  && isFiniteNumber(value.score)
  && value.score >= 0

export const isGameOver = (value: unknown): value is GameOver =>
  isRecord(value) && isString(value.gameId) && isArrayOf(value.scores, isFinalScore)

export const isClockPing = (value: unknown): value is ClockPing =>
  isRecord(value) && isString(value.pingId) && isString(value.playerId)

export const isClockPong = (value: unknown): value is ClockPong =>
  isClockPing(value) && 'hostNow' in value && isFiniteNumber(value.hostNow)
