export function setStatusMessage(
  element: HTMLElement | null,
  message: string,
  isError = false,
): void {
  if (!element) return
  element.textContent = message
  element.classList.toggle('status--error', isError && message.length > 0)
}

export function formatScore(value: number): string {
  return value.toLocaleString('fr-FR')
}

export function formatRemainingTime(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`
}

export function focusScreenHeading(root: ParentNode): void {
  const heading = root.querySelector<HTMLHeadingElement>('h1')
  if (!heading) return
  heading.tabIndex = -1
  heading.focus()
}
