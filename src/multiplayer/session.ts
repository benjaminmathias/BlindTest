import { fetchTracks, isMusicTheme } from '../api'
import { qs, setDisabled, setText } from '../dom'
import { isRoundCount, isRoundDuration, pickUnplayedTrack, type RoundOutcome } from '../game'
import { renderHome } from '../screens/home'
import { renderLobby } from '../screens/lobby'
import { revealArtwork } from '../shared/artwork'
import { createId } from '../shared/id'
import { renderRoundResult } from '../shared/round-result'
import { DEFAULT_MUSIC_THEME, DEFAULT_ROUND_COUNT, DEFAULT_ROUND_DURATION } from '../shared/storage'
import { state } from '../state'
import { isActiveConnection, synchronizeMultiplayerClock } from './clock'
import { scorePlayerGuess } from './game'
import { renderMultiplayerRound } from './game-screen'
import { renderMultiplayerLeaderboard } from './leaderboard'
import { renderLobbyPlayers } from './lobby-view'
import {
  type AttemptResult, type GameCatalog, type GameOver, type GameStart, type MultiplayerRound,
  type Player, type PlayerGuess, type RoomConnection, type RoundComplete, type RoundReveal,
  type ScoreUpdate,
} from './protocol'
import { handleGameOver, handleMultiplayerHostLeft } from './result-screens'
import { joinRoom } from './transport'

export const MAX_ROUND_SCORE = 1000

const MULTIPLAYER_START_DELAY_MS = 3000
const MULTIPLAYER_ROUND_TRANSITION_MS = 4000

const ADMISSION_ERRORS = new Set([
  'Partie introuvable.',
  'Cette partie a déjà commencé.',
  'Ce code de partie est déjà utilisé.',
])

function toFriendlyRoomError(error: unknown): string {
  if (error instanceof Error) {
    if (ADMISSION_ERRORS.has(error.message)) return error.message
    if (/délai/i.test(error.message)) return 'La connexion a pris trop de temps. Réessaie.'
    if (/supabase|presence|canal privé/i.test(error.message)) {
      return 'Multijoueur indisponible pour le moment.'
    }
  }
  return 'Impossible de rejoindre cette partie.'
}

export function stopMultiplayerAudio(): void {
  if (!state.multiplayerAudio) return
  state.multiplayerAudio.pause()
  state.multiplayerAudio.currentTime = 0
  state.multiplayerAudio = null
}

export function stopMultiplayerTimer(): void {
  state.multiplayerTimer?.stop()
  state.multiplayerTimer = null
}

export function stopMultiplayerTransition(): void {
  if (state.multiplayerTransitionId === null) return
  window.clearTimeout(state.multiplayerTransitionId)
  state.multiplayerTransitionId = null
}

export function cleanupMultiplayerRound(): void {
  stopMultiplayerTimer()
  stopMultiplayerAudio()
  state.multiplayerGuessArea?.destroy()
  state.multiplayerGuessArea = null
  state.multiplayerAttemptResultHandler = null
}

export function resetMultiplayerGameState(): void {
  cleanupMultiplayerRound()
  stopMultiplayerTransition()
  state.currentMultiplayerRound = null; state.currentHostTrack = null
  state.currentRoundReveal = null; state.ownAnswerResult = null
  state.finishedPlayerIds = new Set(); state.multiplayerAttempts = new Map()
  state.multiplayerTriedAnswerKeys = new Map(); state.multiplayerCatalog = []
  state.multiplayerScores = new Map(); state.multiplayerCurrentRoundNumber = 0
  state.multiplayerOwnRoundHistory = []; state.multiplayerOwnRoundRecap = []
  state.multiplayerLastOwnGuess = null; state.multiplayerPlayedTrackIds = new Set()
  state.multiplayerRoundPlayerIds = new Set(); state.multiplayerRoundFinished = false
  state.multiplayerGameOver = false; state.multiplayerLastRoundId = null
  state.multiplayerClockSynced = false; state.multiplayerLastClockSyncRound = 0
}

