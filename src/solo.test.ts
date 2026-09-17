// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

class FakeAudio {
  volume = 1
  preload = ''
  currentTime = 0
  readyState = 0
  paused = true
  src: string

  constructor(src: string) {
    this.src = src
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  load(): void {}
  async play(): Promise<void> {
    this.paused = false
  }
  pause(): void {
    this.paused = true
  }
}

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  const tracks = [
    { id: '1', title: 'Wonderwall', artist: 'Oasis', audioUrl: 'a1', imageUrl: 'i1' },
    { id: '2', title: 'Champagne Supernova', artist: 'Oasis', audioUrl: 'a2', imageUrl: 'i2' },
  ]
  return { ...actual, fetchTracks: vi.fn().mockResolvedValue(tracks) }
})

type Solo = typeof import('./solo')

let createSoloGame: Solo['createSoloGame']

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>'
  vi.stubGlobal('Audio', FakeAudio)
  ;({ createSoloGame } = await import('./solo'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

function type(value: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('.guess-search__input')!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input
}

describe('manche solo', () => {
  it('valide une bonne réponse, marque le score et propose la manche suivante', async () => {
    const renderRoundResult = vi.fn()
    const game = createSoloGame({
      app: document.querySelector<HTMLElement>('#app')!,
      getVolume: () => 0.5,
      setupVolumeControls: () => undefined,
      renderVolumeControlMarkup: () => '',
      revealArtwork: vi.fn(),
      renderRoundResult,
      readHighScore: () => 0,
      saveHighScore: () => false,
      renderHome: vi.fn(),
    })

    // Force le premier morceau du catalogue (Wonderwall).
    vi.spyOn(Math, 'random').mockReturnValue(0)
    await game.start('pop', 5, 30)

    expect(document.querySelector('#app .game-shell')).not.toBeNull()

    type('wonder')
    document.querySelector<HTMLLIElement>('.guess-suggestion')!.click()
    document.querySelector<HTMLFormElement>('.guess-area')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(renderRoundResult).toHaveBeenCalledWith(
      expect.anything(), 'correct', 'Wonderwall', 'Oasis', expect.any(Number),
    )

    const next = document.querySelector<HTMLButtonElement>('#app .next-button')!
    expect(next.textContent).toBe('Manche suivante')
    next.click()

    await vi.waitFor(() => {
      expect(document.querySelector('#app .round-label')?.textContent).toContain('Manche 2')
    })
    game.stop()
  })
})
