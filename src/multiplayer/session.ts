import { fetchTracks, isMusicMarket, isMusicTheme, MUSIC_MARKET_LABELS, MUSIC_THEME_LABELS } from '../api'
import { isRoundCount, isRoundDuration, pickUnplayedTrack, type RoundOutcome } from '../game'
import { renderHome } from '../screens/home'
import { renderLobby } from '../screens/lobby'
import { revealArtwork } from '../shared/artwork'
import { createId } from '../shared/id'
import { renderRoundResult } from '../shared/round-result'
import {
  DEFAULT_MUSIC_MARKET,
  DEFAULT_MUSIC_THEME,
  DEFAULT_ROUND_COUNT,
  DEFAULT_ROUND_DURATION,
} from '../shared/storage'
import { state } from '../state'
import { renderMultiplayerRound } from './game-screen'
import { scorePlayerGuess } from './game'
import { renderMultiplayerLeaderboard } from './leaderboard'
import {
  joinRoom,
  type AttemptResult,
  type GameCatalog,
  type GameOver,
  type GameStart,
  type MultiplayerRound,
  type Player,
  type PlayerGuess,
  type RoundComplete,
  type RoundReveal,
  type ScoreUpdate,
} from './realtime'
import { handleGameOver, handleMultiplayerHostLeft } from './result-screens'

export const MAX_ROUND_SCORE = 1000
const MULTIPLAYER_START_DELAY_MS = 3000
const MULTIPLAYER_ROUND_TRANSITION_MS = 2000
const MULTIPLAYER_CLOCK_RESYNC_ROUND_INTERVAL = 3

export function stopMultiplayerAudio(): void {
  if (state.multiplayerAudio) {
    state.multiplayerAudio.pause()
    state.multiplayerAudio.currentTime = 0
    state.multiplayerAudio = null
  }
}

export function stopMultiplayerTimer(): void {
  if (state.multiplayerTimerId !== null) {
    window.clearInterval(state.multiplayerTimerId)
    state.multiplayerTimerId = null
  }

  if (state.multiplayerStartTimeoutId !== null) {
    window.clearTimeout(state.multiplayerStartTimeoutId)
    state.multiplayerStartTimeoutId = null
  }
}

export function getEstimatedHostNow(): number {
  return Date.now() + state.multiplayerClockOffsetMs
}

export function stopMultiplayerTransition(): void {
  if (state.multiplayerTransitionId !== null) {
    window.clearTimeout(state.multiplayerTransitionId)
    state.multiplayerTransitionId = null
  }
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
  state.currentMultiplayerRound = null
  state.currentHostTrack = null
  state.currentRoundReveal = null
  state.ownAnswerResult = null
  state.finishedPlayerIds = new Set()
  state.multiplayerAttempts = new Map()
  state.multiplayerTriedAnswerIds = new Map()
  state.multiplayerCatalog = []
  state.multiplayerScores = new Map()
  state.multiplayerCurrentRoundNumber = 0
  state.multiplayerOwnRoundHistory = []
  state.multiplayerOwnRoundRecap = []
  state.multiplayerLastOwnGuess = null
  state.multiplayerPlayedTrackIds = new Set()
  state.multiplayerRoundPlayerIds = new Set()
  state.multiplayerRoundFinished = false
  state.multiplayerGameOver = false
  state.multiplayerLastRoundId = null
  state.multiplayerClockSynced = false
  state.multiplayerLastClockSyncRound = 0
}

export function synchronizeMultiplayerClock(
  connection: NonNullable<typeof state.roomConnection>,
  force = false,
): void {
  if (state.multiplayerIsHost || state.multiplayerHostLeft || state.multiplayerGameOver) {
    state.multiplayerClockOffsetMs = 0
    return
  }

  if (state.multiplayerClockSyncPromise) {
    if (force) {
      void state.multiplayerClockSyncPromise.then(() => {
        if (state.roomConnection === connection
          && !state.multiplayerHostLeft && !state.multiplayerGameOver) {
          synchronizeMultiplayerClock(connection)
        }
      })
    }

    return
  }

  const syncPromise = connection.syncClock()
    .then((result) => {
      if (state.roomConnection !== connection
        || state.multiplayerHostLeft || state.multiplayerGameOver) {
        return
      }

      if (result.rttMs > 0) {
        state.multiplayerClockOffsetMs = result.offsetMs
        state.multiplayerClockSynced = true
      }
    })
    .catch((error) => {
      console.error(error)
    })

  state.multiplayerClockSyncPromise = syncPromise
  void syncPromise.finally(() => {
    if (state.multiplayerClockSyncPromise === syncPromise) {
      state.multiplayerClockSyncPromise = null
    }
  })
}

