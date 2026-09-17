import { isMusicTheme } from '../api'
import { app, bindFieldReset, bindSelect, qs, requireElement } from '../dom'
import { isRoundCount, isRoundDuration } from '../game'
import { openRoom } from '../multiplayer/session'
import { volume } from '../services'
import { revealArtwork } from '../shared/artwork'
import { roundCountChoices, roundDurationChoices, themeChoices } from '../shared/choices'
import { renderSelect } from '../shared/markup'
import { renderRoundResult } from '../shared/round-result'
import {
  generateRoomCode, isValidPlayerName, isValidRoomCode, normalizePlayerName, normalizeRoomCode,
} from '../shared/room'
import {
  readHighScore, saveHighScoreIfNeeded, storeMusicTheme, storeRoundCount, storeRoundDuration,
} from '../shared/storage'
import { createSoloGame, type SoloGame } from '../solo'
import { state } from '../state'
import { focusScreenHeading, formatScore, setStatusMessage } from '../ui'
import { asValid } from '../shared/validate'

const PLAYER_NAME_ERROR = 'Le pseudo doit contenir entre 2 et 20 caractères.'

function updateHomeHighScore(): void {
  const element = qs<HTMLParagraphElement>('#home-high-score')
  if (!element) return

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
          ${renderSelect('solo-theme-select', 'Thème', themeChoices, state.selectedTheme, 'musicTheme')}
          ${renderSelect('solo-round-count', 'Manches', roundCountChoices, state.selectedRoundCount, 'roundCount')}
          ${renderSelect('solo-round-duration', 'Durée', roundDurationChoices, state.selectedRoundDuration, 'roundDuration')}
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
    </main>`
  focusScreenHeading(app)

  const startButton = requireElement<HTMLButtonElement>('#start-button')
  const multiplayerForm = requireElement<HTMLFormElement>('#multiplayer-form')
  const roomCodeInput = requireElement<HTMLInputElement>('#room-code')
  const playerNameInput = requireElement<HTMLInputElement>('#player-name')
  const createRoomButton = requireElement<HTMLButtonElement>('#create-room-button')
  const joinButton = requireElement<HTMLButtonElement>('button[type="submit"]', multiplayerForm)
  const statusMessage = requireElement<HTMLParagraphElement>('#home-status')
  const soloStatusMessage = requireElement<HTMLParagraphElement>('#solo-status')

  setStatusMessage(statusMessage, initialStatus, initialStatus.length > 0)
  volume.setupControls()

  bindSelect(qs('#solo-theme-select'), (raw) => asValid(raw, isMusicTheme), (theme) => {
    state.selectedTheme = theme
    storeMusicTheme(theme)
  })
  bindSelect(qs('#solo-round-count'), (raw) => asValid(Number(raw), isRoundCount), (count) => {
    state.selectedRoundCount = count
    storeRoundCount(count)
    updateHomeHighScore()
  })
  bindSelect(qs('#solo-round-duration'), (raw) => asValid(Number(raw), isRoundDuration), (duration) => {
    state.selectedRoundDuration = duration
    storeRoundDuration(duration)
  })

  roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = normalizeRoomCode(roomCodeInput.value).slice(0, 4)
  })
  bindFieldReset(roomCodeInput, playerNameInput)

  const setControlsDisabled = (disabled: boolean): void => {
    for (const control of [startButton, roomCodeInput, playerNameInput, createRoomButton, joinButton]) {
      control.disabled = disabled
    }
    createRoomButton.textContent = disabled ? 'Connexion…' : 'Créer une partie'
    joinButton.textContent = disabled ? 'Connexion…' : 'Rejoindre'
  }

  const showFieldError = (input: HTMLInputElement, message: string): void => {
    setStatusMessage(statusMessage, message, true)
    input.setAttribute('aria-invalid', 'true')
    input.setAttribute('aria-describedby', 'home-status')
    input.focus()
  }

  const readPlayerName = (): string => {
    const name = normalizePlayerName(playerNameInput.value)
    playerNameInput.value = name
    return name
  }

  startButton.addEventListener('click', async () => {
    startButton.disabled = true
    startButton.textContent = 'Chargement...'
    setStatusMessage(soloStatusMessage, '')

    try {
      await soloGame.start(
        state.selectedTheme, state.selectedRoundCount, state.selectedRoundDuration,
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(soloStatusMessage, error instanceof Error
        ? error.message : 'Impossible de lancer la partie.', true)
      startButton.textContent = 'Jouer en solo'
    } finally {
      startButton.disabled = false
    }
  })

  createRoomButton.addEventListener('click', async () => {
    const playerName = readPlayerName()
    if (!isValidPlayerName(playerName)) return showFieldError(playerNameInput, PLAYER_NAME_ERROR)

    const roomCode = generateRoomCode()
    roomCodeInput.value = roomCode
    setControlsDisabled(true)
    await openRoom(roomCode, playerName, true)
  })

  multiplayerForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const playerName = readPlayerName()
    if (!isValidPlayerName(playerName)) return showFieldError(playerNameInput, PLAYER_NAME_ERROR)

    const roomCode = normalizeRoomCode(roomCodeInput.value)
    roomCodeInput.value = roomCode
    if (!isValidRoomCode(roomCode)) return showFieldError(roomCodeInput, 'Code de partie invalide.')

    setControlsDisabled(true)
    await openRoom(roomCode, playerName, false)
  })
}
