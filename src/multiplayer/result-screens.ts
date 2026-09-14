import { app } from '../dom'
import { roundRecapMarkup, roundTimelineMarkup } from '../guess-ui'
import { state } from '../state'
import { focusScreenHeading } from '../ui'
import { renderFinalLeaderboard } from './game-ui'
import type { GameOver } from './realtime'
import {
  cleanupMultiplayerRound,
  leaveMultiplayerRoom,
  startMultiplayerGame,
  stopMultiplayerTransition,
} from './session'

export function handleMultiplayerHostLeft(): void {
  if (state.multiplayerHostLeft) {
    return
  }

  state.multiplayerHostLeft = true
  state.multiplayerGameOver = true
  state.multiplayerRoundFinished = true
  state.currentMultiplayerRound = null
  cleanupMultiplayerRound()
  stopMultiplayerTransition()
  state.multiplayerClockSyncPromise = null

  const connection = state.roomConnection
  state.roomConnection = null
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

export function handleGameOver(gameOver: GameOver): void {
  if (
    state.multiplayerGameOver
    || gameOver.gameId !== state.currentMultiplayerGameId
  ) {
    return
  }

  state.multiplayerGameOver = true
  cleanupMultiplayerRound()
  stopMultiplayerTransition()
  state.currentMultiplayerRound = null
  state.multiplayerRoundFinished = true

  app.innerHTML = `
    <main class="welcome welcome--result">
      <section class="welcome__content result-shell surface" aria-labelledby="multiplayer-result-title">
        <h1 id="multiplayer-result-title">Partie terminée</h1>
        <div class="result-progress">
          ${roundTimelineMarkup(state.currentGameRoundCount, state.multiplayerOwnRoundHistory, -1)}
          ${roundRecapMarkup(state.multiplayerOwnRoundRecap, state.currentGameRoundCount)}
        </div>
        <section class="leaderboard-section" aria-labelledby="multiplayer-final-title">
          <h2 id="multiplayer-final-title" class="leaderboard-heading">Classement final</h2>
          <ol id="multiplayer-final-leaderboard" class="leaderboard"></ol>
        </section>
        ${state.multiplayerIsHost
          ? '<p id="lobby-status" class="status" role="status" aria-live="polite"></p><div class="result-actions"><button id="replay-multiplayer-button" class="button-primary" type="button">Rejouer</button><button id="return-home-button" type="button" class="button-secondary">Retour à l\'accueil</button></div>'
          : '<p id="lobby-status" class="status" role="status" aria-live="polite">En attente de l\'hôte...</p><button id="return-home-button" class="button-secondary full-width" type="button">Retour à l\'accueil</button>'}
      </section>
    </main>
  `
  focusScreenHeading(app)

  const leaderboard = document.querySelector<HTMLOListElement>(
    '#multiplayer-final-leaderboard',
  )!
  renderFinalLeaderboard(leaderboard, gameOver.scores, state.multiplayerPlayerId)

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
