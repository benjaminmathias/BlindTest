import { getDisplaySongTitle } from '../song'
import { formatScore } from '../ui'
import { ROUND_MARKS } from './marks'

const ROUND_RESULT_LABELS = {
  correct: 'Bonne réponse', wrong: 'Raté', timeout: 'Temps écoulé', skip: 'Passé',
} as const

export function renderRoundResult(
  status: HTMLElement,
  result: 'correct' | 'wrong' | 'timeout' | 'skip',
  title: string,
  artist: string,
  points = 0,
): void {
  status.replaceChildren()
  status.classList.remove('answer-feedback', 'is-correct', 'is-wrong', 'is-timeout')
  status.classList.add('round-result', `round-result--${result}`)

  const badge = document.createElement('span')
  badge.className = 'round-result__badge'
  badge.setAttribute('aria-hidden', 'true')
  badge.innerHTML = ROUND_MARKS[result]

  const body = document.createElement('span')
  body.className = 'round-result__body'

  const outcome = document.createElement('span')
  outcome.className = 'sr-only'
  outcome.textContent = ROUND_RESULT_LABELS[result]

  const track = document.createElement('span')
  track.className = 'round-result__track'
  track.textContent = getDisplaySongTitle(title)
  const artistElement = document.createElement('span')
  artistElement.className = 'round-result__artist'
  artistElement.textContent = ` — ${artist}`
  track.append(artistElement)
  body.append(outcome, track)
  status.append(badge, body)

  if (result === 'correct') {
    const pointsElement = document.createElement('span')
    pointsElement.className = 'round-result__points'
    pointsElement.textContent = `+${formatScore(points)}`
    status.append(pointsElement)
  }
  status.closest('.game-shell')?.classList.add('is-answered')
}
