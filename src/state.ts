import type { MusicTheme, Track } from './api'
import type { GuessOption, RoundCount, RoundDuration, RoundOutcome } from './game'
import type { GuessArea } from './guess/area'
import type { RoundRecapEntry } from './guess/recap'
import type {
  AttemptResult, MultiplayerRound, RoomConnection, RoundReveal,
} from './multiplayer/protocol'
import type { RoundTimer } from './round/timer'
import {
  DEFAULT_MUSIC_THEME,
  DEFAULT_ROUND_COUNT,
  DEFAULT_ROUND_DURATION,
} from './shared/storage'

export type AppState = {
  // Préférences de jeu
  selectedTheme: MusicTheme
  selectedRoundCount: RoundCount
  selectedRoundDuration: RoundDuration

  // Connexion et roster
  multiplayerTracks: Track[]
  roomConnection: RoomConnection | null
  multiplayerPlayerId: string | null
  multiplayerIsHost: boolean
  multiplayerHostId: string | null
  multiplayerHostSeen: boolean
  multiplayerHostLeft: boolean
  multiplayerGameOver: boolean
  multiplayerPlayerNames: Map<string, string>
  multiplayerLeaveInProgress: boolean

  // Manche en cours
  multiplayerAudio: HTMLAudioElement | null
  multiplayerTimer: RoundTimer | null
  multiplayerTransitionId: number | null
  currentMultiplayerGameId: string | null
  currentMultiplayerRound: MultiplayerRound | null
  currentHostTrack: Track | null
  currentRoundReveal: RoundReveal | null
  multiplayerLastRoundId: string | null
  multiplayerGuessArea: GuessArea | null
  multiplayerCatalog: GuessOption[]
  multiplayerRoundPlayerIds: Set<string>
  multiplayerRoundFinished: boolean
  multiplayerOwnRoundHistory: (RoundOutcome | undefined)[]
  multiplayerOwnRoundRecap: (RoundRecapEntry | undefined)[]
  multiplayerPlayedTrackIds: Set<string>

  // Réponses et scores
  ownAnswerResult: AttemptResult | null
  finishedPlayerIds: Set<string>
  multiplayerAttempts: Map<string, number>
  multiplayerTriedAnswerKeys: Map<string, Set<string>>
  multiplayerScores: Map<string, number>
  multiplayerCurrentRoundNumber: number
  multiplayerLastOwnGuess: GuessOption | null
  multiplayerLastOwnElapsedMs: number
  multiplayerAttemptResultHandler: ((result: AttemptResult) => void) | null

  // Horloge synchronisée
  multiplayerClockOffsetMs: number
  multiplayerClockSyncPromise: Promise<void> | null
  multiplayerClockSynced: boolean
  multiplayerLastClockSyncRound: number

  // Réglages de la partie en cours
  multiplayerMusicTheme: MusicTheme
  currentGameMusicTheme: MusicTheme
  multiplayerRoundCount: RoundCount
  currentGameRoundCount: RoundCount
  multiplayerRoundDuration: RoundDuration
  currentGameRoundDuration: RoundDuration
}

export const state: AppState = {
  selectedTheme: DEFAULT_MUSIC_THEME,
  selectedRoundCount: DEFAULT_ROUND_COUNT,
  selectedRoundDuration: DEFAULT_ROUND_DURATION,

  multiplayerTracks: [],
  roomConnection: null,
  multiplayerPlayerId: null,
  multiplayerIsHost: false,
  multiplayerHostId: null,
  multiplayerHostSeen: false,
  multiplayerHostLeft: false,
  multiplayerGameOver: false,
  multiplayerPlayerNames: new Map(),
  multiplayerLeaveInProgress: false,

  multiplayerAudio: null,
  multiplayerTimer: null,
  multiplayerTransitionId: null,
  currentMultiplayerGameId: null,
  currentMultiplayerRound: null,
  currentHostTrack: null,
  currentRoundReveal: null,
  multiplayerLastRoundId: null,
  multiplayerGuessArea: null,
  multiplayerCatalog: [],
  multiplayerRoundPlayerIds: new Set(),
  multiplayerRoundFinished: false,
  multiplayerOwnRoundHistory: [],
  multiplayerOwnRoundRecap: [],
  multiplayerPlayedTrackIds: new Set(),

  ownAnswerResult: null,
  finishedPlayerIds: new Set(),
  multiplayerAttempts: new Map(),
  multiplayerTriedAnswerKeys: new Map(),
  multiplayerScores: new Map(),
  multiplayerCurrentRoundNumber: 0,
  multiplayerLastOwnGuess: null,
  multiplayerLastOwnElapsedMs: 0,
  multiplayerAttemptResultHandler: null,

  multiplayerClockOffsetMs: 0,
  multiplayerClockSyncPromise: null,
  multiplayerClockSynced: false,
  multiplayerLastClockSyncRound: 0,

  multiplayerMusicTheme: DEFAULT_MUSIC_THEME,
  currentGameMusicTheme: DEFAULT_MUSIC_THEME,
  multiplayerRoundCount: DEFAULT_ROUND_COUNT,
  currentGameRoundCount: DEFAULT_ROUND_COUNT,
  multiplayerRoundDuration: DEFAULT_ROUND_DURATION,
  currentGameRoundDuration: DEFAULT_ROUND_DURATION,
}
