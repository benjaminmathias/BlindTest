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