export function maybeResynchronizeMultiplayerClock(currentRound: number): void {
  if (state.multiplayerIsHost || state.multiplayerHostLeft || state.multiplayerGameOver
    || !state.roomConnection) {
    return
  }

  if (currentRound - state.multiplayerLastClockSyncRound < MULTIPLAYER_CLOCK_RESYNC_ROUND_INTERVAL) {
    return
  }

  state.multiplayerLastClockSyncRound = currentRound
  synchronizeMultiplayerClock(state.roomConnection)
}

function handleRoundStart(round: MultiplayerRound): void {
  if (
    state.multiplayerHostLeft
    || state.multiplayerGameOver
    || round.gameId !== state.currentMultiplayerGameId
    || round.round < 1
    || round.round > state.currentGameRoundCount
  ) {
    return
  }

  if (state.currentMultiplayerRound && round.round <= state.currentMultiplayerRound.round) {
    return
  }

  if (!state.currentMultiplayerRound && round.round < state.multiplayerCurrentRoundNumber) {
    return
  }

  if (round.roundId === state.multiplayerLastRoundId) {
    return
  }

  renderMultiplayerRound(round)
}

function renderPlayers(players: Player[]): void {
  const hasHost = players.some((player) => player.isHost)

  if (hasHost) {
    state.multiplayerHostSeen = true
  } else if (!state.multiplayerIsHost && state.multiplayerHostSeen && !state.multiplayerHostLeft) {
    handleMultiplayerHostLeft()
  }

  const hostPlayer = players.find((player) => player.isHost)
  state.multiplayerHostId = hostPlayer?.playerId ?? state.multiplayerHostId

  if (!state.multiplayerIsHost && hostPlayer?.musicTheme) {
    state.multiplayerMusicTheme = hostPlayer.musicTheme
  }

  if (!state.multiplayerIsHost && hostPlayer?.musicMarket) {
    state.multiplayerMusicMarket = hostPlayer.musicMarket
  }

  if (!state.multiplayerIsHost && hostPlayer?.roundCount) {
    state.multiplayerRoundCount = hostPlayer.roundCount
  }

  if (!state.multiplayerIsHost && hostPlayer?.roundDuration) {
    state.multiplayerRoundDuration = hostPlayer.roundDuration
  }

  state.multiplayerPlayerNames = new Map(
    players.map((player) => [player.playerId, player.name]),
  )

  for (const player of players) {
    if (!state.multiplayerScores.has(player.playerId)) {
      state.multiplayerScores.set(player.playerId, 0)
    }
  }

  if (state.currentMultiplayerRound && !state.multiplayerRoundFinished) {
    for (const playerId of state.multiplayerRoundPlayerIds) {
      if (!state.multiplayerPlayerNames.has(playerId)) {
        state.multiplayerRoundPlayerIds.delete(playerId)
      }
    }

    checkMultiplayerRoundCompletion()
  }

  const playersList = document.querySelector<HTMLUListElement>('#players-list')

  if (!playersList) {
    renderMultiplayerLeaderboard()
    return
  }

  const playersCount = document.querySelector<HTMLElement>('#players-count')
  if (playersCount) {
    playersCount.textContent = `(${players.length})`
  }

  const lobbyThemeValue = document.querySelector<HTMLElement>('#lobby-theme-value')
  if (lobbyThemeValue) {
    lobbyThemeValue.textContent = MUSIC_THEME_LABELS[state.multiplayerMusicTheme]
  }

  const lobbyMarketValue = document.querySelector<HTMLElement>('#lobby-market-value')
  if (lobbyMarketValue) {
    lobbyMarketValue.textContent = MUSIC_MARKET_LABELS[state.multiplayerMusicMarket]
  }

  const lobbyRoundCountValue = document.querySelector<HTMLElement>('#lobby-round-count-value')
  if (lobbyRoundCountValue) {
    lobbyRoundCountValue.textContent = String(state.multiplayerRoundCount)
  }

  const lobbyRoundDurationValue = document.querySelector<HTMLElement>('#lobby-round-duration-value')
  if (lobbyRoundDurationValue) lobbyRoundDurationValue.textContent = `${state.multiplayerRoundDuration} s`

  const startButton = document.querySelector<HTMLButtonElement>('#start-game-button')
  if (startButton) {
    startButton.disabled = players.length < 2
  }

  const lobbyStatus = document.querySelector<HTMLParagraphElement>('#lobby-status')
  if (lobbyStatus) {
    lobbyStatus.textContent = state.multiplayerIsHost
      ? players.length < 2
        ? 'En attente d\'un autre joueur...'
        : 'Prêt à commencer.'
      : 'En attente du lancement par l\'hôte...'
  }

  const displayPlayers = [...players].sort((firstPlayer, secondPlayer) =>
    Number(secondPlayer.isHost) - Number(firstPlayer.isHost)
    || firstPlayer.name.localeCompare(secondPlayer.name),
  )

  const playerElements = displayPlayers.map((player) => {
    const playerElement = document.createElement('li')
    const nameElement = document.createElement('span')
    nameElement.textContent = player.name
    playerElement.append(nameElement)

    if (player.isHost) {
      const hostBadge = document.createElement('span')
      hostBadge.className = 'host-badge'
      hostBadge.textContent = 'Hôte'
      playerElement.append(hostBadge)
    }

    return playerElement
  })

  playersList.replaceChildren(...playerElements)
  renderMultiplayerLeaderboard()
}

