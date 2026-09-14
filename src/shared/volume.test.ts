// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVolumeManager } from './volume'

function toggle(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-volume-toggle]')!
}

function panel(): HTMLElement {
  return document.getElementById('volume-slider-round-panel')!
}

function slider(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[data-volume-slider]')!
}

describe('volume', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('renders the inline fader without a toggle on the home screen', () => {
    const manager = createVolumeManager()
    document.body.innerHTML = manager.renderMarkup('volume-slider')

    expect(document.querySelector('[data-volume-toggle]')).toBeNull()
    expect(slider()).not.toBeNull()
    expect(document.querySelector('[data-volume-value]')?.textContent).toBe('50 %')
  })

  it('renders a collapsed popover in compact mode', () => {
    const manager = createVolumeManager()
    document.body.innerHTML = manager.renderMarkup('volume-slider-round', true)

    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(toggle().getAttribute('aria-controls')).toBe('volume-slider-round-panel')
    expect(panel().hidden).toBe(true)
    expect(slider().value).toBe('50')
  })

  it('opens the popover on click and focuses the slider', () => {
    const manager = createVolumeManager()
    document.body.innerHTML = manager.renderMarkup('volume-slider-round', true)
    manager.setupControls()

    toggle().click()

    expect(panel().hidden).toBe(false)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(slider())

    toggle().click()

    expect(panel().hidden).toBe(true)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('closes the popover on Escape and returns focus to the toggle', () => {
    const manager = createVolumeManager()
    document.body.innerHTML = manager.renderMarkup('volume-slider-round', true)
    manager.setupControls()

    toggle().click()
    expect(document.activeElement).toBe(slider())

    slider().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(panel().hidden).toBe(true)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle())
  })

  it('closes the popover on an outside pointerdown', () => {
    const manager = createVolumeManager()
    document.body.innerHTML = manager.renderMarkup('volume-slider-round', true)
    manager.setupControls()

    toggle().click()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(panel().hidden).toBe(true)
  })

  it('applies the slider value, marks mute and notifies listeners', () => {
    const manager = createVolumeManager()
    document.body.innerHTML = manager.renderMarkup('volume-slider-round', true)
    manager.setupControls()

    const listener = vi.fn()
    manager.addListener(listener)

    slider().value = '0'
    slider().dispatchEvent(new Event('input', { bubbles: true }))

    expect(listener).toHaveBeenCalledWith(0)
    expect(toggle().classList.contains('is-muted')).toBe(true)
    expect(document.querySelector('[data-volume-value]')?.textContent).toBe('0 %')
  })
})
