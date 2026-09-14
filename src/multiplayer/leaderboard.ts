import { state } from '../state'
import { renderLeaderboard } from './game-ui'

export function renderMultiplayerLeaderboard(): void {
  renderLeaderboard(
    document.querySelector('#multiplayer-leaderboard'),
    state.multiplayerPlayerNames,
    state.multiplayerScores,
    state.multiplayerPlayerId,
  )
}
