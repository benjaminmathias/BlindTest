import { MAX_ATTEMPTS, type GuessOption } from '../game'
import { createGuessArea, type GuessArea } from '../guess/area'
import { getCanonicalSongKey } from '../song'

export type GuessRoundOptions = {
  container: HTMLElement
  catalog: readonly GuessOption[]
  placeholder?: string
  formId?: string
  canSkip?: boolean
  onSkip?: () => void
  canSubmit?: () => boolean
  focusOnError?: boolean
  emptyMessage?: string
  duplicateMessage?: string
  onGuess: (guess: GuessOption, key: string) => void
}

export type GuessRound = {
  area: GuessArea
  form: HTMLFormElement
  triedKeys: Set<string>
  setCatalog: (catalog: readonly GuessOption[]) => void
  recordAttempt: (attemptIndex: number, isCorrect: boolean, label: string, remaining: number) => void
}

// Zone de saisie d'une manche : valide la sélection, écarte les doublons
// canoniques et journalise les essais, quel que soit le mode de jeu.
export function createGuessRound(options: GuessRoundOptions): GuessRound {
  const area = createGuessArea(options.container, {
    catalog: options.catalog,
    maxAttempts: MAX_ATTEMPTS,
    placeholder: options.placeholder,
    formId: options.formId,
    canSkip: options.canSkip,
    onSkip: options.onSkip,
  })
  const triedKeys = new Set<string>()
  const focusOnError = options.focusOnError ?? true
  area.setExcludedKeys(triedKeys)

  area.form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (options.canSubmit && !options.canSubmit()) return

    const guess = area.getSelectedOption()
    if (!guess) {
      area.showError(options.emptyMessage ?? 'Choisis une suggestion dans la liste.')
      if (focusOnError) area.focusInput()
      return
    }

    const key = getCanonicalSongKey(guess)
    if (triedKeys.has(key)) {
      area.showError(options.duplicateMessage ?? 'Cette réponse a déjà été essayée.')
      if (focusOnError) area.focusInput()
      return
    }

    area.clearError()
    triedKeys.add(key)
    area.setExcludedKeys(triedKeys)
    options.onGuess(guess, key)
  })

  return {
    area,
    form: area.form,
    triedKeys,
    setCatalog: (catalog) => area.setCatalog(catalog),
    recordAttempt: (attemptIndex, isCorrect, label, remaining) => {
      area.slots.setResult(attemptIndex, isCorrect ? 'correct' : 'wrong', label)
      area.announceRemaining(remaining)
    },
  }
}
