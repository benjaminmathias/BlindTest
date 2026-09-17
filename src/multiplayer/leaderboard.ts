import { qs } from '../dom'
import { state } from '../state'
import { renderLeaderboard } from './game-ui'

export function renderMultiplayerLeaderboard(): void {
  renderLeaderboard(
    qs('#multiplayer-leaderboard'),
    state.multiplayerPlayerNames,
    state.multiplayerScores,
    state.multiplayerPlayerId,
  )
}
