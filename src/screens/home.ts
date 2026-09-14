import {
  isMusicMarket,
  isMusicTheme,
  MUSIC_MARKET_LABELS,
  MUSIC_MARKETS,
  MUSIC_THEMES,
  MUSIC_THEME_LABELS,
  type MusicMarket,
  type MusicTheme,
} from '../api'
import { app } from '../dom'
import {
  isRoundCount,
  isRoundDuration,
  ROUND_COUNT_OPTIONS,
  ROUND_DURATION_OPTIONS,
  type RoundCount,
  type RoundDuration,
} from '../game'
import { openRoom } from '../multiplayer/session'
import { volume } from '../services'
import { renderArtworkMarkup, revealArtwork } from '../shared/artwork'
import { renderRoundResult } from '../shared/round-result'
import {
  generateRoomCode,
  isValidPlayerName,
  isValidRoomCode,
  normalizePlayerName,
  normalizeRoomCode,
} from '../shared/room'
import {
  readHighScore,
  saveHighScoreIfNeeded,
  storeMusicMarket,
  storeMusicTheme,
  storeRoundCount,
  storeRoundDuration,
} from '../shared/storage'
import { createSoloGame, type SoloGame } from '../solo'
import { state } from '../state'
import { focusScreenHeading, formatScore, setStatusMessage } from '../ui'

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

function renderMarketSelectMarkup(selectId: string, selected: MusicMarket): string {
  const options = MUSIC_MARKETS.map(
    (market) =>
      `<option value="${market}"${market === selected ? ' selected' : ''}>${MUSIC_MARKET_LABELS[market]}</option>`,
  ).join('')

  return `
    <div class="form-field">
      <label for="${selectId}">Catalogue</label>
      <select id="${selectId}" name="musicMarket">${options}</select>
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

  const value = readHighScore(state.selectedRoundCount)
  element.hidden = value <= 0

  const strong = document.createElement('strong')
  strong.textContent = formatScore(value)
  element.replaceChildren(`Meilleur score · ${state.selectedRoundCount} manches `, strong)
}

export const soloGame: SoloGame = createSoloGame({
  app,
  getVolume: () => volume.get(),
  setupVolumeControls: () => volume.setupControls(),
  renderVolumeControlMarkup: (id, compact) => volume.renderMarkup(id, compact),
  renderArtworkMarkup,
  revealArtwork,
  renderRoundResult,
  readHighScore,
  saveHighScore: saveHighScoreIfNeeded,
  renderHome: () => renderHome(),
})

export function renderHome(initialStatus = ''): void {
  const highScore = readHighScore(state.selectedRoundCount)

  app.innerHTML = `
    <main class="welcome welcome--home">
      <section class="welcome__content home-shell" aria-labelledby="page-title">
        <header class="home-heading">
          <h1 id="page-title" class="home-title">Blindtest</h1>
          <p class="welcome__description">Teste ta culture musicale.</p>
          <p id="home-high-score" class="high-score"${highScore > 0 ? '' : ' hidden'}>Meilleur score · ${state.selectedRoundCount} manches <strong>${formatScore(highScore)}</strong></p>
        </header>

        <div class="home-settings">
          ${renderThemeSelectMarkup('solo-theme-select', state.selectedTheme)}
          ${renderMarketSelectMarkup('solo-market-select', state.selectedMarket)}
          ${renderRoundCountSelectMarkup('solo-round-count', state.selectedRoundCount)}
          ${renderRoundDurationSelectMarkup('solo-round-duration', state.selectedRoundDuration)}
          <div class="form-field home-settings__volume">
            <label for="volume-slider">Volume</label>
            ${volume.renderMarkup('volume-slider')}
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
  const soloMarketSelect = document.querySelector<HTMLSelectElement>('#solo-market-select')!
  const soloRoundCountSelect = document.querySelector<HTMLSelectElement>('#solo-round-count')!
  const soloRoundDurationSelect = document.querySelector<HTMLSelectElement>('#solo-round-duration')!

  setStatusMessage(statusMessage, initialStatus, initialStatus.length > 0)

  volume.setupControls()

  soloThemeSelect.addEventListener('change', () => {
    const theme = soloThemeSelect.value

    if (!isMusicTheme(theme)) {
      return
    }

    state.selectedTheme = theme
    storeMusicTheme(theme)
  })

  soloMarketSelect.addEventListener('change', () => {
    const market = soloMarketSelect.value

    if (!isMusicMarket(market)) {
      return
    }

    state.selectedMarket = market
    storeMusicMarket(market)
  })

  soloRoundCountSelect.addEventListener('change', () => {
    const roundCount = Number(soloRoundCountSelect.value)

    if (!isRoundCount(roundCount)) {
      return
    }

    state.selectedRoundCount = roundCount
    storeRoundCount(roundCount)
    updateHomeHighScore()
  })

  soloRoundDurationSelect.addEventListener('change', () => {
    const duration = Number(soloRoundDurationSelect.value)
    if (!isRoundDuration(duration)) return
    state.selectedRoundDuration = duration
    storeRoundDuration(duration)
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
      await soloGame.start(
        state.selectedTheme,
        state.selectedMarket,
        state.selectedRoundCount,
        state.selectedRoundDuration,
      )
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
