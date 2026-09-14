import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCatalogCache, deduplicateTracks, fetchTracks, type Track } from './api'

const track = (id: number, title = `Titre ${id}`): Track => ({
  id: String(id), title, artist: 'Artiste', audioUrl: 'audio', imageUrl: 'image',
})

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => { store.clear() },
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => { store.delete(key) },
    setItem: (key, value) => { store.set(key, value) },
  }
}

function itunesResults(count: number, genre = 'Pop') {
  return Array.from({ length: count }, (_, index) => ({
    trackId: index,
    trackName: `Titre ${index}`,
    artistName: `Artiste ${index}`,
    previewUrl: 'audio',
    artworkUrl100: 'image',
    primaryGenreName: genre,
  }))
}

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

  it('réessaie une recherche réseau échouée puis met en cache', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ results: itunesResults(20) }),
      })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTracks('pop')).toHaveLength(20)
    expect(await fetchTracks('pop')).toHaveLength(20)
    // Deux requêtes pop, dont une qui échoue une fois avant de réussir.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('réessaie un statut HTTP temporaire sans abandonner', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ results: itunesResults(20, 'Hip-hop/Rap') }),
      })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTracks('rap')).toHaveLength(20)
  })

  it('écrit le catalogue résolu dans le stockage local', async () => {
    const storage = createStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'Rock') }),
    }))

    await fetchTracks('rock')

    expect(storage.getItem('blindtest-catalog-v4:fr:rock')).not.toBeNull()
  })

  it('sert un catalogue persisté sans rappeler iTunes', async () => {
    const storage = createStorage()
    storage.setItem('blindtest-catalog-v4:fr:rock', JSON.stringify({
      savedAt: Date.now(),
      tracks: Array.from({ length: 20 }, (_, index) => track(index, `Titre ${index}`)),
    }))
    const fetchMock = vi.fn()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTracks('rock')).toHaveLength(20)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignore un catalogue persisté expiré', async () => {
    const storage = createStorage()
    storage.setItem('blindtest-catalog-v4:fr:rock', JSON.stringify({
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
      tracks: Array.from({ length: 20 }, (_, index) => track(index, `Titre ${index}`)),
    }))
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'Rock') }),
    })
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTracks('rock')).toHaveLength(20)
    expect(fetchMock).toHaveBeenCalled()
    expect(storage.getItem('blindtest-catalog-v4:fr:rock')).not.toBeNull()
  })

  it('refuse un catalogue final insuffisant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }))
    await expect(fetchTracks('rock')).rejects.toThrow('Catalogue insuffisant')
  })

  it('accepte les libellés de genre anglais du storefront international', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'Electronic') }),
    }))

    expect(await fetchTracks('electro', 'international')).toHaveLength(20)
  })

  it('sépare les catalogues et les caches par marché', async () => {
    const storage = createStorage()
    const requestedCountries: string[] = []
    const fetchMock = vi.fn().mockImplementation((url: URL) => {
      requestedCountries.push(url.searchParams.get('country') ?? '')
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: itunesResults(20, 'Rock') }),
      })
    })
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', fetchMock)

    await fetchTracks('rock', 'fr')
    await fetchTracks('rock', 'international')
    await fetchTracks('rock', 'fr')

    expect(requestedCountries).toEqual(['FR', 'US'])
    expect(storage.getItem('blindtest-catalog-v4:fr:rock')).not.toBeNull()
    expect(storage.getItem('blindtest-catalog-v4:international:rock')).not.toBeNull()
  })

  it('mappe Variété française vers la catégorie chanson', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'Variété française') }),
    }))

    expect(await fetchTracks('chanson', 'fr')).toHaveLength(20)
  })

  it('mappe French Pop vers la catégorie chanson en international', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'French Pop') }),
    }))

    expect(await fetchTracks('chanson', 'international')).toHaveLength(20)
  })

  it('accepte le genre Funk pour la catégorie funk', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'Funk') }),
    }))

    expect(await fetchTracks('funk', 'fr')).toHaveLength(20)
  })

  it('accepte le genre Disco pour la catégorie funk', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: itunesResults(20, 'Disco') }),
    }))

    expect(await fetchTracks('funk', 'fr')).toHaveLength(20)
  })
})
