import { getDisplaySongTitle } from '../song'
import { formatScore } from '../ui'

const ROUND_RESULT_MARKS = {
  correct:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10.5l3.2 3.2L15 6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  wrong:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.2 6.2l7.6 7.6M13.8 6.2l-7.6 7.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>',
  timeout:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>',
  skip:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 5l6 5-6 5M13 5v10" fill="none" stroke="currentColor" stroke-width="2" /></svg>',
} as const

const ROUND_RESULT_LABELS = {
  correct: 'Bonne réponse',
  wrong: 'Raté',
  timeout: 'Temps écoulé',
  skip: 'Passé',
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
  badge.innerHTML = ROUND_RESULT_MARKS[result]

  const body = document.createElement('span')
  body.className = 'round-result__body'

  const statusLabel = document.createElement('span')
  statusLabel.className = 'round-result__status'
  statusLabel.textContent = ROUND_RESULT_LABELS[result]

  const track = document.createElement('span')
  track.className = 'round-result__track'
  track.textContent = getDisplaySongTitle(title)

  const artistElement = document.createElement('span')
  artistElement.className = 'round-result__artist'
  artistElement.textContent = ` — ${artist}`
  track.append(artistElement)

  body.append(statusLabel, track)
  status.append(badge, body)

  if (result !== 'timeout' && result !== 'skip') {
    const pointsElement = document.createElement('span')
    pointsElement.className = 'round-result__points'
    pointsElement.textContent = result === 'correct' ? `+${formatScore(points)}` : '0'
    status.append(pointsElement)
  }

  status.closest('.game-shell')?.classList.add('is-answered')
}
