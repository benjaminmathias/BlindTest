import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './id'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createId', () => {
  it('produit un UUID v4 valide', () => {
    expect(createId()).toMatch(UUID_PATTERN)
  })

  it('retombe sur getRandomValues quand randomUUID est absent', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab)
        return bytes
      },
    })

    expect(createId()).toMatch(UUID_PATTERN)
  })
})
