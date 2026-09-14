import './style.css'
import {
  fetchTracks,
  isMusicTheme,
  MUSIC_THEMES,
  MUSIC_THEME_LABELS,
  type MusicTheme,
  type Track,
} from './api'
import {
  type AttemptResult,
  type FinalScore,
  type GameOver,
  type GameCatalog,
  type GameStart,
  joinRoom,
  type MultiplayerRound,
  type Player,
  type PlayerGuess,
  type RoundComplete,
  type RoundReveal,
  type RoomConnection,
  type ScoreUpdate,
} from './multiplayer/realtime'
import {
  formatGuessOption,
  getRandomTrack,
  isRoundCount,
  isRoundDuration,
  MAX_ATTEMPTS,
  ROUND_COUNT_OPTIONS,
  ROUND_DURATION_OPTIONS,
  type GuessOption,
  type RoundCount,
  type RoundDuration,
  type RoundOutcome,
} from './game'
import {
  createGuessArea,
  roundRecapMarkup,
  roundTimelineMarkup,
  type GuessArea,
  type RoundRecapEntry,
} from './guess-ui'
import { focusScreenHeading, formatRemainingTime, formatScore, setStatusMessage } from './ui'
import { scorePlayerGuess } from './multiplayer/game'
import { renderFinalLeaderboard, renderLeaderboard } from './multiplayer/game-ui'
import { getDisplaySongTitle } from './song'
import { createSoloGame } from './solo'

const MAX_ROUND_SCORE = 1000
const HIGH_SCORE_KEY = 'blindtest-high-score'
const VOLUME_KEY = 'blindtest-volume'
const MUSIC_THEME_KEY = 'blindtest-music-theme'
const ROUND_COUNT_KEY = 'blindtest-round-count'
const ROUND_DURATION_KEY = 'blindtest-round-duration'
const DEFAULT_VOLUME = 0.5
const DEFAULT_MUSIC_THEME: MusicTheme = 'all'
const DEFAULT_ROUND_COUNT: RoundCount = 5
const DEFAULT_ROUND_DURATION: RoundDuration = 30
const ROOM_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MULTIPLAYER_START_DELAY_MS = 3000
const MULTIPLAYER_ROUND_TRANSITION_MS = 2000

let multiplayerTracks: Track[] = []
let roomConnection: RoomConnection | null = null
let multiplayerAudio: HTMLAudioElement | null = null
let multiplayerTimerId: number | null = null
let multiplayerStartTimeoutId: number | null = null
let multiplayerPlayerId: string | null = null
let multiplayerIsHost = false
let currentMultiplayerGameId: string | null = null
let currentMultiplayerRound: MultiplayerRound | null = null
let currentHostTrack: Track | null = null
let currentRoundReveal: RoundReveal | null = null
let ownAnswerResult: AttemptResult | null = null
let finishedPlayerIds = new Set<string>()
let multiplayerAttempts = new Map<string, number>()
let multiplayerTriedAnswerIds = new Map<string, Set<string>>()
let multiplayerCatalog: GuessOption[] = []
let multiplayerScores = new Map<string, number>()
let multiplayerPlayerNames = new Map<string, string>()
let multiplayerCurrentRoundNumber = 0
let multiplayerOwnRoundHistory: (RoundOutcome | undefined)[] = []
let multiplayerOwnRoundRecap: (RoundRecapEntry | undefined)[] = []
let multiplayerLastOwnGuess: GuessOption | null = null
let multiplayerGuessArea: GuessArea | null = null
let multiplayerPlayedTrackIds = new Set<string>()
let multiplayerRoundPlayerIds = new Set<string>()
let multiplayerRoundFinished = false
let multiplayerTransitionId: number | null = null
let multiplayerClockOffsetMs = 0
let multiplayerClockSyncPromise: Promise<void> | null = null
let multiplayerHostSeen = false
let multiplayerHostId: string | null = null
let multiplayerHostLeft = false
let multiplayerGameOver = false
let multiplayerLastRoundId: string | null = null
let multiplayerLeaveInProgress = false
let selectedTheme: MusicTheme = readStoredMusicTheme()
let selectedRoundCount: RoundCount = readStoredRoundCount()
let selectedRoundDuration: RoundDuration = readStoredRoundDuration()
let currentVolume = readStoredVolume()
let multiplayerMusicTheme: MusicTheme = DEFAULT_MUSIC_THEME
let currentGameMusicTheme: MusicTheme = DEFAULT_MUSIC_THEME
let multiplayerRoundCount: RoundCount = DEFAULT_ROUND_COUNT
let currentGameRoundCount: RoundCount = DEFAULT_ROUND_COUNT
let multiplayerRoundDuration: RoundDuration = DEFAULT_ROUND_DURATION
let currentGameRoundDuration: RoundDuration = DEFAULT_ROUND_DURATION

function readStoredVolume(): number {
  const storedValue = localStorage.getItem(VOLUME_KEY)

  if (storedValue === null) {
    return DEFAULT_VOLUME
  }

  const storedVolume = Number(storedValue)

  if (!Number.isFinite(storedVolume)) {
    return DEFAULT_VOLUME
  }

  return Math.min(1, Math.max(0, storedVolume))
}

function readStoredMusicTheme(): MusicTheme {
  const storedTheme = localStorage.getItem(MUSIC_THEME_KEY)

  return isMusicTheme(storedTheme) ? storedTheme : DEFAULT_MUSIC_THEME
}

function readStoredRoundCount(): RoundCount {
  const storedRoundCount = Number(localStorage.getItem(ROUND_COUNT_KEY))

  return isRoundCount(storedRoundCount) ? storedRoundCount : DEFAULT_ROUND_COUNT
}

function readStoredRoundDuration(): RoundDuration {
  const storedDuration = Number(localStorage.getItem(ROUND_DURATION_KEY))
  return isRoundDuration(storedDuration) ? storedDuration : DEFAULT_ROUND_DURATION
}

function applyVolumeToActiveAudio(): void {
  soloGame.setVolume(currentVolume)
  if (multiplayerAudio) {
    multiplayerAudio.volume = currentVolume
  }
}

function renderThemeSelectMarkup(selectId: string, selected: MusicTheme): string {
  const options = MUSIC_THEMES.map(
    (theme) =>
      `<option value="${theme}"${theme === selected ? ' selected' : ''}>${MUSIC_THEME_LABELS[theme]}</option>`,
  ).join('')

  return `
    <div class="form-field">
      <label for="${selectId}">Thème</label>
      <select id="${selectId}" name="musicTheme">${options}</select>
    </div>
  `
}

function renderRoundCountSelectMarkup(selectId: string, selected: RoundCount): string {
  const options = ROUND_COUNT_OPTIONS.map(
    (count) => `<option value="${count}"${count === selected ? ' selected' : ''}>${count}</option>`,
  ).join('')

  return `
    <div class="form-field">
      <label for="${selectId}">Manches</label>
      <select id="${selectId}" name="roundCount">${options}</select>
    </div>
  `
}

function renderRoundDurationSelectMarkup(selectId: string, selected: RoundDuration): string {
  const options = ROUND_DURATION_OPTIONS.map(
    (duration) => `<option value="${duration}"${duration === selected ? ' selected' : ''}>${duration} s</option>`,
  ).join('')

  return `
    <div class="form-field">
      <label for="${selectId}">Durée</label>
      <select id="${selectId}" name="roundDuration">${options}</select>
    </div>
  `
}

