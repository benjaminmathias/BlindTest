import {
  isMusicTheme,
  MUSIC_THEMES,
  MUSIC_THEME_LABELS,
} from '../api'
import { app } from '../dom'
import {
  isRoundCount,
  isRoundDuration,
  ROUND_COUNT_OPTIONS,
  ROUND_DURATION_OPTIONS,
} from '../game'
import { leaveMultiplayerRoom, startMultiplayerGame } from '../multiplayer/session'
import { state } from '../state'
import { focusScreenHeading } from '../ui'

export function renderLobby(roomCode: string, isHost: boolean): void {
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
                    `<option value="${theme}"${theme === state.multiplayerMusicTheme ? ' selected' : ''}>${MUSIC_THEME_LABELS[theme]}</option>`,
                ).join('')}</select>`
              : `<span id="lobby-theme-value" class="lobby-rule__value">${MUSIC_THEME_LABELS[state.multiplayerMusicTheme]}</span>`}
          </div>
          <div class="lobby-rule">
            <span class="field-label">Manches</span>
            ${isHost
              ? `<select id="lobby-round-count" name="roundCount">${ROUND_COUNT_OPTIONS.map(
                  (count) =>
                    `<option value="${count}"${count === state.multiplayerRoundCount ? ' selected' : ''}>${count}</option>`,
                ).join('')}</select>`
              : `<span id="lobby-round-count-value" class="lobby-rule__value">${state.multiplayerRoundCount}</span>`}
          </div>
          <div class="lobby-rule">
            <span class="field-label">Durée</span>
            ${isHost
              ? `<select id="lobby-round-duration" name="roundDuration">${ROUND_DURATION_OPTIONS.map(
                  (duration) => `<option value="${duration}"${duration === state.multiplayerRoundDuration ? ' selected' : ''}>${duration} s</option>`,
                ).join('')}</select>`
              : `<span id="lobby-round-duration-value" class="lobby-rule__value">${state.multiplayerRoundDuration} s</span>`}
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
    void state.roomConnection?.updateGameSettings({
      musicTheme: state.multiplayerMusicTheme,
      roundCount: state.multiplayerRoundCount,
      roundDuration: state.multiplayerRoundDuration,
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

    state.multiplayerMusicTheme = theme
    pushGameSettings()
  })

  roundCountSelect?.addEventListener('change', () => {
    const roundCount = Number(roundCountSelect.value)

    if (!isRoundCount(roundCount)) {
      return
    }

    state.multiplayerRoundCount = roundCount
    pushGameSettings()
  })

  roundDurationSelect?.addEventListener('change', () => {
    const duration = Number(roundDurationSelect.value)
    if (!isRoundDuration(duration)) return
    state.multiplayerRoundDuration = duration
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
