import { formatGuessOption, type GuessOption, type RoundOutcome } from '../game'
import { ROUND_MARKS, type RoundMarkName } from '../shared/marks'
import { escapeHtml } from '../shared/markup'
import { getDisplaySongTitle } from '../song'

const OUTCOME_MARK: Record<RoundOutcome, RoundMarkName> = {
  correct: 'correct', failed: 'wrong', timeout: 'timeout', skipped: 'skip',
}

const TIMELINE_LABELS: Record<RoundOutcome, string> = {
  correct: 'bonne réponse', failed: 'raté', timeout: 'temps écoulé', skipped: 'passé',
}

export function roundTimelineMarkup(
  total: number,
  outcomes: readonly (RoundOutcome | undefined)[],
  currentIndex: number,
): string {
  const items = Array.from({ length: Math.max(0, total) }, (_, index) => {
    const outcome = outcomes[index]
    const state = outcome ?? (index === currentIndex ? 'current' : 'pending')
    const label = outcome
      ? TIMELINE_LABELS[outcome]
      : index === currentIndex ? 'en cours' : 'à venir'
    return `<li class="round-timeline__item round-timeline__item--${state}"><span class="sr-only">Manche ${index + 1} : ${label}</span></li>`
  }).join('')

  return `<ol class="round-timeline" aria-label="Progression de la partie">${items}</ol>`
}

export type RoundRecapEntry = {
  outcome: RoundOutcome
  guess: GuessOption | null
  attemptsUsed: number
  elapsedMs: number
  solution: Pick<GuessOption, 'title' | 'artist'>
}

const formatAttempt = (attempt: number): string => (attempt <= 1 ? '1er' : `${attempt}e`)
const formatElapsedSeconds = (elapsedMs: number): string =>
  `${(Math.max(0, elapsedMs) / 1000).toFixed(1).replace('.', ',')} s`

function recapCopy(entry: RoundRecapEntry, solutionLabel: string): { answer: string; meta: string } {
  const guessLabel = entry.guess ? escapeHtml(formatGuessOption(entry.guess)) : null

  if (entry.outcome === 'correct') {
    return {
      answer: guessLabel ?? solutionLabel,
      meta: `Trouvé au ${formatAttempt(entry.attemptsUsed)} essai`,
    }
  }
  if (entry.outcome === 'skipped' && !guessLabel) {
    return { answer: 'Manche passée', meta: `Bonne réponse : ${solutionLabel}` }
  }

  return {
    answer: guessLabel ?? (entry.outcome === 'timeout' ? 'Temps écoulé' : 'Aucun essai'),
    meta: `Bonne réponse : ${solutionLabel}`,
  }
}

function recapItem(entry: RoundRecapEntry): string {
  const solutionLabel = `${escapeHtml(getDisplaySongTitle(entry.solution.title))} — ${escapeHtml(entry.solution.artist)}`
  const elapsedLabel = formatElapsedSeconds(entry.elapsedMs)
  const { answer, meta } = recapCopy(entry, solutionLabel)

  return `<li class="round-recap__item round-recap__item--${entry.outcome}">
      <span class="round-recap__mark" aria-hidden="true">${ROUND_MARKS[OUTCOME_MARK[entry.outcome]]}</span>
      <span class="round-recap__body">
        <span class="round-recap__answer">${answer}</span>
        <span class="round-recap__meta">${meta}</span>
      </span>
      <span class="round-recap__time" aria-label="Temps mis : ${elapsedLabel}">${elapsedLabel}</span>
    </li>`
}

export function roundRecapMarkup(
  entries: readonly (RoundRecapEntry | undefined)[],
  total: number,
): string {
  const played = entries.filter((entry): entry is RoundRecapEntry => Boolean(entry))
  if (played.length === 0) return ''

  const correctCount = played.filter(({ outcome }) => outcome === 'correct').length
  const summary = played.length === total
    ? `${correctCount} bonne${correctCount > 1 ? 's' : ''} réponse${correctCount > 1 ? 's' : ''} sur ${total}`
    : `${correctCount} sur ${played.length} manche${played.length > 1 ? 's' : ''} jouée${played.length > 1 ? 's' : ''}`

  const items = entries.map((entry) => (entry ? recapItem(entry) : '')).join('')

  return `<section class="round-recap" aria-label="Récapitulatif des manches">
    <h2 class="round-recap__heading">Récapitulatif <span class="round-recap__count">${summary}</span></h2>
    <ol class="round-recap__list">${items}</ol>
  </section>`
}
