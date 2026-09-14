import { describe, expect, it } from 'vitest'
import { getArtworkSrcSet, getArtworkUrl } from './artwork'

const ARTWORK = 'https://example.com/art/100x100bb.jpg'

describe('artwork', () => {
  it('demande une grande couverture par défaut', () => {
    expect(getArtworkUrl(ARTWORK)).toBe('https://example.com/art/600x600bb.jpg')
    expect(getArtworkUrl('')).toBe('')
  })

  it('construit un srcset responsive', () => {
    expect(getArtworkSrcSet(ARTWORK)).toBe(
      'https://example.com/art/200x200bb.jpg 200w, '
      + 'https://example.com/art/400x400bb.jpg 400w, '
      + 'https://example.com/art/600x600bb.jpg 600w',
    )
  })

  it('n’invente pas de variantes sans le motif attendu', () => {
    expect(getArtworkSrcSet('https://example.com/art/cover.jpg')).toBe('')
    expect(getArtworkSrcSet('')).toBe('')
    expect(getArtworkUrl('https://example.com/art/cover.jpg')).toBe(
      'https://example.com/art/cover.jpg',
    )
  })
})