function updateHomeHighScore(): void {
  const element = document.querySelector<HTMLParagraphElement>('#home-high-score')

  if (!element) {
    return
  }

  const value = readHighScore(selectedRoundCount)
  element.hidden = value <= 0

  const strong = document.createElement('strong')
  strong.textContent = formatScore(value)
  element.replaceChildren(`Meilleur score · ${selectedRoundCount} manches `, strong)
}

function renderVolumeControlMarkup(id: string, compact = false): string {
  const volumePercent = Math.round(currentVolume * 100)

  return `
    <div class="volume-control${compact ? ' volume-control--compact' : ''}">
      <input id="${id}" data-volume-slider type="range" min="0" max="100" step="5" value="${volumePercent}" />
      <span class="volume-value" data-volume-value>${volumePercent} %</span>
    </div>
  `
}

function getArtworkUrl(imageUrl: string): string {
  if (!imageUrl) {
    return ''
  }

  return imageUrl.replace(/100x100bb/, '600x600bb')
}

function renderArtworkMarkup(): string {
  return `
    <figure class="artwork">
      <div class="artwork__frame">
        <img class="artwork__image" data-artwork-image alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <span class="artwork__mystery" data-artwork-placeholder aria-hidden="true">
          <svg class="artwork__disc" viewBox="0 0 200 200" focusable="false">
            <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="3" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="3" />
            <circle cx="100" cy="100" r="13" fill="#31d982" />
            <path d="M100 100 L100 74" stroke="#31d982" stroke-width="5" stroke-linecap="round" />
          </svg>
        </span>
      </div>
    </figure>
  `
}

function revealArtwork(root: ParentNode, imageUrl: string, alt: string): void {
  const image = root.querySelector<HTMLImageElement>('[data-artwork-image]')
  const placeholder = root.querySelector<HTMLElement>('[data-artwork-placeholder]')

  if (!image || !placeholder || image.dataset.revealed === 'true') {
    return
  }

  const src = getArtworkUrl(imageUrl)

  if (!src) {
    return
  }

  image.dataset.revealed = 'true'
  image.alt = alt
  const onLoad = (): void => {
    if (image.naturalWidth <= 2) {
      return
    }

    image.removeEventListener('load', onLoad)
    image.classList.add('is-visible')
    placeholder.classList.add('is-hidden')
  }
  image.addEventListener('load', onLoad)
  image.addEventListener('error', () => {
    image.removeEventListener('load', onLoad)
    image.removeAttribute('data-revealed')
  }, { once: true })
  image.src = src
}

function setupVolumeControls(): void {
  const sliders = [...document.querySelectorAll<HTMLInputElement>('[data-volume-slider]')]

  if (sliders.length === 0) {
    return
  }

  const applyVolume = (volume: number): void => {
    currentVolume = volume
    localStorage.setItem(VOLUME_KEY, String(currentVolume))

    const volumePercent = Math.round(currentVolume * 100)

    document.querySelectorAll<HTMLSpanElement>('[data-volume-value]').forEach((label) => {
      label.textContent = `${volumePercent} %`
    })

    document.querySelectorAll<HTMLInputElement>('[data-volume-slider]').forEach((element) => {
      element.value = String(volumePercent)
    })

    applyVolumeToActiveAudio()
  }

  for (const slider of sliders) {
    slider.addEventListener('input', () => {
      const volumePercent = Math.min(100, Math.max(0, Number(slider.value)))
      applyVolume(volumePercent / 100)
    })
  }
}

function highScoreKey(roundCount: RoundCount): string {
  return `${HIGH_SCORE_KEY}-${roundCount}`
}

function readHighScore(roundCount: RoundCount): number {
  const storedScore = Number(localStorage.getItem(highScoreKey(roundCount)))

  if (Number.isFinite(storedScore) && storedScore > 0) {
    return storedScore
  }

  if (roundCount === 5 && localStorage.getItem(highScoreKey(5)) === null) {
    const legacyScore = Number(localStorage.getItem(HIGH_SCORE_KEY))

    if (Number.isFinite(legacyScore) && legacyScore > 0) {
      localStorage.setItem(highScoreKey(5), String(legacyScore))
      return legacyScore
    }
  }

  return 0
}

const app = document.querySelector<HTMLDivElement>('#app')!

function stopMultiplayerAudio(): void {
  if (multiplayerAudio) {
    multiplayerAudio.pause()
    multiplayerAudio.currentTime = 0
    multiplayerAudio = null
  }
}

function stopMultiplayerTimer(): void {
  if (multiplayerTimerId !== null) {
    window.clearInterval(multiplayerTimerId)
    multiplayerTimerId = null
  }

  if (multiplayerStartTimeoutId !== null) {
    window.clearTimeout(multiplayerStartTimeoutId)
    multiplayerStartTimeoutId = null
  }
}

function getEstimatedHostNow(): number {
  return Date.now() + multiplayerClockOffsetMs
}

function stopMultiplayerTransition(): void {
  if (multiplayerTransitionId !== null) {
    window.clearTimeout(multiplayerTransitionId)
    multiplayerTransitionId = null
  }
}

function cleanupMultiplayerRound(): void {
  stopMultiplayerTimer()
  stopMultiplayerAudio()
  multiplayerGuessArea?.destroy()
  multiplayerGuessArea = null
}

function resetMultiplayerGameState(): void {
  cleanupMultiplayerRound()
  stopMultiplayerTransition()
  currentMultiplayerRound = null
  currentHostTrack = null
  currentRoundReveal = null
  ownAnswerResult = null
  finishedPlayerIds = new Set()
  multiplayerAttempts = new Map()
  multiplayerTriedAnswerIds = new Map()
  multiplayerCatalog = []
  multiplayerScores = new Map()
  multiplayerCurrentRoundNumber = 0
  multiplayerOwnRoundHistory = []
  multiplayerOwnRoundRecap = []
  multiplayerLastOwnGuess = null
  multiplayerPlayedTrackIds = new Set()
  multiplayerRoundPlayerIds = new Set()
  multiplayerRoundFinished = false
  multiplayerGameOver = false
  multiplayerLastRoundId = null
}

function renderMultiplayerLeaderboard(): void {
  renderLeaderboard(
    document.querySelector('#multiplayer-leaderboard'),
    multiplayerPlayerNames,
    multiplayerScores,
    multiplayerPlayerId,
  )
}


const ROUND_RESULT_MARKS = {
  correct:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10.5l3.2 3.2L15 6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  wrong:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.2 6.2l7.6 7.6M13.8 6.2l-7.6 7.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>',
  timeout:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>',
  skip:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 5l6 5-6 5M13 5v10" fill="none" stroke="currentColor" stroke-width="2" /></svg>',
} as const

const ROUND_RESULT_LABELS = {
  correct: 'Bonne réponse',
  wrong: 'Raté',
  timeout: 'Temps écoulé',
  skip: 'Passé',
} as const