function resetMultiplayerSessionState(): void {
  state.multiplayerPlayerNames = new Map(); state.multiplayerClockOffsetMs = 0
  state.multiplayerClockSyncPromise = null; state.multiplayerHostSeen = false
  state.multiplayerHostId = null; state.multiplayerHostLeft = false
  state.currentMultiplayerGameId = null; state.multiplayerTracks = []
  state.multiplayerMusicTheme = DEFAULT_MUSIC_THEME
  state.currentGameMusicTheme = DEFAULT_MUSIC_THEME
  state.multiplayerRoundCount = DEFAULT_ROUND_COUNT
  state.currentGameRoundCount = DEFAULT_ROUND_COUNT
  state.multiplayerRoundDuration = DEFAULT_ROUND_DURATION
  state.currentGameRoundDuration = DEFAULT_ROUND_DURATION
}

function isStaleRound(round: MultiplayerRound): boolean {
  const current = state.currentMultiplayerRound

  return state.multiplayerHostLeft
    || state.multiplayerGameOver
    || round.gameId !== state.currentMultiplayerGameId
    || round.round < 1
    || round.round > state.currentGameRoundCount
    || round.roundId === state.multiplayerLastRoundId
    || (current ? round.round <= current.round : round.round < state.multiplayerCurrentRoundNumber)
}

function applyPlayers(players: Player[]): void {
  const hostPlayer = players.find((player) => player.isHost)

  if (hostPlayer) {
    state.multiplayerHostSeen = true
    state.multiplayerHostId = hostPlayer.playerId
  } else if (!state.multiplayerIsHost && state.multiplayerHostSeen && !state.multiplayerHostLeft) {
    handleMultiplayerHostLeft()
    return
  }

  if (!state.multiplayerIsHost && hostPlayer) {
    if (hostPlayer.musicTheme) state.multiplayerMusicTheme = hostPlayer.musicTheme
    if (hostPlayer.roundCount) state.multiplayerRoundCount = hostPlayer.roundCount
    if (hostPlayer.roundDuration) state.multiplayerRoundDuration = hostPlayer.roundDuration
  }

  state.multiplayerPlayerNames = new Map(players.map((player) => [player.playerId, player.name]))

  for (const player of players) {
    if (!state.multiplayerScores.has(player.playerId)) state.multiplayerScores.set(player.playerId, 0)
  }

  if (state.currentMultiplayerRound && !state.multiplayerRoundFinished) {
    for (const playerId of state.multiplayerRoundPlayerIds) {
      if (!state.multiplayerPlayerNames.has(playerId)) state.multiplayerRoundPlayerIds.delete(playerId)
    }
    checkMultiplayerRoundCompletion()
  }
}

function showGameStarting(): void {
  const status = qs<HTMLParagraphElement>('#lobby-status')
    ?? qs<HTMLParagraphElement>('#multiplayer-status')

  if (status) status.textContent = 'La partie va commencer…'
  setDisabled('#start-game-button', true)

  if (state.roomConnection && !state.multiplayerIsHost) {
    synchronizeMultiplayerClock(state.roomConnection, true)
  }
}

function handleGameStart(gameStart: GameStart): void {
  if (state.multiplayerHostLeft
    || !gameStart?.gameId
    || !gameStart.startedBy
    || gameStart.startedBy !== state.multiplayerHostId
    || gameStart.gameId === state.currentMultiplayerGameId) {
    return
  }

  state.currentGameMusicTheme = isMusicTheme(gameStart.musicTheme)
    ? gameStart.musicTheme : DEFAULT_MUSIC_THEME
  state.currentGameRoundCount = isRoundCount(gameStart.roundCount)
    ? gameStart.roundCount : DEFAULT_ROUND_COUNT
  state.currentGameRoundDuration = isRoundDuration(gameStart.roundDuration)
    ? gameStart.roundDuration : DEFAULT_ROUND_DURATION
  state.currentMultiplayerGameId = gameStart.gameId
  resetMultiplayerGameState()
  state.multiplayerCatalog = gameStart.catalog
  showGameStarting()
}

