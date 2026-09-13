import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCatalogCache, deduplicateTracks, fetchTracks, type Track } from './api'

const track = (id: number, title = `Titre ${id}`): Track => ({
  id: String(id), title, artist: 'Artiste', audioUrl: 'audio', imageUrl: 'image',
})

afterEach(() => {
  clearCatalogCache()
  vi.unstubAllGlobals()
})

describe('catalogue', () => {
  it('déduplique artiste et titre normalisés', () => {
    expect(deduplicateTracks([track(1, 'Été'), { ...track(2, 'ete'), artist: ' artiste ' }])).toEqual([
      track(1, 'Été'),
    ])
  })

  it('conserve une recherche réussie quand une autre échoue et met en cache', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: Array.from({ length: 20 }, (_, index) => ({
          trackId: index,
          trackName: `Titre ${index}`,
          artistName: `Artiste ${index}`,
          previewUrl: 'audio',
          artworkUrl100: 'image',
          primaryGenreName: 'Pop',
        })) }),
      })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTracks('pop')).toHaveLength(20)
    expect(await fetchTracks('pop')).toHaveLength(20)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refuse un catalogue final insuffisant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }))
    await expect(fetchTracks('rock')).rejects.toThrow('Catalogue insuffisant')
  })
})
