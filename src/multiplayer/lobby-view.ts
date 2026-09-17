import { MUSIC_THEME_LABELS } from '../api'
import { qs, setDisabled, setText } from '../dom'
import { state } from '../state'
import { renderMultiplayerLeaderboard } from './leaderboard'
import type { Player } from './protocol'

function playerElement(player: Player): HTMLLIElement {
  const element = document.createElement('li')
  const name = document.createElement('span')
  name.textContent = player.name
  element.append(name)

  if (player.isHost) {
    const badge = document.createElement('span')
    badge.className = 'host-badge'
    badge.textContent = 'Hôte'
    element.append(badge)
  }

  return element
}

// Rafraîchit le lobby : réglages affichés, statut, bouton de démarrage et
// liste des joueurs. Retombe sur le classement quand le lobby n'est plus là.
export function renderLobbyPlayers(players: Player[]): void {
  const playersList = qs<HTMLUListElement>('#players-list')

  if (!playersList) {
    renderMultiplayerLeaderboard()
    return
  }

  setText('#players-count', `(${players.length})`)
  setText('#lobby-theme-value', MUSIC_THEME_LABELS[state.multiplayerMusicTheme])
  setText('#lobby-round-count-value', String(state.multiplayerRoundCount))
  setText('#lobby-round-duration-value', `${state.multiplayerRoundDuration} s`)
  setDisabled('#start-game-button', players.length < 2)

  setText('#lobby-status', state.multiplayerIsHost
    ? players.length < 2 ? 'En attente d\'un autre joueur…' : 'Prêt à commencer.'
    : 'En attente du lancement par l\'hôte…')

  const elements = [...players]
    .sort((first, second) =>
      Number(second.isHost) - Number(first.isHost)
      || first.name.localeCompare(second.name),
    )
    .map(playerElement)

  playersList.replaceChildren(...elements)
  renderMultiplayerLeaderboard()
}