function handleGameCatalog(catalog: GameCatalog): void {
  if (catalog.gameId !== state.currentMultiplayerGameId) return
  state.multiplayerCatalog = catalog.options
  state.multiplayerGuessArea?.setCatalog(catalog.options)
}

export async function startMultiplayerGame(): Promise<void> {
  const connection = state.roomConnection

  if (!connection || !state.multiplayerIsHost) {
    throw new Error('Seul l’hôte peut commencer la partie')
  }

  state.currentMultiplayerGameId = createId()
  state.currentGameMusicTheme = state.multiplayerMusicTheme
  state.currentGameRoundCount = state.multiplayerRoundCount
  state.currentGameRoundDuration = state.multiplayerRoundDuration
  resetMultiplayerGameState()
  showGameStarting()

  state.multiplayerTracks = await fetchTracks(state.currentGameMusicTheme)
  state.multiplayerCatalog = state.multiplayerTracks.map(({ id, title, artist }) => ({
    id, title, artist,
  }))

  await connection.startGame(state.currentMultiplayerGameId, {
    musicTheme: state.currentGameMusicTheme,
    roundCount: state.currentGameRoundCount,
    roundDuration: state.currentGameRoundDuration,
  }, state.multiplayerCatalog)
  await connection.sendCatalog({
    gameId: state.currentMultiplayerGameId, options: state.multiplayerCatalog,
  })

  state.multiplayerCurrentRoundNumber = 1
  state.multiplayerScores = new Map(
    [...state.multiplayerPlayerNames.keys()].map((playerId) => [playerId, 0]),
  )
  await sendNextMultiplayerRound(connection)
}

async function sendNextMultiplayerRound(connection: RoomConnection): Promise<void> {
  if (!state.multiplayerIsHost || !state.currentMultiplayerGameId) return

  cleanupMultiplayerRound()
  state.currentMultiplayerRound = null
  state.currentHostTrack = null
  state.finishedPlayerIds = new Set()
  state.multiplayerAttempts = new Map()
  state.multiplayerTriedAnswerKeys = new Map()

  const correctTrack = pickUnplayedTrack(state.multiplayerTracks, state.multiplayerPlayedTrackIds)
  const round: MultiplayerRound = {
    gameId: state.currentMultiplayerGameId,
    roundId: createId(),
    round: state.multiplayerCurrentRoundNumber,
    startAt: Date.now() + MULTIPLAYER_START_DELAY_MS,
    audioUrl: correctTrack.audioUrl,
  }

  state.currentHostTrack = correctTrack
  state.multiplayerRoundPlayerIds = new Set(state.multiplayerPlayerNames.keys())
  state.multiplayerRoundFinished = false
  await connection.sendRound(round)
}

function finalScores(): GameOver['scores'] {
  return [...state.multiplayerPlayerNames.entries()]
    .map(([playerId, name]) => ({
      playerId, name, score: state.multiplayerScores.get(playerId) ?? 0,
    }))
    .sort((first, second) =>
      second.score - first.score || first.name.localeCompare(second.name))
}

async function completeMultiplayerRound(round: MultiplayerRound): Promise<void> {
  const connection = state.roomConnection
  const correctTrack = state.currentHostTrack
  if (!connection) return

  try {
    if (!correctTrack) throw new Error('Réponse de la manche introuvable')

    await connection.sendRoundReveal({
      roundId: round.roundId,
      correctTrackId: correctTrack.id,
      title: correctTrack.title,
      artist: correctTrack.artist,
      imageUrl: correctTrack.imageUrl,
    })
    await connection.sendRoundComplete({ roundId: round.roundId, round: round.round })

    if (!isActiveConnection(connection)) return

    if (round.round === state.currentGameRoundCount) {
      await connection.sendGameOver({ gameId: round.gameId, scores: finalScores() })
      return
    }

    stopMultiplayerTransition()
    state.multiplayerTransitionId = window.setTimeout(() => {
      state.multiplayerTransitionId = null
      if (!isActiveConnection(connection)) return

      state.multiplayerCurrentRoundNumber = round.round + 1
      void sendNextMultiplayerRound(connection).catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('Impossible de synchroniser la manche suivante.')
      })
    }, MULTIPLAYER_ROUND_TRANSITION_MS)
  } catch (error) {
    console.error(error)
    if (state.roomConnection === connection) void leaveMultiplayerRoom('Connexion interrompue.')
  }
}