function showGameStarting(): void {
  const lobbyStatus = document.querySelector<HTMLParagraphElement>('#lobby-status')
    ?? document.querySelector<HTMLParagraphElement>('#multiplayer-status')
  const startButton = document.querySelector<HTMLButtonElement>('#start-game-button')

  if (lobbyStatus) {
    lobbyStatus.textContent = 'La partie va commencer...'
  }

  if (startButton) {
    startButton.disabled = true
  }

  if (state.roomConnection && !state.multiplayerIsHost) {
    synchronizeMultiplayerClock(state.roomConnection, true)
  }
}

function handleGameStart(gameStart: GameStart): void {
  if (
    state.multiplayerHostLeft
    || !gameStart?.gameId
    || !gameStart.startedBy
    || gameStart.startedBy !== state.multiplayerHostId
    || gameStart.gameId === state.currentMultiplayerGameId
  ) {
    return
  }

  state.currentGameMusicTheme = isMusicTheme(gameStart.musicTheme)
    ? gameStart.musicTheme
    : DEFAULT_MUSIC_THEME
  state.currentGameMusicMarket = isMusicMarket(gameStart.musicMarket)
    ? gameStart.musicMarket
    : DEFAULT_MUSIC_MARKET
  state.currentGameRoundCount = isRoundCount(gameStart.roundCount)
    ? gameStart.roundCount
    : DEFAULT_ROUND_COUNT
  state.currentGameRoundDuration = isRoundDuration(gameStart.roundDuration)
    ? gameStart.roundDuration
    : DEFAULT_ROUND_DURATION
  state.currentMultiplayerGameId = gameStart.gameId
  resetMultiplayerGameState()
  showGameStarting()
}

function handleGameCatalog(catalog: GameCatalog): void {
  if (catalog.gameId === state.currentMultiplayerGameId) state.multiplayerCatalog = catalog.options
}

