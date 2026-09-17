import type { FinalScore } from './protocol'

function playerRow(
  player: FinalScore,
  index: number,
  currentPlayerId: string | null,
  isFinal: boolean,
): HTMLLIElement {
  const row = document.createElement('li')
  const rank = document.createElement('span')
  const name = document.createElement('span')
  const score = document.createElement('span')
  rank.className = 'leaderboard__rank'
  rank.textContent = String(index + 1)
  name.className = 'leaderboard__name'
  name.textContent = player.name
  score.className = 'leaderboard__score'
  score.textContent = player.score.toLocaleString('fr-FR')
  if (player.playerId === currentPlayerId) row.classList.add('is-current-player')
  if (isFinal && index === 0) row.classList.add('is-winner')
  row.append(rank, name, score)
  return row
}

export function renderLeaderboard(
  leaderboard: HTMLOListElement | null,
  names: Map<string, string>,
  scores: Map<string, number>,
  currentPlayerId: string | null,
): void {
  if (!leaderboard) return
  const players = [...names]
    .map(([playerId, name]) => ({ playerId, name, score: scores.get(playerId) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  leaderboard.replaceChildren(...players.map((player, index) =>
    playerRow(player, index, currentPlayerId, false)))
}

export function renderFinalLeaderboard(
  leaderboard: HTMLOListElement,
  scores: FinalScore[],
  currentPlayerId: string | null,
): void {
  leaderboard.replaceChildren(...scores.map((player, index) =>
    playerRow(player, index, currentPlayerId, true)))
}