export function checkMultiplayerRoundCompletion(): void {
  if (!state.multiplayerIsHost || !state.currentMultiplayerRound || state.multiplayerRoundFinished) {
    return
  }

  const allPlayersAnswered = [...state.multiplayerRoundPlayerIds].every((playerId) =>
    state.finishedPlayerIds.has(playerId))
  if (!allPlayersAnswered) return

  state.multiplayerRoundFinished = true
  cleanupMultiplayerRound()
  void completeMultiplayerRound(state.currentMultiplayerRound)
}

export async function leaveMultiplayerRoom(initialStatus = ''): Promise<void> {
  if (state.multiplayerLeaveInProgress) return
  state.multiplayerLeaveInProgress = true

  resetMultiplayerGameState()
  resetMultiplayerSessionState()
  state.multiplayerPlayerId = null
  state.multiplayerIsHost = false

  const connection = state.roomConnection
  state.roomConnection = null

  try {
    await connection?.leave()
  } catch (error) {
    console.error(error)
  } finally {
    state.multiplayerLeaveInProgress = false
    renderHome(initialStatus)
  }
}

function handlePlayerGuess(guess: PlayerGuess): void {
  if (state.multiplayerRoundFinished) return

  const result = scorePlayerGuess({
    isHost: state.multiplayerIsHost,
    round: state.currentMultiplayerRound,
    correctTrack: state.currentHostTrack,
    catalog: new Map(
      state.multiplayerCatalog.map(({ id, title, artist }) => [id, { title, artist }]),
    ),
    activePlayerIds: state.multiplayerRoundPlayerIds,
    finishedPlayerIds: state.finishedPlayerIds,
    attempts: state.multiplayerAttempts,
    triedAnswerKeys: state.multiplayerTriedAnswerKeys,
    scores: state.multiplayerScores,
    guess,
    now: Date.now(),
    roundDurationMs: state.currentGameRoundDuration * 1000,
    maxRoundScore: MAX_ROUND_SCORE,
  })
  if (!result) return

  renderMultiplayerLeaderboard()

  const connection = state.roomConnection
  if (!connection) {
    checkMultiplayerRoundCompletion()
    return
  }

  void (async () => {
    await connection.sendAttemptResult(result)
    if (result.addedScore > 0) await connection.sendScoreUpdate(result)
    checkMultiplayerRoundCompletion()
  })().catch((error) => {
    console.error(error)
    void leaveMultiplayerRoom('Connexion interrompue.')
  })
}

export function handleAttemptResult(result: AttemptResult): void {
  if (state.multiplayerHostLeft
    || state.multiplayerGameOver
    || !state.currentMultiplayerRound
    || result.roundId !== state.currentMultiplayerRound.roundId) {
    return
  }

  state.multiplayerScores.set(result.playerId, result.totalScore)
  renderMultiplayerLeaderboard()

  if (result.playerId !== state.multiplayerPlayerId) return

  state.ownAnswerResult = result
  setText('#multiplayer-status', result.isCorrect
    ? 'Bonne réponse ! Résultat à venir…'
    : result.finished ? 'Plus aucun essai. Résultat à venir…' : '')
  state.multiplayerAttemptResultHandler?.(result)
}

function handleScoreUpdate(update: ScoreUpdate): void {
  if (update.roundId !== state.currentMultiplayerRound?.roundId) return
  state.multiplayerScores.set(update.playerId, update.totalScore)
  renderMultiplayerLeaderboard()
}

function handleRoundReveal(reveal: RoundReveal): void {
  if (!state.currentMultiplayerRound
    || reveal.roundId !== state.currentMultiplayerRound.roundId) return

  state.currentRoundReveal = reveal
  revealArtwork(document, reveal.imageUrl, `Cover de ${reveal.title} par ${reveal.artist}`)

  const revealCard = qs<HTMLParagraphElement>('#multiplayer-reveal')
  if (revealCard) {
    renderRoundResult(
      revealCard,
      state.ownAnswerResult ? (state.ownAnswerResult.isCorrect ? 'correct' : 'wrong') : 'timeout',
      reveal.title,
      reveal.artist,
      state.ownAnswerResult?.isCorrect ? state.ownAnswerResult.addedScore : 0,
    )
  }

  setText('#multiplayer-status', '')
}

