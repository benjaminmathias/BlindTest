import type { MusicMarket, MusicTheme, Track } from './api'
import type { GuessOption, RoundCount, RoundDuration, RoundOutcome } from './game'
import type { GuessArea, RoundRecapEntry } from './guess-ui'
import type {
  AttemptResult,
  MultiplayerRound,
  RoomConnection,
  RoundReveal,
} from './multiplayer/realtime'
import {
  DEFAULT_MUSIC_MARKET,
  DEFAULT_MUSIC_THEME,
  DEFAULT_ROUND_COUNT,
  DEFAULT_ROUND_DURATION,
} from './shared/storage'

export type AppState = {
  selectedTheme: MusicTheme
  selectedMarket: MusicMarket
  selectedRoundCount: RoundCount
  selectedRoundDuration: RoundDuration

  multiplayerTracks: Track[]
  roomConnection: RoomConnection | null
  multiplayerAudio: HTMLAudioElement | null
  multiplayerTimerId: number | null
  multiplayerStartTimeoutId: number | null
  multiplayerPlayerId: string | null
  multiplayerIsHost: boolean
  currentMultiplayerGameId: string | null
  currentMultiplayerRound: MultiplayerRound | null
  currentHostTrack: Track | null
  currentRoundReveal: RoundReveal | null
  ownAnswerResult: AttemptResult | null
  finishedPlayerIds: Set<string>
  multiplayerAttempts: Map<string, number>
  multiplayerTriedAnswerIds: Map<string, Set<string>>
  multiplayerCatalog: GuessOption[]
  multiplayerScores: Map<string, number>
  multiplayerPlayerNames: Map<string, string>
  multiplayerCurrentRoundNumber: number
  multiplayerOwnRoundHistory: (RoundOutcome | undefined)[]
  multiplayerOwnRoundRecap: (RoundRecapEntry | undefined)[]
  multiplayerLastOwnGuess: GuessOption | null
  multiplayerGuessArea: GuessArea | null
  multiplayerPlayedTrackIds: Set<string>
  multiplayerRoundPlayerIds: Set<string>
  multiplayerRoundFinished: boolean
  multiplayerTransitionId: number | null
  multiplayerClockOffsetMs: number
  multiplayerClockSyncPromise: Promise<void> | null
  multiplayerClockSynced: boolean
  multiplayerLastClockSyncRound: number
  multiplayerHostSeen: boolean
  multiplayerHostId: string | null
  multiplayerHostLeft: boolean
  multiplayerGameOver: boolean
  multiplayerLastRoundId: string | null
  multiplayerLeaveInProgress: boolean
  multiplayerAttemptResultHandler: ((result: AttemptResult) => void) | null
  multiplayerMusicTheme: MusicTheme
  currentGameMusicTheme: MusicTheme
  multiplayerMusicMarket: MusicMarket
  currentGameMusicMarket: MusicMarket
  multiplayerRoundCount: RoundCount
  currentGameRoundCount: RoundCount
  multiplayerRoundDuration: RoundDuration
  currentGameRoundDuration: RoundDuration
}

export const state: AppState = {
  selectedTheme: DEFAULT_MUSIC_THEME,
  selectedMarket: DEFAULT_MUSIC_MARKET,
  selectedRoundCount: DEFAULT_ROUND_COUNT,
  selectedRoundDuration: DEFAULT_ROUND_DURATION,

  multiplayerTracks: [],
  roomConnection: null,
  multiplayerAudio: null,
  multiplayerTimerId: null,
  multiplayerStartTimeoutId: null,
  multiplayerPlayerId: null,
  multiplayerIsHost: false,
  currentMultiplayerGameId: null,
  currentMultiplayerRound: null,
  currentHostTrack: null,
  currentRoundReveal: null,
  ownAnswerResult: null,
  finishedPlayerIds: new Set(),
  multiplayerAttempts: new Map(),
  multiplayerTriedAnswerIds: new Map(),
  multiplayerCatalog: [],
  multiplayerScores: new Map(),
  multiplayerPlayerNames: new Map(),
  multiplayerCurrentRoundNumber: 0,
  multiplayerOwnRoundHistory: [],
  multiplayerOwnRoundRecap: [],
  multiplayerLastOwnGuess: null,
  multiplayerGuessArea: null,
  multiplayerPlayedTrackIds: new Set(),
  multiplayerRoundPlayerIds: new Set(),
  multiplayerRoundFinished: false,
  multiplayerTransitionId: null,
  multiplayerClockOffsetMs: 0,
  multiplayerClockSyncPromise: null,
  multiplayerClockSynced: false,
  multiplayerLastClockSyncRound: 0,
  multiplayerHostSeen: false,
  multiplayerHostId: null,
  multiplayerHostLeft: false,
  multiplayerGameOver: false,
  multiplayerLastRoundId: null,
  multiplayerLeaveInProgress: false,
  multiplayerAttemptResultHandler: null,
  multiplayerMusicTheme: DEFAULT_MUSIC_THEME,
  currentGameMusicTheme: DEFAULT_MUSIC_THEME,
  multiplayerMusicMarket: DEFAULT_MUSIC_MARKET,
  currentGameMusicMarket: DEFAULT_MUSIC_MARKET,
  multiplayerRoundCount: DEFAULT_ROUND_COUNT,
  currentGameRoundCount: DEFAULT_ROUND_COUNT,
  multiplayerRoundDuration: DEFAULT_ROUND_DURATION,
  currentGameRoundDuration: DEFAULT_ROUND_DURATION,
}
