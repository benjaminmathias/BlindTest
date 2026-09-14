import { readStoredVolume, storeVolume } from './storage'

export type VolumeManager = {
  get: () => number
  set: (volume: number) => void
  renderMarkup: (id: string, compact?: boolean) => string
  setupControls: () => void
  addListener: (listener: (volume: number) => void) => void
}

export function createVolumeManager(): VolumeManager {
  let currentVolume = readStoredVolume()
  const listeners: ((volume: number) => void)[] = []

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

    for (const listener of listeners) {
      listener(currentVolume)
    }
  }

  const renderMarkup = (id: string, compact = false): string => {
    const volumePercent = Math.round(currentVolume * 100)

    return `
      <div class="volume-control${compact ? ' volume-control--compact' : ''}">
        <input id="${id}" data-volume-slider type="range" min="0" max="100" step="5" value="${volumePercent}" />
        <span class="volume-value" data-volume-value>${volumePercent} %</span>
      </div>
    `
  }

  const setupControls = (): void => {
    const sliders = [...document.querySelectorAll<HTMLInputElement>('[data-volume-slider]')]

    if (sliders.length === 0) {
      return
    }

    for (const slider of sliders) {
      slider.addEventListener('input', () => {
        const volumePercent = Math.min(100, Math.max(0, Number(slider.value)))
        applyVolume(volumePercent / 100)
      })
    }
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