export async function startMultiplayerGame(): Promise<void> {
  const connection = state.roomConnection

  if (!connection || !state.multiplayerIsHost) {
    throw new Error('Seul l’hôte peut commencer la partie')
  }

  state.currentMultiplayerGameId = createId()
  state.currentGameMusicTheme = state.multiplayerMusicTheme
  state.currentGameMusicMarket = state.multiplayerMusicMarket
  state.currentGameRoundCount = state.multiplayerRoundCount
  state.currentGameRoundDuration = state.multiplayerRoundDuration
  resetMultiplayerGameState()
  showGameStarting()
  await connection.startGame(state.currentMultiplayerGameId, {
    musicTheme: state.currentGameMusicTheme,
    musicMarket: state.currentGameMusicMarket,
    roundCount: state.currentGameRoundCount,
    roundDuration: state.currentGameRoundDuration,
  })

  state.multiplayerTracks = await fetchTracks(state.currentGameMusicTheme, state.currentGameMusicMarket)
  state.multiplayerCatalog = state.multiplayerTracks.map(({ id, title, artist }) => ({ id, title, artist }))
  await connection.sendCatalog({ gameId: state.currentMultiplayerGameId, options: state.multiplayerCatalog })

  state.multiplayerCurrentRoundNumber = 1
  state.multiplayerScores = new Map(
    [...state.multiplayerPlayerNames.keys()].map((playerId) => [playerId, 0]),
  )
  await sendNextMultiplayerRound(connection)
}

async function sendNextMultiplayerRound(connection: NonNullable<typeof state.roomConnection>): Promise<void> {
  if (!state.multiplayerIsHost || state.roomConnection !== connection || !state.currentMultiplayerGameId) {
    return
  }

  cleanupMultiplayerRound()
  state.currentMultiplayerRound = null
  state.currentHostTrack = null
  state.finishedPlayerIds = new Set()
  state.multiplayerAttempts = new Map()
  state.multiplayerTriedAnswerIds = new Map()

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

async function completeMultiplayerRound(round: MultiplayerRound): Promise<void> {
  const connection = state.roomConnection

  if (!connection) {
    return
  }

  try {
    if (!state.currentHostTrack) {
      throw new Error('Réponse de la manche introuvable')
    }
    await connection.sendRoundReveal({
      roundId: round.roundId,
      correctTrackId: state.currentHostTrack.id,
      title: state.currentHostTrack.title,
      artist: state.currentHostTrack.artist,
      imageUrl: state.currentHostTrack.imageUrl,
    })
    await connection.sendRoundComplete({
      roundId: round.roundId,
      round: round.round,
    })

    if (state.roomConnection !== connection || state.multiplayerHostLeft || state.multiplayerGameOver) {
      return
    }

    if (round.round === state.currentGameRoundCount) {
      const finalScores: GameOver['scores'] = [...state.multiplayerPlayerNames.entries()]
        .map(([playerId, name]) => ({
          playerId,
          name,
          score: state.multiplayerScores.get(playerId) ?? 0,
        }))
        .sort((firstPlayer, secondPlayer) =>
          secondPlayer.score - firstPlayer.score
          || firstPlayer.name.localeCompare(secondPlayer.name),
        )

      await connection.sendGameOver({ gameId: round.gameId, scores: finalScores })
      return
    }

    stopMultiplayerTransition()
    state.multiplayerTransitionId = window.setTimeout(() => {
      state.multiplayerTransitionId = null

      if (state.roomConnection !== connection || state.multiplayerHostLeft || state.multiplayerGameOver) {
        return
      }

      state.multiplayerCurrentRoundNumber = round.round + 1

      void sendNextMultiplayerRound(connection).catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('Impossible de synchroniser la manche suivante.')
      })
    }, MULTIPLAYER_ROUND_TRANSITION_MS)
  } catch (error) {
    console.error(error)

    if (state.roomConnection === connection) {
      void leaveMultiplayerRoom('La connexion multijoueur a été interrompue.')
    }
  }
}

export function checkMultiplayerRoundCompletion(): void {
  if (!state.multiplayerIsHost || !state.currentMultiplayerRound || state.multiplayerRoundFinished) {
    return
  }

  const allPlayersAnswered = [...state.multiplayerRoundPlayerIds].every((playerId) =>
    state.finishedPlayerIds.has(playerId),
  )

  if (!allPlayersAnswered) {
    return
  }

  state.multiplayerRoundFinished = true
  cleanupMultiplayerRound()
  void completeMultiplayerRound(state.currentMultiplayerRound)
}