function renderRoundResult(
  status: HTMLElement,
  state: 'correct' | 'wrong' | 'timeout' | 'skip',
  title: string,
  artist: string,
  points = 0,
): void {
  status.replaceChildren()
  status.classList.remove('answer-feedback', 'is-correct', 'is-wrong', 'is-timeout')
  status.classList.add('round-result', `round-result--${state}`)

  const badge = document.createElement('span')
  badge.className = 'round-result__badge'
  badge.setAttribute('aria-hidden', 'true')
  badge.innerHTML = ROUND_RESULT_MARKS[state]

  const body = document.createElement('span')
  body.className = 'round-result__body'

  const statusLabel = document.createElement('span')
  statusLabel.className = 'round-result__status'
  statusLabel.textContent = ROUND_RESULT_LABELS[state]

  const track = document.createElement('span')
  track.className = 'round-result__track'
  track.textContent = getDisplaySongTitle(title)

  const artistElement = document.createElement('span')
  artistElement.className = 'round-result__artist'
  artistElement.textContent = ` — ${artist}`
  track.append(artistElement)

  body.append(statusLabel, track)
  status.append(badge, body)

  if (state !== 'timeout' && state !== 'skip') {
    const pointsElement = document.createElement('span')
    pointsElement.className = 'round-result__points'
    pointsElement.textContent = state === 'correct' ? `+${formatScore(points)}` : '0'
    status.append(pointsElement)
  }

  status.closest('.game-shell')?.classList.add('is-answered')
}

function saveHighScoreIfNeeded(roundCount: RoundCount, value: number): boolean {
  if (value <= readHighScore(roundCount)) {
    return false
  }

  localStorage.setItem(highScoreKey(roundCount), String(value))
  return true
}

const soloGame = createSoloGame({
  app,
  getVolume: () => currentVolume,
  setupVolumeControls,
  renderVolumeControlMarkup,
  renderArtworkMarkup,
  revealArtwork,
  renderRoundResult,
  readHighScore,
  saveHighScore: saveHighScoreIfNeeded,
  renderHome: () => renderHome(),
})

function generateRoomCode(): string {
  return Array.from({ length: 4 }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)
    return ROOM_CODE_CHARACTERS[index]
  }).join('')
}

function normalizeRoomCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function isValidRoomCode(roomCode: string): boolean {
  return roomCode.length === 4 && [...roomCode].every((character) =>
    ROOM_CODE_CHARACTERS.includes(character),
  )
}

function normalizePlayerName(value: string): string {
  return value.trim()
}

function isValidPlayerName(playerName: string): boolean {
  return playerName.length >= 2 && playerName.length <= 20
}

function createId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] ?? 0) & 0x0f | 0x40
  bytes[8] = (bytes[8] ?? 0) & 0x3f | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

function synchronizeMultiplayerClock(connection: RoomConnection, force = false): void {
  if (multiplayerIsHost || multiplayerHostLeft || multiplayerGameOver) {
    multiplayerClockOffsetMs = 0
    return
  }

  if (multiplayerClockSyncPromise) {
    if (force) {
      void multiplayerClockSyncPromise.then(() => {
        if (roomConnection === connection && !multiplayerHostLeft && !multiplayerGameOver) {
          synchronizeMultiplayerClock(connection)
        }
      })
    }

    return
  }

  const syncPromise = connection.syncClock()
    .then((result) => {
      if (roomConnection !== connection || multiplayerHostLeft || multiplayerGameOver) {
        return
      }

      if (result.rttMs > 0) {
        multiplayerClockOffsetMs = result.offsetMs
      }
    })
    .catch((error) => {
      console.error(error)
    })

  multiplayerClockSyncPromise = syncPromise
  void syncPromise.finally(() => {
    if (multiplayerClockSyncPromise === syncPromise) {
      multiplayerClockSyncPromise = null
    }
  })
}

function handleMultiplayerHostLeft(): void {
  if (multiplayerHostLeft) {
    return
  }

  multiplayerHostLeft = true
  multiplayerGameOver = true
  multiplayerRoundFinished = true
  currentMultiplayerRound = null
  cleanupMultiplayerRound()
  stopMultiplayerTransition()
  multiplayerClockSyncPromise = null

  const connection = roomConnection
  roomConnection = null
  void connection?.leave().catch((error) => {
    console.error(error)
  })

  app.innerHTML = `
    <main class="welcome welcome--status">
      <section class="welcome__content result-shell surface" aria-labelledby="host-left-title">
        <h1 id="host-left-title">Partie interrompue</h1>
        <p class="status" role="status" aria-live="polite">L’hôte a quitté la partie.</p>
        <button id="return-home-button" class="button-primary full-width" type="button">Retour à l'accueil</button>
      </section>
    </main>
  `
  focusScreenHeading(app)

  const returnHomeButton = document.querySelector<HTMLButtonElement>('#return-home-button')!
  returnHomeButton.addEventListener('click', () => {
    returnHomeButton.disabled = true
    void leaveMultiplayerRoom()
  })
}

function handleRoundStart(round: MultiplayerRound): void {
  if (
    multiplayerHostLeft
    || multiplayerGameOver
    || round.gameId !== currentMultiplayerGameId
    || round.round < 1
    || round.round > currentGameRoundCount
  ) {
    return
  }

  if (currentMultiplayerRound && round.round <= currentMultiplayerRound.round) {
    return
  }

  if (!currentMultiplayerRound && round.round < multiplayerCurrentRoundNumber) {
    return
  }

  if (round.roundId === multiplayerLastRoundId) {
    return
  }

  renderMultiplayerRound(round)
}

