import { describe, expect, it } from 'vitest'
import {
  generateRoomCode,
  isValidPlayerName,
  isValidRoomCode,
  normalizePlayerName,
  normalizeRoomCode,
} from './room'

describe('code de partie', () => {
  it('génère un code valide de quatre caractères', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(4)
    expect(isValidRoomCode(code)).toBe(true)
  })

  it('normalise espaces, casse et caractères parasites', () => {
    expect(normalizeRoomCode('  k7 fd ')).toBe('K7FD')
  })

  it('refuse les codes de mauvaise longueur ou avec des caractères ambigus', () => {
    expect(isValidRoomCode('ABC')).toBe(false)
    expect(isValidRoomCode('ABCDE')).toBe(false)
    expect(isValidRoomCode('AB0D')).toBe(false)
    expect(isValidRoomCode('ABIO')).toBe(false)
  })
})

describe('pseudo', () => {
  it('nettoie les espaces', () => {
    expect(normalizePlayerName('  Léa  ')).toBe('Léa')
  })

  it('exige entre deux et vingt caractères', () => {
    expect(isValidPlayerName('Léa')).toBe(true)
    expect(isValidPlayerName('A')).toBe(false)
    expect(isValidPlayerName('a'.repeat(21))).toBe(false)
  })
})