export async function leaveMultiplayerRoom(initialStatus = ''): Promise<void> {
  if (state.multiplayerLeaveInProgress) {
    return
  }

  state.multiplayerLeaveInProgress = true
  resetMultiplayerGameState()
  state.multiplayerPlayerNames = new Map()
  state.multiplayerClockOffsetMs = 0
  state.multiplayerClockSyncPromise = null
  state.multiplayerHostSeen = false
  state.multiplayerHostId = null
  state.multiplayerHostLeft = false
  state.multiplayerGameOver = false
  state.multiplayerLastRoundId = null
  state.multiplayerClockSynced = false
  state.multiplayerLastClockSyncRound = 0
  state.currentMultiplayerGameId = null
  state.multiplayerTracks = []
  state.currentGameMusicTheme = DEFAULT_MUSIC_THEME
  state.currentGameMusicMarket = DEFAULT_MUSIC_MARKET
  state.multiplayerMusicMarket = DEFAULT_MUSIC_MARKET
  state.currentGameRoundCount = DEFAULT_ROUND_COUNT
  state.multiplayerRoundCount = DEFAULT_ROUND_COUNT
  state.currentGameRoundDuration = DEFAULT_ROUND_DURATION
  state.multiplayerRoundDuration = DEFAULT_ROUND_DURATION
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
    triedAnswerIds: state.multiplayerTriedAnswerIds,
    scores: state.multiplayerScores,
    guess,
    now: Date.now(),
    roundDurationMs: state.currentGameRoundDuration * 1000,
    maxRoundScore: MAX_ROUND_SCORE,
  })
  if (!result) return
  renderMultiplayerLeaderboard()

  const connection = state.roomConnection

  if (connection) {
    void (async () => {
      await connection.sendAttemptResult(result)
      if (result.addedScore > 0) await connection.sendScoreUpdate(result)
      checkMultiplayerRoundCompletion()
    })().catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('La connexion multijoueur a été interrompue.')
    })
    return
  }

  checkMultiplayerRoundCompletion()
}

export function handleAttemptResult(result: AttemptResult): void {
  if (
    state.multiplayerHostLeft
    || state.multiplayerGameOver
    || !state.currentMultiplayerRound
    || result.roundId !== state.currentMultiplayerRound.roundId
  ) {
    return
  }

  state.multiplayerScores.set(result.playerId, result.totalScore)
  renderMultiplayerLeaderboard()

  if (result.playerId !== state.multiplayerPlayerId) {
    return
  }

  state.ownAnswerResult = result

  const gameStatus = document.querySelector<HTMLParagraphElement>('#multiplayer-status')

  if (!gameStatus) {
    return
  }

  gameStatus.textContent = result.isCorrect
    ? 'Bonne réponse ! Résultat à venir…'
    : result.finished ? 'Plus aucun essai. Résultat à venir…' : 'Mauvaise réponse, réessaie.'

  state.multiplayerAttemptResultHandler?.(result)
}

function handleScoreUpdate(update: ScoreUpdate): void {
  if (update.roundId !== state.currentMultiplayerRound?.roundId) return
  state.multiplayerScores.set(update.playerId, update.totalScore)
  renderMultiplayerLeaderboard()
}

function handleRoundReveal(reveal: RoundReveal): void {
  if (!state.currentMultiplayerRound || reveal.roundId !== state.currentMultiplayerRound.roundId) return
  state.currentRoundReveal = reveal
  revealArtwork(document, reveal.imageUrl, `Cover de ${reveal.title} par ${reveal.artist}`)
  const revealCard = document.querySelector<HTMLParagraphElement>('#multiplayer-reveal')
  if (revealCard) {
    renderRoundResult(
      revealCard,
      state.ownAnswerResult ? (state.ownAnswerResult.isCorrect ? 'correct' : 'wrong') : 'timeout',
      reveal.title,
      reveal.artist,
      state.ownAnswerResult?.isCorrect ? state.ownAnswerResult.addedScore : 0,
    )
  }
  const status = document.querySelector<HTMLParagraphElement>('#multiplayer-status')
  if (status) status.textContent = ''
}

