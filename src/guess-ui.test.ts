// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GuessOption } from './game'
import { createGuessArea, type GuessArea } from './guess-ui'
import { getCanonicalSongKey } from './song'

const catalog: GuessOption[] = [
  { id: '1', title: 'Wonderwall', artist: 'Oasis' },
  { id: '2', title: 'Wonderwall (Remastered)', artist: 'Oasis' },
  { id: '3', title: 'Champagne Supernova', artist: 'Oasis' },
  { id: '4', title: "Don't Look Back in Anger", artist: 'Oasis' },
  { id: '5', title: 'Live Forever', artist: 'Oasis' },
  { id: '6', title: 'Supersonic', artist: 'Oasis' },
  { id: '7', title: 'Été', artist: 'Cali' },
]

const wonderwallKey = getCanonicalSongKey({ title: 'Wonderwall', artist: 'Oasis' })
const champagneKey = getCanonicalSongKey({ title: 'Champagne Supernova', artist: 'Oasis' })

let container!: HTMLElement
let area!: GuessArea

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  area = createGuessArea(container, { catalog, maxAttempts: 5, canSkip: true })
})

afterEach(() => {
  container.remove()
})

function type(value: string): void {
  area.input.value = value
  area.input.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(key: string): void {
  area.input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function listbox(): HTMLUListElement {
  return container.querySelector<HTMLUListElement>('.guess-suggestions')!
}

function items(): HTMLLIElement[] {
  return [...container.querySelectorAll<HTMLLIElement>('.guess-suggestion')]
}

function activeDescendant(): string | null {
  return area.input.getAttribute('aria-activedescendant')
}

function liveRegion(text: string): HTMLElement | undefined {
  return [...container.querySelectorAll<HTMLElement>('[role="status"]')]
    .find((element) => element.textContent === text)
}

describe('suggestions', () => {
  it("n'affiche rien avant deux caractères", () => {
    type('c')

    expect(listbox().hidden).toBe(true)
    expect(area.input.getAttribute('aria-expanded')).toBe('false')
  })

  it('ouvre la liste dédupliquée et relie le combobox', () => {
    type('wonder')

    expect(listbox().hidden).toBe(false)
    expect(area.input.getAttribute('aria-expanded')).toBe('true')
    expect(area.input.getAttribute('aria-controls')).toBe(listbox().id)
    expect(items()).toHaveLength(1)
  })

  it('annonce une absence de résultat sans option sélectionnable', () => {
    type('zzz')

    expect(listbox().hidden).toBe(false)
    expect(items()).toHaveLength(0)
    expect(container.querySelector('.guess-suggestions__empty')).not.toBeNull()
    expect(liveRegion('Aucun morceau trouvé')).toBeDefined()
  })

  it('sélectionne une suggestion au clic', () => {
    type('champ')
    items()[0]!.click()

    expect(area.input.value).toBe('Champagne Supernova — Oasis')
    expect(area.getSelectedOption()?.id).toBe('3')
    expect(listbox().hidden).toBe(true)
  })
})

describe('clavier', () => {
  it('parcourt les suggestions dans les deux sens, en boucle', () => {
    type('oas')
    const options = items()
    expect(options).toHaveLength(5)

    press('ArrowUp')
    expect(activeDescendant()).toBe(options[4]!.id)

    press('ArrowDown')
    expect(activeDescendant()).toBe(options[0]!.id)
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')

    press('ArrowDown')
    expect(activeDescendant()).toBe(options[1]!.id)
  })

  it('valide avec Entrée l’option active, sinon la première', () => {
    type('oas')
    press('ArrowDown')
    press('ArrowDown')
    press('Enter')
    expect(area.getSelectedOption()?.id).toBe('3')

    type('oas')
    press('Enter')
    expect(area.getSelectedOption()?.id).toBe('1')
  })

  it('ferme la liste avec Échap et nettoie l’activedescendant', () => {
    type('oas')
    press('ArrowDown')
    expect(activeDescendant()).not.toBeNull()

    press('Escape')

    expect(listbox().hidden).toBe(true)
    expect(area.input.getAttribute('aria-expanded')).toBe('false')
    expect(activeDescendant()).toBeNull()
  })
})

describe('état', () => {
  it('oublie la sélection quand le texte change', () => {
    type('champ')
    items()[0]!.click()
    expect(area.getSelectedOption()?.id).toBe('3')

    type('champ')
    expect(area.getSelectedOption()).toBeNull()
  })

  it('réinitialise tout avec clearInput', () => {
    type('champ')
    items()[0]!.click()
    area.showError('Erreur')

    area.clearInput()

    expect(area.input.value).toBe('')
    expect(area.getSelectedOption()).toBeNull()
    expect(listbox().hidden).toBe(true)
    expect(area.input.getAttribute('aria-invalid')).toBeNull()
  })

  it('exclut les variantes canoniques déjà tentées', () => {
    type('wonder')
    expect(items()).toHaveLength(1)
    area.setExcludedKeys([wonderwallKey])
    expect(items()).toHaveLength(0)
    expect(liveRegion('Aucun morceau trouvé')).toBeDefined()

    type('oas')
    area.setExcludedKeys([champagneKey])
    expect(items().some((item) => item.textContent?.includes('Champagne'))).toBe(false)
  })
})

describe('catalogue', () => {
  it('prend en compte un catalogue fourni après la création de la zone', () => {
    const lateContainer = document.createElement('div')
    document.body.append(lateContainer)
    const lateArea = createGuessArea(lateContainer, {
      catalog: [], maxAttempts: 5, canSkip: false,
    })

    lateArea.input.value = 'wonder'
    lateArea.input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(lateContainer.querySelectorAll('.guess-suggestion')).toHaveLength(0)

    lateArea.setCatalog(catalog)

    const lateItems = [...lateContainer.querySelectorAll<HTMLLIElement>('.guess-suggestion')]
    expect(lateItems).toHaveLength(1)
    expect(lateItems[0]!.textContent).toContain('Wonderwall')

    lateArea.destroy()
    lateContainer.remove()
  })
})

describe('accessibilité', () => {
  it('relie le message d’erreur et l’état d’invalidité', () => {
    area.showError('Choisis une suggestion dans la liste.')

    const error = container.querySelector<HTMLParagraphElement>('.guess-search__error')!
    expect(error.hidden).toBe(false)
    expect(error.id.length).toBeGreaterThan(0)
    expect(area.input.getAttribute('aria-invalid')).toBe('true')
    expect(area.input.getAttribute('aria-errormessage')).toBe(error.id)
    expect(area.input.getAttribute('aria-describedby')).toContain(error.id)

    area.clearError()

    expect(error.hidden).toBe(true)
    expect(area.input.getAttribute('aria-invalid')).toBeNull()
    expect(area.input.getAttribute('aria-errormessage')).toBeNull()
    expect(area.input.getAttribute('aria-describedby')).not.toContain(error.id)
  })

  it('annonce les essais restants', () => {
    area.announceRemaining(3)

    expect(liveRegion('3 essais restants')).toBeDefined()
  })
})

describe('nettoyage', () => {
  it('retire les listeners à la destruction', () => {
    type('oas')
    expect(items()).toHaveLength(5)

    area.destroy()

    type('champ')
    expect(items()).toHaveLength(5)

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(listbox().hidden).toBe(false)
  })
})
