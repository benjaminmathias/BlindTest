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

  it('déduplique les éditions remaster en préférant le titre propre', () => {
    const remastered: Track = { ...track(1, 'Wonderwall (Remastered)'), artist: 'Oasis' }
    const clean: Track = { ...track(2, 'Wonderwall'), artist: 'Oasis' }

    expect(deduplicateTracks([remastered, clean])).toEqual([clean])
    expect(deduplicateTracks([clean, remastered])).toEqual([clean])
    expect(deduplicateTracks([remastered])).toEqual([remastered])
  })

  it('écarte les versions parasites de la recherche iTunes', async () => {
    const clean = Array.from({ length: 20 }, (_, index) => ({
      trackId: index,
      trackName: `Titre ${index}`,
      artistName: `Artiste ${index}`,
      previewUrl: 'audio',
      artworkUrl100: 'image',
      primaryGenreName: 'Pop',
    }))
    const parasites = ['Wonderwall (Instrumental)', 'Wonderwall (Karaoke Version)']
      .map((name, index) => ({
        trackId: 100 + index,
        trackName: name,
        artistName: 'Oasis',
        previewUrl: 'audio',
        artworkUrl100: 'image',
        primaryGenreName: 'Pop',
      }))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [...clean, ...parasites] }),
    }))

    const tracks = await fetchTracks('pop')

    expect(tracks).toHaveLength(20)
    expect(tracks.some((item) => /instrumental|karaoke|tribute|cover/i.test(item.title)))
      .toBe(false)
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