function handleRoundComplete(result: RoundComplete): void {
  if (
    state.multiplayerHostLeft
    || state.multiplayerGameOver
    || !state.currentMultiplayerRound
    || result.roundId !== state.currentMultiplayerRound.roundId
    || result.round !== state.currentMultiplayerRound.round
  ) {
    return
  }

  state.multiplayerRoundFinished = true
  cleanupMultiplayerRound()

  const roundIndex = result.round - 1
  const localOutcome: RoundOutcome = state.ownAnswerResult
    ? (state.ownAnswerResult.isCorrect ? 'correct' : 'failed')
    : 'timeout'
  const solution = state.currentRoundReveal
    ? { title: state.currentRoundReveal.title, artist: state.currentRoundReveal.artist }
    : state.currentHostTrack
      ? { title: state.currentHostTrack.title, artist: state.currentHostTrack.artist }
      : null

  if (solution) {
    state.multiplayerOwnRoundHistory[roundIndex] = localOutcome
    state.multiplayerOwnRoundRecap[roundIndex] = {
      outcome: localOutcome,
      guess: state.multiplayerLastOwnGuess,
      attemptsUsed: state.ownAnswerResult?.attemptsUsed ?? 0,
      solution,
    }
  }

  if (state.currentRoundReveal) {
    revealArtwork(document, state.currentRoundReveal.imageUrl, `Cover de ${state.currentRoundReveal.title} par ${state.currentRoundReveal.artist}`)
  }

  document.querySelector<HTMLFormElement>('#multiplayer-guess-form')?.querySelectorAll('input, button')
    .forEach((control) => { (control as HTMLInputElement | HTMLButtonElement).disabled = true })

  const guessSubmit = document.querySelector<HTMLButtonElement>('#multiplayer-guess-form .guess-search__submit')
  if (guessSubmit) {
    guessSubmit.hidden = true
  }

  const playAudioButton = document.querySelector<HTMLButtonElement>('#play-audio-button')
  if (playAudioButton) {
    playAudioButton.hidden = true
    playAudioButton.disabled = true
  }
}

export async function openRoom(roomCode: string, playerName: string, isHost: boolean): Promise<void> {
  try {
    state.multiplayerMusicTheme = DEFAULT_MUSIC_THEME
    state.multiplayerMusicMarket = DEFAULT_MUSIC_MARKET
    state.multiplayerRoundCount = DEFAULT_ROUND_COUNT
    state.multiplayerRoundDuration = DEFAULT_ROUND_DURATION
    renderLobby(roomCode, isHost)

    state.multiplayerClockOffsetMs = 0
    state.multiplayerHostSeen = false
    state.multiplayerHostId = null
    state.multiplayerHostLeft = false
    state.multiplayerGameOver = false
    state.multiplayerLastRoundId = null
    state.multiplayerClockSynced = false
    state.multiplayerLastClockSyncRound = 0
    state.currentMultiplayerGameId = null
    const playerId = createId()
    const startButton = document.querySelector<HTMLButtonElement>('#start-game-button')
    const leaveButton = document.querySelector<HTMLButtonElement>('#leave-room-button')!
    state.multiplayerPlayerId = playerId
    state.multiplayerIsHost = isHost

    state.roomConnection = await joinRoom(
      roomCode,
      playerId,
      playerName,
      isHost,
      {
        musicTheme: state.multiplayerMusicTheme,
        musicMarket: state.multiplayerMusicMarket,
        roundCount: state.multiplayerRoundCount,
        roundDuration: state.multiplayerRoundDuration,
      },
      renderPlayers,
      handleGameStart,
      handleGameCatalog,
      handleRoundStart,
      handlePlayerGuess,
      handleAttemptResult,
      handleScoreUpdate,
      handleRoundReveal,
      handleRoundComplete,
      handleGameOver,
    )
    if (startButton) {
      startButton.disabled = state.multiplayerPlayerNames.size < 2
    }
    leaveButton.disabled = false

    if (!isHost) {
      synchronizeMultiplayerClock(state.roomConnection)
    }
  } catch (error) {
    console.error(error)
    cleanupMultiplayerRound()
    stopMultiplayerTransition()
    state.roomConnection = null
    state.multiplayerPlayerId = null
    state.multiplayerIsHost = false
    state.multiplayerClockOffsetMs = 0
    state.multiplayerClockSyncPromise = null
    state.multiplayerHostSeen = false
    state.multiplayerHostId = null
    state.multiplayerHostLeft = false
    state.multiplayerGameOver = false
    state.multiplayerLastRoundId = null
    state.currentMultiplayerGameId = null
    renderHome(error instanceof Error ? error.message : 'Impossible de rejoindre cette partie.')
  }
}
