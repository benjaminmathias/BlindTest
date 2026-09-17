import { isMusicTheme, MUSIC_THEME_LABELS } from '../api'
import { app, bindSelect, qs, requireElement } from '../dom'
import { isRoundCount, isRoundDuration } from '../game'
import { leaveMultiplayerRoom, startMultiplayerGame } from '../multiplayer/session'
import { roundCountChoices, roundDurationChoices, themeChoices } from '../shared/choices'
import { renderOptions, type SelectOption } from '../shared/markup'
import { asValid } from '../shared/validate'
import { state } from '../state'
import { focusScreenHeading } from '../ui'

const hostSelect = (id: string, name: string, options: readonly SelectOption[], selected: string | number): string =>
  `<select id="${id}" name="${name}">${renderOptions(options, selected)}</select>`

const guestValue = (id: string, value: string): string =>
  `<span id="${id}" class="lobby-rule__value">${value}</span>`

const rule = (label: string, control: string): string =>
  `<div class="lobby-rule"><span class="field-label">${label}</span>${control}</div>`

export function renderLobby(roomCode: string, isHost: boolean): void {
  app.innerHTML = `
    <main class="welcome welcome--lobby">
      <section class="welcome__content lobby-shell surface" aria-labelledby="lobby-title">
        <h1 id="lobby-title">Lobby</h1>

        <div class="lobby-code">
          <span id="room-code-display" class="room-code-value">${roomCode}</span>
          <button id="copy-room-code-button" class="button-ghost" type="button" aria-label="Copier le code de la partie">Copier</button>
        </div>

        <div class="lobby-rules">
          ${rule('Thème', isHost
            ? hostSelect('lobby-theme-select', 'musicTheme', themeChoices, state.multiplayerMusicTheme)
            : guestValue('lobby-theme-value', MUSIC_THEME_LABELS[state.multiplayerMusicTheme]))}
          ${rule('Manches', isHost
            ? hostSelect('lobby-round-count', 'roundCount', roundCountChoices, state.multiplayerRoundCount)
            : guestValue('lobby-round-count-value', String(state.multiplayerRoundCount)))}
          ${rule('Durée', isHost
            ? hostSelect('lobby-round-duration', 'roundDuration', roundDurationChoices, state.multiplayerRoundDuration)
            : guestValue('lobby-round-duration-value', `${state.multiplayerRoundDuration} s`))}
        </div>

        <h2 class="lobby-heading lobby-players-heading">Joueurs <span id="players-count" class="player-count"></span></h2>

        <ul id="players-list" class="players-list" aria-live="polite">
          <li>Connexion…</li>
        </ul>

        <p id="lobby-status" class="status" role="status" aria-live="polite">Connexion à la partie…</p>

        <div class="lobby-actions${isHost ? '' : ' lobby-actions--single'}">
          ${isHost ? '<button id="start-game-button" class="button-primary start-game-button" type="button" disabled>Commencer la partie</button>' : ''}
          <button id="leave-room-button" class="button-secondary leave-button" type="button" disabled>
            Quitter la partie
          </button>
        </div>
      </section>
    </main>`
  focusScreenHeading(app)

  const startButton = qs<HTMLButtonElement>('#start-game-button')
  const leaveButton = requireElement<HTMLButtonElement>('#leave-room-button')
  const copyButton = requireElement<HTMLButtonElement>('#copy-room-code-button')
  const lobbyStatus = requireElement<HTMLParagraphElement>('#lobby-status')

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

  bindSelect(qs('#lobby-theme-select'), (raw) => asValid(raw, isMusicTheme), (theme) => {
    state.multiplayerMusicTheme = theme
    pushGameSettings()
  })
  bindSelect(qs('#lobby-round-count'), (raw) => asValid(Number(raw), isRoundCount), (count) => {
    state.multiplayerRoundCount = count
    pushGameSettings()
  })
  bindSelect(qs('#lobby-round-duration'), (raw) => asValid(Number(raw), isRoundDuration), (duration) => {
    state.multiplayerRoundDuration = duration
    pushGameSettings()
  })

  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true
    try {
      if (!navigator.clipboard) throw new Error('Clipboard indisponible')
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
      await leaveMultiplayerRoom(error instanceof Error
        ? error.message : 'Impossible de charger la partie.')
    }
  })

  leaveButton.addEventListener('click', () => {
    leaveButton.disabled = true
    void leaveMultiplayerRoom()
  })
}