function renderPlayers(players: Player[]): void {
  const hasHost = players.some((player) => player.isHost)

  if (hasHost) {
    multiplayerHostSeen = true
  } else if (!multiplayerIsHost && multiplayerHostSeen && !multiplayerHostLeft) {
    handleMultiplayerHostLeft()
  }

  const hostPlayer = players.find((player) => player.isHost)
  multiplayerHostId = hostPlayer?.playerId ?? multiplayerHostId

  if (!multiplayerIsHost && hostPlayer?.musicTheme) {
    multiplayerMusicTheme = hostPlayer.musicTheme
  }

  if (!multiplayerIsHost && hostPlayer?.roundCount) {
    multiplayerRoundCount = hostPlayer.roundCount
  }

  if (!multiplayerIsHost && hostPlayer?.roundDuration) {
    multiplayerRoundDuration = hostPlayer.roundDuration
  }

  multiplayerPlayerNames = new Map(
    players.map((player) => [player.playerId, player.name]),
  )

  for (const player of players) {
    if (!multiplayerScores.has(player.playerId)) {
      multiplayerScores.set(player.playerId, 0)
    }
  }

  if (currentMultiplayerRound && !multiplayerRoundFinished) {
    for (const playerId of multiplayerRoundPlayerIds) {
      if (!multiplayerPlayerNames.has(playerId)) {
        multiplayerRoundPlayerIds.delete(playerId)
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
    lobbyThemeValue.textContent = MUSIC_THEME_LABELS[multiplayerMusicTheme]
  }

  const lobbyRoundCountValue = document.querySelector<HTMLElement>('#lobby-round-count-value')
  if (lobbyRoundCountValue) {
    lobbyRoundCountValue.textContent = String(multiplayerRoundCount)
  }

  const lobbyRoundDurationValue = document.querySelector<HTMLElement>('#lobby-round-duration-value')
  if (lobbyRoundDurationValue) lobbyRoundDurationValue.textContent = `${multiplayerRoundDuration} s`

  const startButton = document.querySelector<HTMLButtonElement>('#start-game-button')
  if (startButton) {
    startButton.disabled = players.length < 2
  }

  const lobbyStatus = document.querySelector<HTMLParagraphElement>('#lobby-status')
  if (lobbyStatus) {
    lobbyStatus.textContent = multiplayerIsHost
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

  if (roomConnection && !multiplayerIsHost) {
    synchronizeMultiplayerClock(roomConnection, true)
  }
}

function handleGameStart(gameStart: GameStart): void {
  if (
    multiplayerHostLeft
    || !gameStart?.gameId
    || !gameStart.startedBy
    || gameStart.startedBy !== multiplayerHostId
    || gameStart.gameId === currentMultiplayerGameId
  ) {
    return
  }

  currentGameMusicTheme = isMusicTheme(gameStart.musicTheme)
    ? gameStart.musicTheme
    : DEFAULT_MUSIC_THEME
  currentGameRoundCount = isRoundCount(gameStart.roundCount)
    ? gameStart.roundCount
    : DEFAULT_ROUND_COUNT
  currentGameRoundDuration = isRoundDuration(gameStart.roundDuration)
    ? gameStart.roundDuration
    : DEFAULT_ROUND_DURATION
  currentMultiplayerGameId = gameStart.gameId
  resetMultiplayerGameState()
  showGameStarting()
}

function handleGameCatalog(catalog: GameCatalog): void {
  if (catalog.gameId === currentMultiplayerGameId) multiplayerCatalog = catalog.options
}

async function startMultiplayerGame(): Promise<void> {
  const connection = roomConnection

  if (!connection || !multiplayerIsHost) {
    throw new Error('Seul l’hôte peut commencer la partie')
  }

  currentMultiplayerGameId = createId()
  currentGameMusicTheme = multiplayerMusicTheme
  currentGameRoundCount = multiplayerRoundCount
  currentGameRoundDuration = multiplayerRoundDuration
  resetMultiplayerGameState()
  showGameStarting()
  await connection.startGame(currentMultiplayerGameId, {
    musicTheme: currentGameMusicTheme,
    roundCount: currentGameRoundCount,
    roundDuration: currentGameRoundDuration,
  })

  multiplayerTracks = await fetchTracks(currentGameMusicTheme)
  multiplayerCatalog = multiplayerTracks.map(({ id, title, artist }) => ({ id, title, artist }))
  await connection.sendCatalog({ gameId: currentMultiplayerGameId, options: multiplayerCatalog })

  multiplayerCurrentRoundNumber = 1
  multiplayerScores = new Map(
    [...multiplayerPlayerNames.keys()].map((playerId) => [playerId, 0]),
  )
  await sendNextMultiplayerRound(connection)
}

async function sendNextMultiplayerRound(connection: RoomConnection): Promise<void> {
  if (!multiplayerIsHost || roomConnection !== connection || !currentMultiplayerGameId) {
    return
  }

  cleanupMultiplayerRound()
  currentMultiplayerRound = null
  currentHostTrack = null
  finishedPlayerIds = new Set()
  multiplayerAttempts = new Map()
  multiplayerTriedAnswerIds = new Map()

  const availableTracks = multiplayerTracks.filter((track) => !multiplayerPlayedTrackIds.has(track.id))
  const correctTrack = getRandomTrack(availableTracks)
  multiplayerPlayedTrackIds.add(correctTrack.id)

  const round: MultiplayerRound = {
    gameId: currentMultiplayerGameId,
    roundId: createId(),
    round: multiplayerCurrentRoundNumber,
    startAt: Date.now() + MULTIPLAYER_START_DELAY_MS,
    audioUrl: correctTrack.audioUrl,
  }

  currentHostTrack = correctTrack
  multiplayerRoundPlayerIds = new Set(multiplayerPlayerNames.keys())
  multiplayerRoundFinished = false
  await connection.sendRound(round)
}

async function completeMultiplayerRound(round: MultiplayerRound): Promise<void> {
  const connection = roomConnection

  if (!connection) {
    return
  }

  try {
    if (!currentHostTrack) {
      throw new Error('Réponse de la manche introuvable')
    }
    await connection.sendRoundReveal({
      roundId: round.roundId,
      correctTrackId: currentHostTrack.id,
      title: currentHostTrack.title,
      artist: currentHostTrack.artist,
      imageUrl: currentHostTrack.imageUrl,
    })
    await connection.sendRoundComplete({
      roundId: round.roundId,
      round: round.round,
    })

    if (roomConnection !== connection || multiplayerHostLeft || multiplayerGameOver) {
      return
    }

    if (round.round === currentGameRoundCount) {
      const finalScores: FinalScore[] = [...multiplayerPlayerNames.entries()]
        .map(([playerId, name]) => ({
          playerId,
          name,
          score: multiplayerScores.get(playerId) ?? 0,
        }))
        .sort((firstPlayer, secondPlayer) =>
          secondPlayer.score - firstPlayer.score
          || firstPlayer.name.localeCompare(secondPlayer.name),
        )

      await connection.sendGameOver({ gameId: round.gameId, scores: finalScores })
      return
    }

    stopMultiplayerTransition()
    multiplayerTransitionId = window.setTimeout(() => {
      multiplayerTransitionId = null

      if (roomConnection !== connection || multiplayerHostLeft || multiplayerGameOver) {
        return
      }

      multiplayerCurrentRoundNumber = round.round + 1

      void sendNextMultiplayerRound(connection).catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('Impossible de synchroniser la manche suivante.')
      })
    }, MULTIPLAYER_ROUND_TRANSITION_MS)
  } catch (error) {
    console.error(error)

    if (roomConnection === connection) {
      void leaveMultiplayerRoom('La connexion multijoueur a été interrompue.')
    }
  }
}

function checkMultiplayerRoundCompletion(): void {
  if (!multiplayerIsHost || !currentMultiplayerRound || multiplayerRoundFinished) {
    return
  }

  const allPlayersAnswered = [...multiplayerRoundPlayerIds].every((playerId) =>
    finishedPlayerIds.has(playerId),
  )

  if (!allPlayersAnswered) {
    return
  }

  multiplayerRoundFinished = true
  cleanupMultiplayerRound()
  void completeMultiplayerRound(currentMultiplayerRound)
}

async function leaveMultiplayerRoom(initialStatus = ''): Promise<void> {
  if (multiplayerLeaveInProgress) {
    return
  }

  multiplayerLeaveInProgress = true
  resetMultiplayerGameState()
  multiplayerPlayerNames = new Map()
  multiplayerClockOffsetMs = 0
  multiplayerClockSyncPromise = null
  multiplayerHostSeen = false
  multiplayerHostId = null
  multiplayerHostLeft = false
  multiplayerGameOver = false
  multiplayerLastRoundId = null
  currentMultiplayerGameId = null
  multiplayerTracks = []
  currentGameMusicTheme = DEFAULT_MUSIC_THEME
  currentGameRoundCount = DEFAULT_ROUND_COUNT
  multiplayerRoundCount = DEFAULT_ROUND_COUNT
  currentGameRoundDuration = DEFAULT_ROUND_DURATION
  multiplayerRoundDuration = DEFAULT_ROUND_DURATION
  multiplayerPlayerId = null
  multiplayerIsHost = false

  const connection = roomConnection
  roomConnection = null

  try {
    await connection?.leave()
  } catch (error) {
    console.error(error)
  } finally {
    multiplayerLeaveInProgress = false
    renderHome(initialStatus)
  }
}

function handlePlayerGuess(guess: PlayerGuess): void {
  if (multiplayerRoundFinished) return
  const result = scorePlayerGuess({
    isHost: multiplayerIsHost,
    round: currentMultiplayerRound,
    correctTrack: currentHostTrack,
    catalog: new Map(
      multiplayerCatalog.map(({ id, title, artist }) => [id, { title, artist }]),
    ),
    activePlayerIds: multiplayerRoundPlayerIds,
    finishedPlayerIds,
    attempts: multiplayerAttempts,
    triedAnswerIds: multiplayerTriedAnswerIds,
    scores: multiplayerScores,
    guess,
    now: Date.now(),
    roundDurationMs: currentGameRoundDuration * 1000,
    maxRoundScore: MAX_ROUND_SCORE,
  })
  if (!result) return
  renderMultiplayerLeaderboard()

  const connection = roomConnection

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

function handleAttemptResult(result: AttemptResult): void {
  if (
    multiplayerHostLeft
    || multiplayerGameOver
    || !currentMultiplayerRound
    || result.roundId !== currentMultiplayerRound.roundId
  ) {
    return
  }

  multiplayerScores.set(result.playerId, result.totalScore)
  renderMultiplayerLeaderboard()

  if (result.playerId !== multiplayerPlayerId) {
    return
  }

  ownAnswerResult = result

  const gameStatus = document.querySelector<HTMLParagraphElement>('#multiplayer-status')

  if (!gameStatus) {
    return
  }

  gameStatus.textContent = result.isCorrect
    ? 'Bonne réponse ! Résultat à venir…'
    : result.finished ? 'Plus aucun essai. Résultat à venir…' : 'Mauvaise réponse, réessaie.'

  document.querySelector<HTMLFormElement>('#multiplayer-guess-form')
    ?.dispatchEvent(new CustomEvent('multiplayer-attempt-result', { detail: result }))
}

function handleScoreUpdate(update: ScoreUpdate): void {
  if (update.roundId !== currentMultiplayerRound?.roundId) return
  multiplayerScores.set(update.playerId, update.totalScore)
  renderMultiplayerLeaderboard()
}

function handleRoundReveal(reveal: RoundReveal): void {
  if (!currentMultiplayerRound || reveal.roundId !== currentMultiplayerRound.roundId) return
  currentRoundReveal = reveal
  revealArtwork(document, reveal.imageUrl, `Cover de ${reveal.title} par ${reveal.artist}`)
  const status = document.querySelector<HTMLParagraphElement>('#multiplayer-status')
  if (status) {
    renderRoundResult(
      status,
      ownAnswerResult ? (ownAnswerResult.isCorrect ? 'correct' : 'wrong') : 'timeout',
      reveal.title,
      reveal.artist,
      ownAnswerResult?.isCorrect ? ownAnswerResult.addedScore : 0,
    )
  }
}

function handleRoundComplete(result: RoundComplete): void {
  if (
    multiplayerHostLeft
    || multiplayerGameOver
    || !currentMultiplayerRound
    || result.roundId !== currentMultiplayerRound.roundId
    || result.round !== currentMultiplayerRound.round
  ) {
    return
  }

  multiplayerRoundFinished = true
  cleanupMultiplayerRound()

  const roundIndex = result.round - 1
  const localOutcome: RoundOutcome = ownAnswerResult
    ? (ownAnswerResult.isCorrect ? 'correct' : 'failed')
    : 'timeout'
  const solution = currentRoundReveal
    ? { title: currentRoundReveal.title, artist: currentRoundReveal.artist }
    : currentHostTrack
      ? { title: currentHostTrack.title, artist: currentHostTrack.artist }
      : null

  if (solution) {
    multiplayerOwnRoundHistory[roundIndex] = localOutcome
    multiplayerOwnRoundRecap[roundIndex] = {
      outcome: localOutcome,
      guess: multiplayerLastOwnGuess,
      attemptsUsed: ownAnswerResult?.attemptsUsed ?? 0,
      solution,
    }
  }

  if (currentRoundReveal) {
    revealArtwork(document, currentRoundReveal.imageUrl, `Cover de ${currentRoundReveal.title} par ${currentRoundReveal.artist}`)
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

function handleGameOver(gameOver: GameOver): void {
  if (
    multiplayerGameOver
    || gameOver.gameId !== currentMultiplayerGameId
  ) {
    return
  }

  multiplayerGameOver = true
  cleanupMultiplayerRound()
  stopMultiplayerTransition()
  currentMultiplayerRound = null
  multiplayerRoundFinished = true

  app.innerHTML = `
    <main class="welcome welcome--result">
      <section class="welcome__content result-shell surface" aria-labelledby="multiplayer-result-title">
        <h1 id="multiplayer-result-title">Partie terminée</h1>
        <div class="result-progress">
          ${roundTimelineMarkup(currentGameRoundCount, multiplayerOwnRoundHistory, -1)}
          ${roundRecapMarkup(multiplayerOwnRoundRecap, currentGameRoundCount)}
        </div>
        <section class="leaderboard-section" aria-labelledby="multiplayer-final-title">
          <h2 id="multiplayer-final-title" class="leaderboard-heading">Classement final</h2>
          <ol id="multiplayer-final-leaderboard" class="leaderboard"></ol>
        </section>
        ${multiplayerIsHost
          ? '<p id="lobby-status" class="status" role="status" aria-live="polite"></p><div class="result-actions"><button id="replay-multiplayer-button" class="button-primary" type="button">Rejouer</button><button id="return-home-button" type="button" class="button-secondary">Retour à l\'accueil</button></div>'
          : '<p id="lobby-status" class="status" role="status" aria-live="polite">En attente de l\'hôte...</p><button id="return-home-button" class="button-secondary full-width" type="button">Retour à l\'accueil</button>'}
      </section>
    </main>
  `
  focusScreenHeading(app)

  const leaderboard = document.querySelector<HTMLOListElement>(
    '#multiplayer-final-leaderboard',
  )!
  renderFinalLeaderboard(leaderboard, gameOver.scores, multiplayerPlayerId)

  document.querySelector<HTMLButtonElement>('#return-home-button')!.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement
    button.disabled = true
    void leaveMultiplayerRoom()
  })

  const replayButton = document.querySelector<HTMLButtonElement>('#replay-multiplayer-button')

  replayButton?.addEventListener('click', async () => {
    replayButton.disabled = true

    try {
      await startMultiplayerGame()
    } catch (error) {
      console.error(error)
      await leaveMultiplayerRoom(
        error instanceof Error ? error.message : 'Impossible de relancer la partie.',
      )
    }
  })
}

function renderMultiplayerRound(round: MultiplayerRound): void {
  if (
    multiplayerHostLeft
    || multiplayerGameOver
    || round.gameId !== currentMultiplayerGameId
  ) {
    return
  }

  cleanupMultiplayerRound()
  currentMultiplayerRound = round
  currentRoundReveal = null
  ownAnswerResult = null
  multiplayerLastRoundId = round.roundId
  multiplayerCurrentRoundNumber = round.round
  finishedPlayerIds = new Set()
  multiplayerAttempts = new Map()
  multiplayerTriedAnswerIds = new Map()
  multiplayerRoundFinished = false
  multiplayerLastOwnGuess = null

  for (const playerId of multiplayerPlayerNames.keys()) {
    if (!multiplayerScores.has(playerId)) {
      multiplayerScores.set(playerId, 0)
    }
  }


  app.innerHTML = `
    <main class="welcome welcome--game">
      <section class="welcome__content game-shell" aria-labelledby="multiplayer-question-title">
        <header class="game-topbar">
          <p class="round-label">Manche ${round.round} / ${currentGameRoundCount}</p>
          <div class="game-topbar__right">
            <div class="game-volume">
              <label class="sr-only" for="volume-slider-round">Volume</label>
              ${renderVolumeControlMarkup('volume-slider-round', true)}
            </div>
          </div>
        </header>
        <div class="game-stage">
          ${renderArtworkMarkup()}
          <div class="progress">
            <p id="multiplayer-timer" class="progress__time is-countdown">La manche commence...</p>
            <div class="progress__track" aria-hidden="true">
              <div id="multiplayer-timer-progress" class="progress__bar"></div>
            </div>
          </div>
        </div>
        <p id="multiplayer-status" class="status" role="status" aria-live="polite"></p>
        <h1 id="multiplayer-question-title" class="sr-only">Quel est ce titre ?</h1>
        <div data-guess-area></div>
        <button id="play-audio-button" class="button-primary next-button" type="button" hidden>Lire l'extrait</button>
        <section class="leaderboard-section" aria-labelledby="leaderboard-title">
          <h2 id="leaderboard-title" class="leaderboard-heading">Classement</h2>
          <ol id="multiplayer-leaderboard" class="leaderboard"></ol>
        </section>
        <button id="leave-multiplayer-round-button" class="button-secondary leave-button" type="button">
          Quitter la partie
        </button>
      </section>
    </main>
  `
  focusScreenHeading(app)

  const gameStatus = document.querySelector<HTMLParagraphElement>('#multiplayer-status')!
  const gameTimer = document.querySelector<HTMLParagraphElement>('#multiplayer-timer')!
  const timerProgress = document.querySelector<HTMLDivElement>('#multiplayer-timer-progress')!
  const roundProgress = gameTimer.parentElement
  const leaveButton = document.querySelector<HTMLButtonElement>('#leave-multiplayer-round-button')!
  const playAudioButton = document.querySelector<HTMLButtonElement>('#play-audio-button')!
  let hasFinished = false
  let roundHasStarted = false
  let audioHasStarted = false
  let audioStartAttempted = false
  let waitingForResult = false
  const triedIds = new Set<string>()
  const roundDurationMs = currentGameRoundDuration * 1000

  setupVolumeControls()

  const guessArea = createGuessArea(document.querySelector<HTMLElement>('[data-guess-area]')!, {
    catalog: multiplayerCatalog,
    maxAttempts: MAX_ATTEMPTS,
    placeholder: 'Rechercher un titre ou un artiste…',
    formId: 'multiplayer-guess-form',
    canSkip: false,
  })
  const form = guessArea.form
  multiplayerGuessArea = guessArea
  guessArea.setDisabled(true)
  guessArea.setExcludedIds(triedIds)

  const isCurrentRound = (): boolean =>
    currentMultiplayerRound?.roundId === round.roundId
    && !multiplayerRoundFinished
    && !multiplayerHostLeft
    && !multiplayerGameOver

  renderMultiplayerLeaderboard()

  leaveButton.addEventListener('click', () => {
    leaveButton.disabled = true
    void leaveMultiplayerRoom()
  })

  const finishOwnRound = (message: string): void => {
    hasFinished = true
    guessArea.setDisabled(true)
    guessArea.setSubmitHidden(true)
    gameStatus.textContent = message
  }

  const onAttemptResult = (event: Event): void => {
    const result = (event as CustomEvent<AttemptResult>).detail
    if (result.roundId !== round.roundId || result.playerId !== multiplayerPlayerId) return
    waitingForResult = false
    guessArea.slots.setResult(
      result.attemptsUsed - 1,
      result.isCorrect ? 'correct' : 'wrong',
      multiplayerLastOwnGuess ? formatGuessOption(multiplayerLastOwnGuess) : '',
    )
    guessArea.announceRemaining(result.attemptsRemaining)
    guessArea.setExcludedIds(triedIds)
    if (result.finished) {
      finishOwnRound(result.isCorrect ? 'Bonne réponse ! Résultat à venir…' : 'Plus aucun essai. Résultat à venir…')
    } else {
      guessArea.clearInput()
      guessArea.setDisabled(false)
      guessArea.focusInput()
    }
  }
  form.addEventListener('multiplayer-attempt-result', onAttemptResult)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!isCurrentRound() || !roundHasStarted || hasFinished || waitingForResult) return
    const answer = guessArea.getSelectedOption()
    if (!answer) {
      guessArea.showError('Choisis un titre dans les suggestions.')
      return
    }
    if (triedIds.has(answer.id)) {
      guessArea.showError('Ce titre a déjà été essayé.')
      return
    }

    guessArea.clearError()
    triedIds.add(answer.id)
    guessArea.setExcludedIds(triedIds)
    multiplayerLastOwnGuess = answer
    waitingForResult = true
    guessArea.setDisabled(true)
    gameStatus.textContent = 'Vérification…'
    void roomConnection?.sendGuess({ roundId: round.roundId, guessId: createId(), answerId: answer.id })
      .catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('La connexion multijoueur a été interrompue.')
      })
  })

  const audio = new Audio(round.audioUrl)
  audio.volume = currentVolume
  audio.preload = 'auto'
  audio.addEventListener('error', () => {
    if (isCurrentRound() && !hasFinished) {
      gameStatus.textContent = 'Impossible de charger l’extrait audio.'
      playAudioButton.hidden = false
    }
  })

  try {
    audio.load()
  } catch (error) {
    console.error(error)
    gameStatus.textContent = 'Impossible de charger l’extrait audio.'
    playAudioButton.hidden = false
  }

  multiplayerAudio = audio

  const startAudio = async (): Promise<void> => {
    if (!isCurrentRound() || audioHasStarted || audioStartAttempted || !roundHasStarted) {
      return
    }

    const elapsedTime = getEstimatedHostNow() - round.startAt

    if (elapsedTime >= roundDurationMs) return

    if (audio.readyState < 1) {
      audio.addEventListener('loadedmetadata', () => {
        void startAudio()
      }, { once: true })
      return
    }

    audioStartAttempted = true
    const expectedAudioPosition = Math.max(0, elapsedTime / 1000)

    try {
      audio.currentTime = expectedAudioPosition
    } catch (error) {
      audioStartAttempted = false
      console.error(error)
      gameStatus.textContent = 'Impossible de positionner l’extrait audio.'
      playAudioButton.hidden = false
      return
    }

    try {
      await audio.play()

      if (!isCurrentRound()) {
        audio.pause()
        return
      }

      if (getEstimatedHostNow() - round.startAt >= roundDurationMs) {
        audio.pause()
        return
      }

      audioHasStarted = true
      playAudioButton.hidden = true
    } catch (error) {
      audioStartAttempted = false
      console.error(error)

      if (!isCurrentRound()) {
        return
      }

      gameStatus.textContent = 'Lecture audio bloquée par le navigateur.'
      playAudioButton.hidden = false
    }
  }

  playAudioButton.addEventListener('click', () => {
    void startAudio()
  })

  function startRoundAudio(): void {
    if (!isCurrentRound() || roundHasStarted) {
      return
    }

    const elapsedTime = getEstimatedHostNow() - round.startAt

    if (elapsedTime < 0) {
      scheduleRoundStart()
      return
    }

    roundHasStarted = true
    gameTimer.classList.remove('is-countdown')
    guessArea.setDisabled(false)
    guessArea.focusInput()
    void startAudio()
  }

  function scheduleRoundStart(): void {
    if (!isCurrentRound() || roundHasStarted) {
      return
    }

    if (multiplayerStartTimeoutId !== null) {
      window.clearTimeout(multiplayerStartTimeoutId)
    }

    const delay = Math.max(0, round.startAt - getEstimatedHostNow())
    multiplayerStartTimeoutId = window.setTimeout(() => {
      multiplayerStartTimeoutId = null
      startRoundAudio()
    }, delay)
  }

  const updateMultiplayerTimer = (): void => {
    if (!isCurrentRound()) {
      return
    }

    const now = getEstimatedHostNow()

    if (!roundHasStarted) {
      const timeUntilStart = round.startAt - now

      if (timeUntilStart > 0) {
        gameTimer.textContent = `${Math.ceil(timeUntilStart / 1000)}…`
        timerProgress.style.transform = 'scaleX(1)'
        roundProgress?.classList.remove('is-low')
        return
      }

      startRoundAudio()
    }

    const remainingTime = Math.max(
      0,
      round.startAt + roundDurationMs - getEstimatedHostNow(),
    )
    gameTimer.textContent = formatRemainingTime(remainingTime)
    timerProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, remainingTime / roundDurationMs))})`
    roundProgress?.classList.toggle('is-low', remainingTime > 0 && remainingTime <= 5000)

    if (remainingTime <= 0) {
      if (!hasFinished) {
        ownAnswerResult = null
        finishOwnRound('Temps écoulé. Résultat à venir…')
      }
      if (multiplayerIsHost) {
        for (const playerId of multiplayerRoundPlayerIds) finishedPlayerIds.add(playerId)
        checkMultiplayerRoundCompletion()
      }
    }
  }

  multiplayerTimerId = window.setInterval(updateMultiplayerTimer, 100)
  scheduleRoundStart()
  updateMultiplayerTimer()
}

function renderLobby(roomCode: string, isHost: boolean): void {
  app.innerHTML = `
    <main class="welcome welcome--lobby">
      <section class="welcome__content lobby-shell surface" aria-labelledby="lobby-title">
        <h1 id="lobby-title">Lobby</h1>

        <div class="lobby-code">
          <span id="room-code-display" class="room-code-value">${roomCode}</span>
          <button id="copy-room-code-button" class="button-ghost" type="button">Copier</button>
        </div>

        <div class="lobby-rules">
          <div class="lobby-rule">
            <span class="field-label">Thème</span>
            ${isHost
              ? `<select id="lobby-theme-select" name="musicTheme">${MUSIC_THEMES.map(
                  (theme) =>
                    `<option value="${theme}"${theme === multiplayerMusicTheme ? ' selected' : ''}>${MUSIC_THEME_LABELS[theme]}</option>`,
                ).join('')}</select>`
              : `<span id="lobby-theme-value" class="lobby-rule__value">${MUSIC_THEME_LABELS[multiplayerMusicTheme]}</span>`}
          </div>
          <div class="lobby-rule">
            <span class="field-label">Manches</span>
            ${isHost
              ? `<select id="lobby-round-count" name="roundCount">${ROUND_COUNT_OPTIONS.map(
                  (count) =>
                    `<option value="${count}"${count === multiplayerRoundCount ? ' selected' : ''}>${count}</option>`,
                ).join('')}</select>`
              : `<span id="lobby-round-count-value" class="lobby-rule__value">${multiplayerRoundCount}</span>`}
          </div>
          <div class="lobby-rule">
            <span class="field-label">Durée</span>
            ${isHost
              ? `<select id="lobby-round-duration" name="roundDuration">${ROUND_DURATION_OPTIONS.map(
                  (duration) => `<option value="${duration}"${duration === multiplayerRoundDuration ? ' selected' : ''}>${duration} s</option>`,
                ).join('')}</select>`
              : `<span id="lobby-round-duration-value" class="lobby-rule__value">${multiplayerRoundDuration} s</span>`}
          </div>
        </div>

        <h2 class="lobby-heading lobby-players-heading">Joueurs <span id="players-count" class="player-count"></span></h2>

        <ul id="players-list" class="players-list" aria-live="polite">
          <li>Connexion...</li>
        </ul>

        <p id="lobby-status" class="status" role="status" aria-live="polite">Connexion à la partie...</p>

        <div class="lobby-actions${isHost ? '' : ' lobby-actions--single'}">
          ${isHost ? '<button id="start-game-button" class="button-primary start-game-button" type="button" disabled>Commencer la partie</button>' : ''}
          <button id="leave-room-button" class="button-secondary leave-button" type="button" disabled>
            Quitter la partie
          </button>
        </div>
      </section>
    </main>
  `
  focusScreenHeading(app)

  const startButton = document.querySelector<HTMLButtonElement>('#start-game-button')
  const leaveButton = document.querySelector<HTMLButtonElement>('#leave-room-button')!
  const copyButton = document.querySelector<HTMLButtonElement>('#copy-room-code-button')!
  const lobbyStatus = document.querySelector<HTMLParagraphElement>('#lobby-status')!
  const themeSelect = document.querySelector<HTMLSelectElement>('#lobby-theme-select')
  const roundCountSelect = document.querySelector<HTMLSelectElement>('#lobby-round-count')
  const roundDurationSelect = document.querySelector<HTMLSelectElement>('#lobby-round-duration')

  const pushGameSettings = (): void => {
    void roomConnection?.updateGameSettings({
      musicTheme: multiplayerMusicTheme,
      roundCount: multiplayerRoundCount,
      roundDuration: multiplayerRoundDuration,
    }).catch((error) => {
      console.error(error)
      lobbyStatus.textContent = 'Impossible de mettre à jour les réglages.'
    })
  }

  themeSelect?.addEventListener('change', () => {
    const theme = themeSelect.value

    if (!isMusicTheme(theme)) {
      return
    }

    multiplayerMusicTheme = theme
    pushGameSettings()
  })

  roundCountSelect?.addEventListener('change', () => {
    const roundCount = Number(roundCountSelect.value)

    if (!isRoundCount(roundCount)) {
      return
    }

    multiplayerRoundCount = roundCount
    pushGameSettings()
  })

  roundDurationSelect?.addEventListener('change', () => {
    const duration = Number(roundDurationSelect.value)
    if (!isRoundDuration(duration)) return
    multiplayerRoundDuration = duration
    pushGameSettings()
  })

  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard indisponible')
      }

      await navigator.clipboard.writeText(roomCode)
      lobbyStatus.textContent = 'Code copié !'
    } catch (error) {
      console.error(error)
      lobbyStatus.textContent = 'Impossible de copier automatiquement.'
    } finally {
      copyButton.disabled = false
    }
  })

  startButton?.addEventListener('click', async () => {
    startButton.disabled = true

    try {
      await startMultiplayerGame()
    } catch (error) {
      console.error(error)
      await leaveMultiplayerRoom(
        error instanceof Error ? error.message : 'Impossible de charger la partie.',
      )
    }
  })

  leaveButton.addEventListener('click', () => {
    leaveButton.disabled = true
    void leaveMultiplayerRoom()
  })
}

async function openRoom(roomCode: string, playerName: string, isHost: boolean): Promise<void> {
  try {
    multiplayerMusicTheme = DEFAULT_MUSIC_THEME
    multiplayerRoundCount = DEFAULT_ROUND_COUNT
    multiplayerRoundDuration = DEFAULT_ROUND_DURATION
    renderLobby(roomCode, isHost)

    multiplayerClockOffsetMs = 0
    multiplayerHostSeen = false
    multiplayerHostId = null
    multiplayerHostLeft = false
    multiplayerGameOver = false
    multiplayerLastRoundId = null
    currentMultiplayerGameId = null
    const playerId = createId()
    const startButton = document.querySelector<HTMLButtonElement>('#start-game-button')
    const leaveButton = document.querySelector<HTMLButtonElement>('#leave-room-button')!
    multiplayerPlayerId = playerId
    multiplayerIsHost = isHost

    roomConnection = await joinRoom(
      roomCode,
      playerId,
      playerName,
      isHost,
      {
        musicTheme: multiplayerMusicTheme,
        roundCount: multiplayerRoundCount,
        roundDuration: multiplayerRoundDuration,
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
      startButton.disabled = multiplayerPlayerNames.size < 2
    }
    leaveButton.disabled = false

    if (!isHost) {
      synchronizeMultiplayerClock(roomConnection)
    }
  } catch (error) {
    console.error(error)
    cleanupMultiplayerRound()
    stopMultiplayerTransition()
    roomConnection = null
    multiplayerPlayerId = null
    multiplayerIsHost = false
    multiplayerClockOffsetMs = 0
    multiplayerClockSyncPromise = null
    multiplayerHostSeen = false
    multiplayerHostId = null
    multiplayerHostLeft = false
    multiplayerGameOver = false
    multiplayerLastRoundId = null
    currentMultiplayerGameId = null
    renderHome(error instanceof Error ? error.message : 'Impossible de rejoindre cette partie.')
  }
}

function renderHome(initialStatus = ''): void {
  const highScore = readHighScore(selectedRoundCount)

  app.innerHTML = `
    <main class="welcome welcome--home">
      <section class="welcome__content home-shell" aria-labelledby="page-title">
        <header class="home-heading">
          <h1 id="page-title" class="home-title">Blindtest</h1>
          <p class="welcome__description">Teste ta culture musicale.</p>
          <p id="home-high-score" class="high-score"${highScore > 0 ? '' : ' hidden'}>Meilleur score · ${selectedRoundCount} manches <strong>${formatScore(highScore)}</strong></p>
        </header>

        <div class="home-settings">
          ${renderThemeSelectMarkup('solo-theme-select', selectedTheme)}
          ${renderRoundCountSelectMarkup('solo-round-count', selectedRoundCount)}
          ${renderRoundDurationSelectMarkup('solo-round-duration', selectedRoundDuration)}
          <div class="form-field home-settings__volume">
            <label for="volume-slider">Volume</label>
            ${renderVolumeControlMarkup('volume-slider')}
          </div>
        </div>

        <button id="start-button" class="button-primary solo-button" type="button">Jouer en solo</button>
        <p id="solo-status" class="status" role="status" aria-live="polite"></p>

        <div class="section-divider" aria-hidden="true"><span>Multijoueur</span></div>

        <form id="multiplayer-form" class="multiplayer-form">
          <div class="form-field">
            <label for="player-name">Pseudo</label>
            <input id="player-name" name="playerName" type="text" maxlength="20" autocomplete="nickname" placeholder="Ton pseudo" />
          </div>
          <div class="form-field">
            <label for="room-code">Code de partie</label>
            <input id="room-code" class="room-code-input" name="roomCode" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="K7FD" />
          </div>
          <div class="multiplayer-actions">
            <button type="submit" class="button-primary">Rejoindre</button>
            <button id="create-room-button" class="button-secondary" type="button">Créer une partie</button>
          </div>
          <p id="home-status" class="status" role="status" aria-live="polite"></p>
        </form>
      </section>
    </main>
  `
  focusScreenHeading(app)

  const startButton = document.querySelector<HTMLButtonElement>('#start-button')!
  const multiplayerForm = document.querySelector<HTMLFormElement>('#multiplayer-form')!
  const roomCodeInput = document.querySelector<HTMLInputElement>('#room-code')!
  const playerNameInput = document.querySelector<HTMLInputElement>('#player-name')!
  const createRoomButton = document.querySelector<HTMLButtonElement>('#create-room-button')!
  const joinButton = multiplayerForm.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const statusMessage = document.querySelector<HTMLParagraphElement>('#home-status')!
  const soloStatusMessage = document.querySelector<HTMLParagraphElement>('#solo-status')!
  const soloThemeSelect = document.querySelector<HTMLSelectElement>('#solo-theme-select')!
  const soloRoundCountSelect = document.querySelector<HTMLSelectElement>('#solo-round-count')!
  const soloRoundDurationSelect = document.querySelector<HTMLSelectElement>('#solo-round-duration')!

  setStatusMessage(statusMessage, initialStatus, initialStatus.length > 0)

  setupVolumeControls()

  soloThemeSelect.addEventListener('change', () => {
    const theme = soloThemeSelect.value

    if (!isMusicTheme(theme)) {
      return
    }

    selectedTheme = theme
    localStorage.setItem(MUSIC_THEME_KEY, theme)
  })

  soloRoundCountSelect.addEventListener('change', () => {
    const roundCount = Number(soloRoundCountSelect.value)

    if (!isRoundCount(roundCount)) {
      return
    }

    selectedRoundCount = roundCount
    localStorage.setItem(ROUND_COUNT_KEY, String(roundCount))
    updateHomeHighScore()
  })

  soloRoundDurationSelect.addEventListener('change', () => {
    const duration = Number(soloRoundDurationSelect.value)
    if (!isRoundDuration(duration)) return
    selectedRoundDuration = duration
    localStorage.setItem(ROUND_DURATION_KEY, String(duration))
  })

  const setControlsDisabled = (disabled: boolean): void => {
    startButton.disabled = disabled
    roomCodeInput.disabled = disabled
    playerNameInput.disabled = disabled
    createRoomButton.disabled = disabled
    joinButton.disabled = disabled
    createRoomButton.textContent = disabled ? 'Connexion...' : 'Créer une partie'
    joinButton.textContent = disabled ? 'Connexion...' : 'Rejoindre'
  }

  roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = normalizeRoomCode(roomCodeInput.value).slice(0, 4)
    roomCodeInput.removeAttribute('aria-invalid')
  })

  playerNameInput.addEventListener('input', () => {
    playerNameInput.removeAttribute('aria-invalid')
  })

  startButton.addEventListener('click', async () => {
    startButton.disabled = true
    startButton.textContent = 'Chargement...'
    setStatusMessage(soloStatusMessage, '')

    try {
      await soloGame.start(selectedTheme, selectedRoundCount, selectedRoundDuration)
    } catch (error) {
      console.error(error)
      setStatusMessage(
        soloStatusMessage,
        error instanceof Error ? error.message : 'Impossible de lancer la partie.',
        true,
      )
      startButton.textContent = 'Jouer en solo'
    } finally {
      startButton.disabled = false
    }
  })

  createRoomButton.addEventListener('click', async () => {
    const playerName = normalizePlayerName(playerNameInput.value)
    playerNameInput.value = playerName

    if (!isValidPlayerName(playerName)) {
      setStatusMessage(statusMessage, 'Le pseudo doit contenir entre 2 et 20 caractères.', true)
      playerNameInput.setAttribute('aria-invalid', 'true')
      playerNameInput.focus()
      return
    }

    const roomCode = generateRoomCode()
    roomCodeInput.value = roomCode
    setControlsDisabled(true)
    await openRoom(roomCode, playerName, true)
  })

  multiplayerForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const roomCode = normalizeRoomCode(roomCodeInput.value)
    const playerName = normalizePlayerName(playerNameInput.value)
    roomCodeInput.value = roomCode
    playerNameInput.value = playerName

    if (!isValidPlayerName(playerName)) {
      setStatusMessage(statusMessage, 'Le pseudo doit contenir entre 2 et 20 caractères.', true)
      playerNameInput.setAttribute('aria-invalid', 'true')
      playerNameInput.focus()
      return
    }

    if (!isValidRoomCode(roomCode)) {
      setStatusMessage(statusMessage, 'Code de partie invalide.', true)
      roomCodeInput.setAttribute('aria-invalid', 'true')
      roomCodeInput.focus()
      return
    }

    setControlsDisabled(true)
    await openRoom(roomCode, playerName, false)
  })
}

renderHome()
