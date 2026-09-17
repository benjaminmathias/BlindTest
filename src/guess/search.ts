import { normalizeWithIndex } from '../song'

export function appendHighlighted(target: HTMLElement, text: string, needle: string): void {
  if (needle.length === 0) {
    target.textContent = text
    return
  }

  const { normalized, map } = normalizeWithIndex(text)
  const start = normalized.indexOf(needle)

  if (start === -1) {
    target.textContent = text
    return
  }

  const originalStart = map[start] ?? 0
  const originalEnd = (map[start + needle.length - 1] ?? originalStart) + 1

  const mark = document.createElement('mark')
  mark.className = 'guess-suggestion__match'
  mark.textContent = text.slice(originalStart, originalEnd)

  const before = text.slice(0, originalStart)
  const after = text.slice(originalEnd)

  if (before.length > 0) target.append(document.createTextNode(before))
  target.append(mark)
  if (after.length > 0) target.append(document.createTextNode(after))
}
