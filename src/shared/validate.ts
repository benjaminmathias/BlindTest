export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isInt(value: unknown, min = 0): value is number {
  return Number.isInteger(value) && (value as number) >= min
}

export function oneOf<T>(value: unknown, values: readonly T[]): value is T {
  return (values as readonly unknown[]).includes(value)
}

export function isArrayOf<T>(
  value: unknown,
  check: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(check)
}

export function asValid<T>(
  value: unknown,
  isValid: (input: unknown) => input is T,
): T | null {
  return isValid(value) ? value : null
}

export function isShape<T>(
  checks: Record<string, (value: unknown) => boolean>,
): (value: unknown) => value is T {
  const entries = Object.entries(checks)

  return (value): value is T =>
    isRecord(value) && entries.every(([key, check]) => check(value[key]))
}

export function isNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

export function isText(value: unknown): value is string {
  return typeof value === 'string'
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function optional<T>(
  value: unknown,
  check: (input: unknown) => input is T,
): boolean {
  return value === undefined || check(value)
}
