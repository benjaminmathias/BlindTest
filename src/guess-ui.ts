import {
  formatGuessOption,
  MAX_SUGGESTIONS,
  normalizeSearchText,
  searchGuessOptions,
  type GuessOption,
  type RoundOutcome,
} from './game'
import { getDisplaySongTitle } from './song'

const ROUND_MARK_SVG: Record<RoundOutcome, string> = {
  correct:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10.5l3.2 3.2L15 6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  failed:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.2 6.2l7.6 7.6M13.8 6.2l-7.6 7.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>',
  timeout:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>',
  skipped:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 4.7L11.8 10 5 15.3z" fill="currentColor" /><rect x="12.6" y="4.7" width="2.6" height="10.6" rx="1.3" fill="currentColor" /></svg>',
}

const TIMELINE_LABELS: Record<RoundOutcome, string> = {
  correct: 'bonne réponse',
  failed: 'raté',
  timeout: 'temps écoulé',
  skipped: 'passé',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
      ? `Manche ${index + 1} : ${TIMELINE_LABELS[outcome]}`
      : `Manche ${index + 1} : ${index === currentIndex ? 'en cours' : 'à venir'}`
    return `<li class="round-timeline__item round-timeline__item--${state}"><span class="sr-only">${label}</span></li>`
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

function formatAttempt(attempt: number): string {
  return attempt <= 1 ? '1er' : `${attempt}e`
}

function formatElapsedSeconds(elapsedMs: number): string {
  return `${(Math.max(0, elapsedMs) / 1000).toFixed(1).replace('.', ',')} s`
}

export function roundRecapMarkup(
  entries: readonly (RoundRecapEntry | undefined)[],
  total: number,
): string {
  const played = entries.filter((entry): entry is RoundRecapEntry => Boolean(entry))

  if (played.length === 0) {
    return ''
  }

  const correctCount = played.filter(({ outcome }) => outcome === 'correct').length
  const summary = played.length === total
    ? `${correctCount} bonne${correctCount > 1 ? 's' : ''} réponse${correctCount > 1 ? 's' : ''} sur ${total}`
    : `${correctCount} sur ${played.length} manche${played.length > 1 ? 's' : ''} jouée${played.length > 1 ? 's' : ''}`

  const items = entries.map((entry) => {
    if (!entry) {
      return ''
    }

    const solutionLabel = `${escapeHtml(getDisplaySongTitle(entry.solution.title))} — ${escapeHtml(entry.solution.artist)}`
    const elapsedLabel = formatElapsedSeconds(entry.elapsedMs)
    let answer: string
    let meta: string

    if (entry.outcome === 'correct') {
      answer = escapeHtml(entry.guess ? formatGuessOption(entry.guess) : solutionLabel)
      meta = `Trouvé au ${formatAttempt(entry.attemptsUsed)} essai`
    } else if (entry.outcome === 'skipped' && !entry.guess) {
      answer = 'Manche passée'
      meta = `Bonne réponse : ${solutionLabel}`
    } else if (entry.guess) {
      answer = escapeHtml(formatGuessOption(entry.guess))
      meta = `Bonne réponse : ${solutionLabel}`
    } else {
      answer = entry.outcome === 'timeout' ? 'Temps écoulé' : 'Aucun essai'
      meta = `Bonne réponse : ${solutionLabel}`
    }

    return `<li class="round-recap__item round-recap__item--${entry.outcome}">
      <span class="round-recap__mark" aria-hidden="true">${ROUND_MARK_SVG[entry.outcome]}</span>
      <span class="round-recap__body">
        <span class="round-recap__answer">${answer}</span>
        <span class="round-recap__meta">${meta}</span>
      </span>
      <span class="round-recap__time" aria-label="Temps mis : ${elapsedLabel}">${elapsedLabel}</span>
    </li>`
  }).join('')

  return `<section class="round-recap" aria-label="Récapitulatif des manches">
    <h2 class="round-recap__heading">Récapitulatif <span class="round-recap__count">${summary}</span></h2>
    <ol class="round-recap__list">${items}</ol>
  </section>`
}

export type AttemptOutcome = 'wrong' | 'correct'

export type AttemptSlots = {
  element: HTMLOListElement
  setResult: (index: number, outcome: AttemptOutcome, label: string) => void
}

export type GuessAreaConfig = {
  catalog: readonly GuessOption[]
  maxAttempts: number
  placeholder?: string
  formId?: string
  canSkip?: boolean
  submitLabel?: string
  skipLabel?: string
  onSkip?: () => void
}

export type GuessArea = {
  form: HTMLFormElement
  input: HTMLInputElement
  slots: AttemptSlots
  getSelectedOption: () => GuessOption | null
  clearInput: () => void
  setDisabled: (disabled: boolean) => void
  setSubmitHidden: (hidden: boolean) => void
  focusInput: () => void
  setCatalog: (catalog: readonly GuessOption[]) => void
  setExcludedKeys: (keys: Iterable<string>) => void
  showError: (message: string) => void
  clearError: () => void
  announceRemaining: (remaining: number) => void
  destroy: () => void
}

function createIcon(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg'
  const icon = document.createElementNS(namespace, 'svg')
  icon.setAttribute('class', 'guess-search__icon')
  icon.setAttribute('viewBox', '0 0 20 20')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('focusable', 'false')

  const circle = document.createElementNS(namespace, 'circle')
  circle.setAttribute('cx', '9')
  circle.setAttribute('cy', '9')
  circle.setAttribute('r', '5.5')
  circle.setAttribute('fill', 'none')
  circle.setAttribute('stroke', 'currentColor')
  circle.setAttribute('stroke-width', '1.6')

  const handle = document.createElementNS(namespace, 'path')
  handle.setAttribute('d', 'M13.2 13.2L17 17')
  handle.setAttribute('fill', 'none')
  handle.setAttribute('stroke', 'currentColor')
  handle.setAttribute('stroke-width', '1.6')
  handle.setAttribute('stroke-linecap', 'round')

  icon.append(circle, handle)
  return icon
}

function buildNormalizedIndex(text: string): { normalized: string; map: number[] } {
  let normalized = ''
  const map: number[] = []

  for (let index = 0; index < text.length; index += 1) {
    const base = (text[index] ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    for (const character of base) {
      if (/\s/.test(character)) {
        if (normalized.length === 0 || normalized.endsWith(' ')) {
          continue
        }
        normalized += ' '
        map.push(index)
        continue
      }

      normalized += character
      map.push(index)
    }
  }

  while (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    map.pop()
  }

  return { normalized, map }
}

function appendHighlighted(target: HTMLElement, text: string, needle: string): void {
  if (needle.length === 0) {
    target.textContent = text
    return
  }

  const { normalized, map } = buildNormalizedIndex(text)
  const start = normalized.indexOf(needle)

  if (start === -1) {
    target.textContent = text
    return
  }

  const endNormalized = start + needle.length
  const originalStart = map[start] ?? 0
  const originalEnd = (map[endNormalized - 1] ?? originalStart) + 1

  const before = text.slice(0, originalStart)
  const match = text.slice(originalStart, originalEnd)
  const after = text.slice(originalEnd)

  if (before.length > 0) {
    target.append(document.createTextNode(before))
  }

  const mark = document.createElement('mark')
  mark.className = 'guess-suggestion__match'
  mark.textContent = match
  target.append(mark)

  if (after.length > 0) {
    target.append(document.createTextNode(after))
  }
}

let guessAreaCounter = 0

export function createGuessArea(container: HTMLElement, config: GuessAreaConfig): GuessArea {
  guessAreaCounter += 1
  const uid = guessAreaCounter
  const listboxId = `guess-suggestions-${uid}`
  const announcerId = `guess-attempts-${uid}`
  const errorId = `guess-error-${uid}`
  const emptyAnnouncerId = `guess-empty-${uid}`

  const submitLabel = config.submitLabel ?? 'Valider'
  const skipLabel = config.skipLabel ?? 'Passer'
  const canSkip = config.canSkip ?? false

  const controller = new AbortController()
  const { signal } = controller

  let selectedOption: GuessOption | null = null
  let selectedText = ''
  let catalog = config.catalog
  let excludedKeys = new Set<string>()
  let suggestions: GuessOption[] = []
  let activeIndex = -1
  let buttonMode: 'validate' | 'skip' = canSkip ? 'skip' : 'validate'

  const form = document.createElement('form')
  form.className = 'guess-area'
  form.noValidate = true
  if (config.formId) {
    form.id = config.formId
  }

  const slotsElement = document.createElement('ol')
  slotsElement.className = 'attempt-slots'
  slotsElement.setAttribute('aria-label', 'Essais')
  const slotElements: HTMLLIElement[] = []

  for (let index = 0; index < config.maxAttempts; index += 1) {
    const slot = document.createElement('li')
    slot.className = 'attempt-slot'
    slot.dataset.index = String(index)

    const number = document.createElement('span')
    number.className = 'attempt-slot__index'
    number.textContent = String(index + 1)

    const placeholder = document.createElement('span')
    placeholder.className = 'attempt-slot__placeholder'
    placeholder.textContent = '—'
    placeholder.setAttribute('aria-hidden', 'true')

    slot.append(number, placeholder)
    slotsElement.append(slot)
    slotElements.push(slot)
  }

  const slots: AttemptSlots = {
    element: slotsElement,
    setResult: (index, outcome, label) => {
      const slot = slotElements[index]
      if (!slot) {
        return
      }

      slot.classList.remove('attempt-slot--wrong', 'attempt-slot--correct')
      slot.classList.add(outcome === 'correct' ? 'attempt-slot--correct' : 'attempt-slot--wrong')

      const mark = document.createElement('span')
      mark.className = 'attempt-slot__mark'
      mark.innerHTML = ROUND_MARK_SVG[outcome === 'correct' ? 'correct' : 'failed']

      const text = document.createElement('span')
      text.className = 'attempt-slot__text'
      text.textContent = label

      slot.replaceChildren(mark, text)
      slot.setAttribute(
        'aria-label',
        `Essai ${index + 1} : ${outcome === 'correct' ? 'bonne réponse' : 'mauvaise réponse'} ${label}`,
      )
    },
  }

  const search = document.createElement('div')
  search.className = 'guess-search'

  const box = document.createElement('div')
  box.className = 'guess-search__box'

  const field = document.createElement('div')
  field.className = 'guess-search__field'

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'guess-search__input'
  input.autocomplete = 'off'
  input.placeholder = config.placeholder ?? 'Rechercher un titre ou un artiste…'
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', listboxId)
  input.setAttribute('aria-describedby', announcerId)

  field.append(createIcon(), input)

  const listbox = document.createElement('ul')
  listbox.className = 'guess-suggestions'
  listbox.id = listboxId
  listbox.setAttribute('role', 'listbox')
  listbox.setAttribute('aria-label', 'Suggestions')
  listbox.hidden = true

  box.append(field, listbox)

  const submit = document.createElement('button')
  submit.type = 'button'
  submit.className = 'guess-search__submit'
  submit.textContent = canSkip ? skipLabel : submitLabel
  submit.classList.add(canSkip ? 'button-ghost' : 'button-primary')

  search.append(box, submit)

  const error = document.createElement('p')
  error.className = 'guess-search__error'
  error.id = errorId
  error.hidden = true

  const announcer = document.createElement('p')
  announcer.className = 'sr-only'
  announcer.id = announcerId
  announcer.setAttribute('role', 'status')
  announcer.setAttribute('aria-live', 'polite')

  const emptyAnnouncer = document.createElement('p')
  emptyAnnouncer.className = 'sr-only'
  emptyAnnouncer.id = emptyAnnouncerId
  emptyAnnouncer.setAttribute('role', 'status')
  emptyAnnouncer.setAttribute('aria-live', 'polite')

  form.append(slotsElement, search, error, announcer, emptyAnnouncer)
  container.append(form)

  const closeList = (): void => {
    listbox.hidden = true
    listbox.replaceChildren()
    suggestions = []
    activeIndex = -1
    emptyAnnouncer.textContent = ''
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }

  const updateActive = (): void => {
    const items = [...listbox.querySelectorAll<HTMLLIElement>('.guess-suggestion')]
    items.forEach((item, index) => {
      const active = index === activeIndex
      item.setAttribute('aria-selected', String(active))
      item.classList.toggle('is-active', active)
    })

    const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined
    if (activeItem?.id) {
      input.setAttribute('aria-activedescendant', activeItem.id)
      activeItem.scrollIntoView?.({ block: 'nearest' })
    } else {
      input.removeAttribute('aria-activedescendant')
    }
  }

  const clearErrorState = (): void => {
    error.hidden = true
    error.textContent = ''
    input.removeAttribute('aria-invalid')
    input.removeAttribute('aria-errormessage')
    input.setAttribute('aria-describedby', announcerId)
  }

  const showErrorState = (message: string): void => {
    error.textContent = message
    error.hidden = false
    input.setAttribute('aria-invalid', 'true')
    input.setAttribute('aria-errormessage', errorId)
    input.setAttribute('aria-describedby', `${announcerId} ${errorId}`)
  }

  const chooseOption = (option: GuessOption): void => {
    selectedOption = option
    selectedText = formatGuessOption(option)
    input.value = selectedText
    clearErrorState()
    closeList()
    updateButtonMode()
    input.focus()
  }

  const renderListbox = (): void => {
    const needle = normalizeSearchText(input.value)

    if (needle.length < 2) {
      closeList()
      return
    }

    if (suggestions.length === 0) {
      listbox.replaceChildren()

      const empty = document.createElement('li')
      empty.className = 'guess-suggestions__empty'
      empty.setAttribute('aria-hidden', 'true')
      empty.textContent = 'Aucun morceau trouvé'
      listbox.append(empty)
      listbox.hidden = false
      activeIndex = -1
      emptyAnnouncer.textContent = 'Aucun morceau trouvé'
      input.setAttribute('aria-expanded', 'true')
      input.removeAttribute('aria-activedescendant')
      return
    }

    emptyAnnouncer.textContent = ''

    const items = suggestions.map((option, index) => {
      const item = document.createElement('li')
      item.className = 'guess-suggestion'
      item.id = `${listboxId}-option-${index}`
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(index === activeIndex))

      const title = document.createElement('span')
      title.className = 'guess-suggestion__title'
      appendHighlighted(title, getDisplaySongTitle(option.title), needle)

      const artist = document.createElement('span')
      artist.className = 'guess-suggestion__artist'
      appendHighlighted(artist, option.artist, needle)

      item.append(title, artist)
      item.addEventListener('mousedown', (event) => event.preventDefault(), { signal })
      item.addEventListener('click', () => chooseOption(option), { signal })

      return item
    })

    listbox.replaceChildren(...items)
    listbox.hidden = false
    input.setAttribute('aria-expanded', 'true')

    if (activeIndex >= 0) {
      updateActive()
    } else {
      input.removeAttribute('aria-activedescendant')
    }
  }

  const refreshSuggestions = (): void => {
    suggestions = searchGuessOptions(
      catalog,
      input.value,
      MAX_SUGGESTIONS,
      excludedKeys,
    )
    activeIndex = -1
    renderListbox()
  }

  function updateButtonMode(): void {
    const hasText = input.value.trim().length > 0
    const mode: 'validate' | 'skip' = hasText || !canSkip ? 'validate' : 'skip'

    if (mode === buttonMode && submit.dataset.ready === 'true') {
      return
    }

    buttonMode = mode
    submit.dataset.ready = 'true'
    submit.textContent = mode === 'validate' ? submitLabel : skipLabel
    submit.classList.toggle('button-primary', mode === 'validate')
    submit.classList.toggle('button-ghost', mode === 'skip')
  }

  input.addEventListener('input', () => {
    if (selectedOption && input.value !== selectedText) {
      selectedOption = null
      selectedText = ''
    }
    clearErrorState()
    updateButtonMode()
    refreshSuggestions()
  }, { signal })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      if (listbox.hidden) {
        refreshSuggestions()
        if (suggestions.length === 0) {
          return
        }
      }
      event.preventDefault()
      activeIndex = activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0
      updateActive()
      return
    }

    if (event.key === 'ArrowUp') {
      if (listbox.hidden || suggestions.length === 0) {
        return
      }
      event.preventDefault()
      activeIndex = activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1
      updateActive()
      return
    }

    if (event.key === 'Enter') {
      if (!listbox.hidden && suggestions.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        chooseOption(suggestions[activeIndex >= 0 ? activeIndex : 0]!)
        return
      }

      if (input.value.trim().length === 0) {
        event.preventDefault()
        return
      }

      event.preventDefault()
      form.requestSubmit()
      return
    }

    if (event.key === 'Escape' && !listbox.hidden) {
      event.preventDefault()
      event.stopPropagation()
      closeList()
    }
  }, { signal })

  submit.addEventListener('click', () => {
    if (buttonMode === 'skip' && canSkip) {
      config.onSkip?.()
      return
    }
    form.requestSubmit()
  }, { signal })

  document.addEventListener('pointerdown', (event) => {
    if (!box.contains(event.target as Node)) {
      closeList()
    }
  }, { signal })

  updateButtonMode()

  return {
    form,
    input,
    slots,
    getSelectedOption: () => selectedOption,
    clearInput: () => {
      input.value = ''
      selectedOption = null
      selectedText = ''
      clearErrorState()
      closeList()
      updateButtonMode()
    },
    setDisabled: (disabled) => {
      input.disabled = disabled
      submit.disabled = disabled
      if (disabled) {
        closeList()
      }
    },
    setSubmitHidden: (hidden) => {
      submit.hidden = hidden
    },
    focusInput: () => input.focus(),
    setCatalog: (nextCatalog) => {
      catalog = nextCatalog
      if (!listbox.hidden) {
        refreshSuggestions()
      }
    },
    setExcludedKeys: (keys) => {
      excludedKeys = new Set(keys)
      if (!listbox.hidden) {
        refreshSuggestions()
      }
    },
    showError: (message) => {
      showErrorState(message)
    },
    clearError: () => {
      clearErrorState()
    },
    announceRemaining: (remaining) => {
      announcer.textContent = `${remaining} essai${remaining === 1 ? '' : 's'} restant${remaining === 1 ? '' : 's'}`
    },
    destroy: () => controller.abort(),
  }
}
