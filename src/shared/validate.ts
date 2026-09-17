export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isInt = (value: unknown, min = 0): value is number =>
  Number.isInteger(value) && (value as number) >= min

export const oneOf = <T>(value: unknown, values: readonly T[]): value is T =>
  (values as readonly unknown[]).includes(value)

export const isArrayOf = <T>(
  value: unknown,
  check: (item: unknown) => item is T,
): value is T[] => Array.isArray(value) && value.every(check)

export const asValid = <T>(
  value: unknown,
  isValid: (input: unknown) => input is T,
): T | null => (isValid(value) ? value : null)

export function isShape<T>(
  checks: Record<string, (value: unknown) => boolean>,
): (value: unknown) => value is T {
  const entries = Object.entries(checks)
  return (value): value is T =>
    isRecord(value) && entries.every(([key, check]) => check(value[key]))
}

export const isNonNegative = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0

export const isText = (value: unknown): value is string => typeof value === 'string'
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export const optional = <T>(
  value: unknown,
  check: (input: unknown) => input is T,
): boolean => value === undefined || check(value)
