import {
  formatGuessOption,
  MAX_SUGGESTIONS,
  normalizeSearchText,
  searchGuessOptions,
  type GuessOption,
} from '../game'
import { ROUND_MARKS } from '../shared/marks'
import { escapeHtml } from '../shared/markup'
import { getDisplaySongTitle } from '../song'
import { appendHighlighted } from './search'

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
  if (config.formId) form.id = config.formId

  const slotsMarkup = Array.from({ length: config.maxAttempts }, (_, index) => `
    <li class="attempt-slot" data-index="${index}">
      <span class="attempt-slot__index">${index + 1}</span>
      <span class="attempt-slot__placeholder" aria-hidden="true">—</span>
    </li>`).join('')

  form.innerHTML = `
    <ol class="attempt-slots" aria-label="Essais">${slotsMarkup}</ol>
    <div class="guess-search">
      <div class="guess-search__box">
        <div class="guess-search__field">
          <svg class="guess-search__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M13.2 13.2L17 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <input class="guess-search__input" type="text" autocomplete="off" placeholder="${escapeHtml(config.placeholder ?? 'Rechercher un titre ou un artiste…')}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${listboxId}" aria-describedby="${announcerId}" />
        </div>
        <ul class="guess-suggestions" id="${listboxId}" role="listbox" aria-label="Suggestions" hidden></ul>
      </div>
      <button class="guess-search__submit ${canSkip ? 'button-ghost' : 'button-primary'}" type="button">${canSkip ? skipLabel : submitLabel}</button>
    </div>
    <p class="guess-search__error" id="${errorId}" hidden></p>
    <p class="sr-only" id="${announcerId}" role="status" aria-live="polite"></p>
    <p class="sr-only" id="${emptyAnnouncerId}" role="status" aria-live="polite"></p>`

  const slotsElement = form.querySelector<HTMLOListElement>('.attempt-slots')!
  const slotElements = [...form.querySelectorAll<HTMLLIElement>('.attempt-slot')]
  const box = form.querySelector<HTMLDivElement>('.guess-search__box')!
  const input = form.querySelector<HTMLInputElement>('.guess-search__input')!
  const listbox = form.querySelector<HTMLUListElement>('.guess-suggestions')!
  const submit = form.querySelector<HTMLButtonElement>('.guess-search__submit')!
  const error = form.querySelector<HTMLParagraphElement>('.guess-search__error')!
  const announcer = form.querySelector<HTMLParagraphElement>(`#${announcerId}`)!
  const emptyAnnouncer = form.querySelector<HTMLParagraphElement>(`#${emptyAnnouncerId}`)!

  const slots: AttemptSlots = {
    element: slotsElement,
    setResult: (index, outcome, label) => {
      const slot = slotElements[index]
      if (!slot) return

      slot.classList.remove('attempt-slot--wrong', 'attempt-slot--correct')
      slot.classList.add(outcome === 'correct' ? 'attempt-slot--correct' : 'attempt-slot--wrong')

      const mark = document.createElement('span')
      mark.className = 'attempt-slot__mark'
      mark.innerHTML = ROUND_MARKS[outcome === 'correct' ? 'correct' : 'wrong']

      const text = document.createElement('span')
      text.className = 'attempt-slot__text'
      text.textContent = label

      slot.replaceChildren(mark, text)
      slot.setAttribute('aria-label',
        `Essai ${index + 1} : ${outcome === 'correct' ? 'bonne réponse' : 'mauvaise réponse'} ${label}`)
    },
  }

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

    if (activeIndex >= 0) updateActive()
    else input.removeAttribute('aria-activedescendant')
  }

  const refreshSuggestions = (): void => {
    suggestions = searchGuessOptions(catalog, input.value, MAX_SUGGESTIONS, excludedKeys)
    activeIndex = -1
    renderListbox()
  }

  function updateButtonMode(): void {
    const hasText = input.value.trim().length > 0
    const mode: 'validate' | 'skip' = hasText || !canSkip ? 'validate' : 'skip'
    if (mode === buttonMode && submit.dataset.ready === 'true') return

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
        if (suggestions.length === 0) return
      }
      event.preventDefault()
      activeIndex = activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0
      updateActive()
      return
    }

    if (event.key === 'ArrowUp') {
      if (listbox.hidden || suggestions.length === 0) return
      event.preventDefault()
      activeIndex = activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1
      updateActive()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (!listbox.hidden && suggestions.length > 0) {
        event.stopPropagation()
        chooseOption(suggestions[activeIndex >= 0 ? activeIndex : 0]!)
        return
      }

      if (input.value.trim().length > 0) form.requestSubmit()
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
    if (!box.contains(event.target as Node)) closeList()
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
      if (disabled) closeList()
    },
    setSubmitHidden: (hidden) => { submit.hidden = hidden },
    focusInput: () => input.focus(),
    setCatalog: (nextCatalog) => {
      catalog = nextCatalog
      if (!listbox.hidden) refreshSuggestions()
    },
    setExcludedKeys: (keys) => {
      excludedKeys = new Set(keys)
      if (!listbox.hidden) refreshSuggestions()
    },
    showError: showErrorState,
    clearError: clearErrorState,
    announceRemaining: (remaining) => {
      announcer.textContent = `${remaining} essai${remaining === 1 ? '' : 's'} restant${remaining === 1 ? '' : 's'}`
    },
    destroy: () => controller.abort(),
  }
}
