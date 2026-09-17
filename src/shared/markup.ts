export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type SelectOption = {
  value: string | number
  label: string
}

export function renderOptions(
  options: readonly SelectOption[],
  selected: string | number,
): string {
  return options
    .map((option) =>
      `<option value="${option.value}"${option.value === selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
    )
    .join('')
}

export function renderSelect(
  id: string,
  label: string,
  options: readonly SelectOption[],
  selected: string | number,
  name = '',
): string {
  return `<div class="form-field"><label for="${id}">${label}</label><select id="${id}"${name ? ` name="${name}"` : ''}>${renderOptions(options, selected)}</select></div>`
}
