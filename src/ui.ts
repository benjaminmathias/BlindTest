export function setStatusMessage(
  element: HTMLElement | null,
  message: string,
  isError = false,
): void {
  if (!element) return
  element.textContent = message
  element.classList.toggle('status--error', isError && message.length > 0)
}

export const formatScore = (value: number): string => value.toLocaleString('fr-FR')

export const formatRemainingTime = (milliseconds: number): string =>
  `${(milliseconds / 1000).toFixed(1)} s`

export function focusScreenHeading(root: ParentNode): void {
  const heading = root.querySelector<HTMLHeadingElement>('h1')
  if (!heading) return
  heading.tabIndex = -1
  heading.focus()
}

const scoreAnimations = new WeakMap<HTMLElement, number>()

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function animateScore(
  element: HTMLElement | null,
  from: number,
  to: number,
  duration = 400,
): void {
  if (!element) return

  const existing = scoreAnimations.get(element)
  if (existing !== undefined) {
    window.cancelAnimationFrame(existing)
    scoreAnimations.delete(element)
  }

  if (from === to || prefersReducedMotion()) {
    element.textContent = formatScore(to)
    return
  }

  const startedAt = performance.now()
  const delta = to - from

  const tick = (now: number): void => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - (1 - progress) ** 3
    element.textContent = formatScore(Math.round(from + delta * eased))

    if (progress < 1) scoreAnimations.set(element, window.requestAnimationFrame(tick))
    else scoreAnimations.delete(element)
  }

  scoreAnimations.set(element, window.requestAnimationFrame(tick))
}