function handleRoundComplete(result: RoundComplete): void {
  if (state.multiplayerHostLeft
    || state.multiplayerGameOver
    || !state.currentMultiplayerRound
    || result.roundId !== state.currentMultiplayerRound.roundId
    || result.round !== state.currentMultiplayerRound.round) {
    return
  }

  state.multiplayerRoundFinished = true
  cleanupMultiplayerRound()

  const roundIndex = result.round - 1
  const localOutcome: RoundOutcome = state.ownAnswerResult
    ? (state.ownAnswerResult.isCorrect ? 'correct' : 'failed')
    : 'timeout'
  const solution = state.currentRoundReveal ?? state.currentHostTrack

  if (solution) {
    state.multiplayerOwnRoundHistory[roundIndex] = localOutcome
    state.multiplayerOwnRoundRecap[roundIndex] = {
      outcome: localOutcome,
      guess: state.multiplayerLastOwnGuess,
      attemptsUsed: state.ownAnswerResult?.attemptsUsed ?? 0,
      elapsedMs: state.multiplayerLastOwnElapsedMs,
      solution: { title: solution.title, artist: solution.artist },
    }
  }

  if (state.currentRoundReveal) {
    revealArtwork(
      document,
      state.currentRoundReveal.imageUrl,
      `Cover de ${state.currentRoundReveal.title} par ${state.currentRoundReveal.artist}`,
    )
  }

  qs<HTMLFormElement>('#multiplayer-guess-form')?.querySelectorAll('input, button')
    .forEach((control) => {
      (control as HTMLInputElement | HTMLButtonElement).disabled = true
    })

  const guessSubmit = qs<HTMLButtonElement>('#multiplayer-guess-form .guess-search__submit')
  if (guessSubmit) guessSubmit.hidden = true

  const playAudioButton = qs<HTMLButtonElement>('#play-audio-button')
  if (playAudioButton) {
    playAudioButton.hidden = true
    playAudioButton.disabled = true
  }
}

export async function openRoom(roomCode: string, playerName: string, isHost: boolean): Promise<void> {
  try {
    resetMultiplayerGameState()
    resetMultiplayerSessionState()
    renderLobby(roomCode, isHost)

    const playerId = createId()
    state.multiplayerPlayerId = playerId
    state.multiplayerIsHost = isHost

    state.roomConnection = await joinRoom(
      roomCode,
      playerId,
      playerName,
      isHost,
      {
        musicTheme: state.multiplayerMusicTheme,
        roundCount: state.multiplayerRoundCount,
        roundDuration: state.multiplayerRoundDuration,
      },
      {
        onPlayers: (players) => {
          applyPlayers(players)
          renderLobbyPlayers(players)
        },
        onGameStart: handleGameStart,
        onGameCatalog: handleGameCatalog,
        onRoundStart: (round) => { if (!isStaleRound(round)) renderMultiplayerRound(round) },
        onPlayerGuess: handlePlayerGuess,
        onAttemptResult: handleAttemptResult,
        onScoreUpdate: handleScoreUpdate,
        onRoundReveal: handleRoundReveal,
        onRoundComplete: handleRoundComplete,
        onGameOver: handleGameOver,
      },
    )

    setDisabled('#start-game-button', state.multiplayerPlayerNames.size < 2)
    setDisabled('#leave-room-button', false)

    if (!isHost) synchronizeMultiplayerClock(state.roomConnection)
  } catch (error) {
    console.error(error)
    resetMultiplayerGameState()
    resetMultiplayerSessionState()
    state.roomConnection = null
    state.multiplayerPlayerId = null
    state.multiplayerIsHost = false
    renderHome(toFriendlyRoomError(error))
  }
}
