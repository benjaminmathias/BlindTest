import { formatRemainingTime } from '../ui'

export type RoundTimer = {
  stop: () => void
  elapsedMs: () => number
}

export type RoundTimerOptions = {
  startAt: number
  durationMs: number
  now: () => number
  timeEl: HTMLElement
  progressEl: HTMLElement
  statusEl?: HTMLElement | null
  onStart?: () => void
  onTick?: (remainingMs: number) => void
  onExpire: () => void
}

const TICK_MS = 100
const LOW_THRESHOLD_MS = 5_000
const ANNOUNCE_10_MS = 10_000
const ANNOUNCE_5_MS = 5_000

// Pilote unique de l'horloge d'une manche : compte à rebours avant le départ,
// temps restant, barre de progression, seuil rouge et annonces orales.
export function createRoundTimer(options: RoundTimerOptions): RoundTimer {
  const { startAt, durationMs, now, timeEl, progressEl } = options
  const container = timeEl.parentElement
  let started = false
  let announced = 0

  const elapsed = (): number => Math.min(durationMs, Math.max(0, now() - startAt))

  const update = (): void => {
    if (!started) {
      const untilStart = startAt - now()

      if (untilStart > 0) {
        timeEl.textContent = `${Math.ceil(untilStart / 1000)}…`
        progressEl.style.transform = 'scaleX(1)'
        container?.classList.remove('is-low')
        return
      }

      started = true
      options.onStart?.()
    }

    const remaining = Math.max(0, startAt + durationMs - now())
    timeEl.textContent = formatRemainingTime(remaining)
    progressEl.style.transform = `scaleX(${Math.max(0, Math.min(1, remaining / durationMs))})`
    container?.classList.toggle('is-low', remaining > 0 && remaining <= LOW_THRESHOLD_MS)

    if (options.statusEl) {
      if (remaining <= ANNOUNCE_10_MS && remaining > ANNOUNCE_5_MS && announced < ANNOUNCE_10_MS) {
        announced = ANNOUNCE_10_MS
        options.statusEl.textContent = 'Il reste 10 secondes.'
      } else if (remaining <= ANNOUNCE_5_MS && remaining > 0 && announced < ANNOUNCE_5_MS) {
        announced = ANNOUNCE_5_MS
        options.statusEl.textContent = 'Il reste 5 secondes.'
      }
    }

    options.onTick?.(remaining)
    if (remaining <= 0) options.onExpire()
  }

  const intervalId = window.setInterval(update, TICK_MS)
  update()

  return { stop: () => window.clearInterval(intervalId), elapsedMs: elapsed }
}
