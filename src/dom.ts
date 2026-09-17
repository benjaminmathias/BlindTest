export const app = document.querySelector<HTMLDivElement>('#app')!

export function qs<T extends Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector)
}

export function requireElement<T extends Element>(selector: string, root: ParentNode = document): T {
  return qs<T>(selector, root)!
}

export function setText(selector: string, text: string): void {
  const element = qs<HTMLElement>(selector)
  if (element) element.textContent = text
}

export function setHidden(selector: string, hidden: boolean): void {
  const element = qs<HTMLElement>(selector)
  if (element) element.hidden = hidden
}

export function setDisabled(selector: string, disabled: boolean): void {
  const element = qs<HTMLButtonElement>(selector)
  if (element) element.disabled = disabled
}
