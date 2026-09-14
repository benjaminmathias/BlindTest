import { readStoredVolume, storeVolume } from './storage'

export type VolumeManager = {
  get: () => number
  set: (volume: number) => void
  renderMarkup: (id: string, compact?: boolean) => string
  setupControls: () => void
  addListener: (listener: (volume: number) => void) => void
}

const SPEAKER_ICON = `
  <svg class="volume-button__icon volume-button__icon--on" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M3.5 7.4h2.9L10 4.6v10.8L6.4 12.6H3.5z" fill="currentColor" />
    <path d="M12.4 7.6a3.4 3.4 0 0 1 0 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <path d="M14.6 5.6a6 6 0 0 1 0 8.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>
`

const SPEAKER_MUTED_ICON = `
  <svg class="volume-button__icon volume-button__icon--muted" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M3.5 7.4h2.9L10 4.6v10.8L6.4 12.6H3.5z" fill="currentColor" />
    <path d="M12.8 8l4.4 4M17.2 8l-4.4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>
`

export function createVolumeManager(): VolumeManager {
  let currentVolume = readStoredVolume()
  const listeners: ((volume: number) => void)[] = []
  let outsideClickBound = false

  const applyVolume = (volume: number): void => {
    currentVolume = Math.min(1, Math.max(0, volume))
    storeVolume(currentVolume)

    const volumePercent = Math.round(currentVolume * 100)

    document.querySelectorAll<HTMLSpanElement>('[data-volume-value]').forEach((label) => {
      label.textContent = `${volumePercent} %`
    })

    document.querySelectorAll<HTMLInputElement>('[data-volume-slider]').forEach((element) => {
      element.value = String(volumePercent)
    })

    document.querySelectorAll<HTMLElement>('[data-volume-toggle]').forEach((toggle) => {
      toggle.classList.toggle('is-muted', currentVolume === 0)
    })

    for (const listener of listeners) {
      listener(currentVolume)
    }
  }

  const renderMarkup = (id: string, compact = false): string => {
    const volumePercent = Math.round(currentVolume * 100)

    if (!compact) {
      return `
        <div class="volume-control">
          <input id="${id}" data-volume-slider type="range" min="0" max="100" step="5" value="${volumePercent}" />
          <span class="volume-value" data-volume-value>${volumePercent} %</span>
        </div>
      `
    }

    return `
      <div class="volume-control volume-control--popover">
        <button
          id="${id}-toggle"
          class="volume-button${currentVolume === 0 ? ' is-muted' : ''}"
          data-volume-toggle
          type="button"
          aria-expanded="false"
          aria-controls="${id}-panel"
          aria-label="Volume"
        >${SPEAKER_ICON}${SPEAKER_MUTED_ICON}</button>
        <div id="${id}-panel" class="volume-popover" hidden>
          <input id="${id}" data-volume-slider type="range" min="0" max="100" step="5" value="${volumePercent}" />
          <span class="volume-value" data-volume-value>${volumePercent} %</span>
        </div>
      </div>
    `
  }

  const bindOutsideClick = (): void => {
    if (outsideClickBound) {
      return
    }

    outsideClickBound = true

    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Node | null

      document.querySelectorAll<HTMLButtonElement>('[data-volume-toggle]').forEach((toggle) => {
        const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')

        if (!panel || panel.hidden) {
          return
        }

        if (target && (panel.contains(target) || toggle.contains(target))) {
          return
        }

        panel.hidden = true
        toggle.setAttribute('aria-expanded', 'false')
      })
    })
  }

  const setupControls = (): void => {
    bindOutsideClick()

    document.querySelectorAll<HTMLInputElement>('[data-volume-slider]').forEach((slider) => {
      slider.addEventListener('input', () => {
        const volumePercent = Math.min(100, Math.max(0, Number(slider.value)))
        applyVolume(volumePercent / 100)
      })
    })

    document.querySelectorAll<HTMLButtonElement>('[data-volume-toggle]').forEach((toggle) => {
      const panelId = toggle.getAttribute('aria-controls') ?? ''
      const panel = panelId ? document.getElementById(panelId) : null

      if (!panel) {
        return
      }

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true'
        toggle.setAttribute('aria-expanded', String(!expanded))
        panel.hidden = expanded

        if (!expanded) {
          panel.querySelector<HTMLInputElement>('input[type="range"]')?.focus()
        }
      })

      // Escape must work from the slider too, so the handler lives on the
      // wrapper (which contains both the button and the panel).
      const control = toggle.closest<HTMLElement>('.volume-control--popover') ?? toggle

      control.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || panel.hidden) {
          return
        }

        event.preventDefault()
        panel.hidden = true
        toggle.setAttribute('aria-expanded', 'false')
        toggle.focus()
      })
    })
  }

  return {
    get: () => currentVolume,
    set: applyVolume,
    renderMarkup,
    setupControls,
    addListener: (listener) => {
      listeners.push(listener)
    },
  }
}
