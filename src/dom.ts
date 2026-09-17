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

export function setDisabled(selector: string, disabled: boolean): void {
  const element = qs<HTMLButtonElement>(selector)
  if (element) element.disabled = disabled
}

export function bindSelect<T>(
  select: HTMLSelectElement | null,
  parse: (raw: string) => T | null,
  apply: (value: T) => void,
): void {
  select?.addEventListener('change', () => {
    const value = parse(select.value)
    if (value !== null) apply(value)
  })
}

export function bindFieldReset(...inputs: HTMLInputElement[]): void {
  for (const input of inputs) {
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid')
      input.removeAttribute('aria-describedby')
    })
  }
}
