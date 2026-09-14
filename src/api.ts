import {
  canonicalizeSongTitle,
  getCanonicalSongKey,
  isParasiteVersion,
  normalizeComparableText,
} from './song'

export type Track = {
  id: string
  title: string
  artist: string
  audioUrl: string
  imageUrl: string
}

export type MusicTheme = 'all' | 'pop' | 'rock' | 'rap' | 'electro'

export const MUSIC_THEMES = ['all', 'pop', 'rock', 'rap', 'electro'] as const

export const MUSIC_THEME_LABELS: Record<MusicTheme, string> = {
  all: 'Tous',
  pop: 'Pop',
  rock: 'Rock',
  rap: 'Rap / Hip-Hop',
  electro: 'Électro',
}

export function isMusicTheme(value: unknown): value is MusicTheme {
  return typeof value === 'string' && (MUSIC_THEMES as readonly string[]).includes(value)
}

type ITunesTrack = {
  trackId: number
  trackName: string
  artistName: string
  previewUrl?: string
  artworkUrl100?: string
  primaryGenreName: string
}

type ITunesResponse = {
  results: ITunesTrack[]
}

type ThemeConfig = {
  queries: string[]
  genres: string[]
}

type StoredCatalog = {
  savedAt: number
  tracks: Track[]
}

const CONCRETE_THEMES: Exclude<MusicTheme, 'all'>[] = ['pop', 'rock', 'rap', 'electro']

// Genres observés sur itunes.apple.com/search avec country=FR.
// La comparaison est normalisée (accents retirés, minuscules).
const THEME_CONFIG: Record<Exclude<MusicTheme, 'all'>, ThemeConfig> = {
  pop: {
    queries: ['pop', 'pop music'],
    genres: ['Pop'],
  },
  rock: {
    queries: ['rock'],
    genres: ['Rock', 'Alternative', 'Hard rock', 'Rock indépendant'],
  },
  rap: {
    queries: ['hip hop', 'rap'],
    genres: ['Hip-hop/Rap', 'Hip-hop'],
  },
  electro: {
    queries: ['electronic', 'dance', 'house'],
    genres: ['Dance', 'Électronique', 'House', 'Techno', 'Trance'],
  },
}

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const ITUNES_LIMIT = '200'
export const MIN_CATALOG_SIZE = 20

const CATALOG_STORAGE_KEY = 'blindtest-catalog-v1'
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_MAX_ATTEMPTS = 3
const FETCH_RETRY_BASE_DELAY_MS = 250
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTrack(value: unknown): value is Track {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.artist === 'string'
    && typeof value.audioUrl === 'string'
    && typeof value.imageUrl === 'string'
}

function normalizeGenre(genre: string): string {
  return genre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function hasCleanTitle(track: Track): boolean {
  return normalizeComparableText(track.title)
    === normalizeComparableText(canonicalizeSongTitle(track.title))
}

export function deduplicateTracks(tracks: Track[]): Track[] {
  const uniqueTracks = new Map<string, Track>()

  for (const track of tracks) {
    const key = getCanonicalSongKey(track)
    const existing = uniqueTracks.get(key)

    if (!existing) {
      uniqueTracks.set(key, track)
      continue
    }

    if (hasCleanTitle(track) && !hasCleanTitle(existing)) {
      uniqueTracks.set(key, track)
    }
  }

  return [...uniqueTracks.values()]
}

function countDistinctTitles(tracks: Track[]): number {
  return new Set(
    tracks.map((track) => normalizeComparableText(canonicalizeSongTitle(track.title))),
  ).size
}

function isCatalogSufficient(tracks: Track[]): boolean {
  return tracks.length >= MIN_CATALOG_SIZE && countDistinctTitles(tracks) >= 4
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }
    return localStorage
  } catch {
    return null
  }
}

function catalogStorageKey(theme: MusicTheme): string {
  return `${CATALOG_STORAGE_KEY}:${theme}`
}

function readStoredCatalog(theme: MusicTheme): Track[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(catalogStorageKey(theme))
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)

    if (
      !isRecord(parsed)
      || typeof parsed.savedAt !== 'number'
      || !Array.isArray(parsed.tracks)
      || !parsed.tracks.every(isTrack)
    ) {
      storage.removeItem(catalogStorageKey(theme))
      return null
    }

    if (Date.now() - parsed.savedAt > CATALOG_TTL_MS) {
      storage.removeItem(catalogStorageKey(theme))
      return null
    }

    return parsed.tracks
  } catch {
    return null
  }
}

function writeStoredCatalog(theme: MusicTheme, tracks: Track[]): void {
  const storage = getStorage()
  if (!storage) return

  try {
    const payload: StoredCatalog = { savedAt: Date.now(), tracks }
    storage.setItem(catalogStorageKey(theme), JSON.stringify(payload))
  } catch {
    // Quota dépassé ou mode privé : le cache mémoire suffit pour la session.
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status)
}

async function fetchJson<T>(query: string, url: URL): Promise<T> {
  let lastError: Error = new Error(`Erreur HTTP pour la recherche « ${query} »`)

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    let response: Response

    try {
      response = await fetch(url)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === FETCH_MAX_ATTEMPTS) break
      await sleep(FETCH_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      continue
    }

    if (response.ok) {
      return await response.json() as T
    }

    lastError = new Error(`Erreur HTTP pour la recherche « ${query} » : ${response.status}`)

    if (!isRetryableStatus(response.status) || attempt === FETCH_MAX_ATTEMPTS) {
      break
    }

    await sleep(FETCH_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
  }

  throw lastError
}

async function fetchTracksForQuery(
  query: string,
  acceptedGenres: Set<string>,
): Promise<Track[]> {
  const url = new URL(ITUNES_SEARCH_URL)
  url.search = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    country: 'FR',
    limit: ITUNES_LIMIT,
  }).toString()

  const data = await fetchJson<ITunesResponse>(query, url)

  return (data.results ?? [])
    .filter(
      (track) =>
        track.previewUrl
        && acceptedGenres.has(normalizeGenre(track.primaryGenreName ?? ''))
        && !isParasiteVersion(track.trackName),
    )
    .map((track) => ({
      id: String(track.trackId),
      title: track.trackName,
      artist: track.artistName,
      audioUrl: track.previewUrl ?? '',
      imageUrl: track.artworkUrl100 ?? '',
    }))
}

const queryCache = new Map<string, Promise<Track[]>>()

function fetchTracksForQueryCached(
  query: string,
  acceptedGenres: Set<string>,
): Promise<Track[]> {
  const key = `${query}|${[...acceptedGenres].sort().join(',')}`
  const cached = queryCache.get(key)

  if (cached) {
    return cached
  }

  const promise = fetchTracksForQuery(query, acceptedGenres).catch((error: unknown) => {
    queryCache.delete(key)
    throw error
  })
  queryCache.set(key, promise)
  return promise
}

async function fetchTracksForTheme(theme: Exclude<MusicTheme, 'all'>): Promise<Track[]> {
  const config = THEME_CONFIG[theme]
  const acceptedGenres = new Set(config.genres.map(normalizeGenre))

  const results = await Promise.allSettled(
    config.queries.map((query) => fetchTracksForQueryCached(query, acceptedGenres)),
  )

  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`${failures.length} recherche(s) iTunes ont échoué pour le thème ${theme}`)
  }

  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}

const catalogCache = new Map<MusicTheme, Track[]>()

export function clearCatalogCache(): void {
  catalogCache.clear()
  queryCache.clear()

  const storage = getStorage()
  if (!storage) return

  for (const theme of MUSIC_THEMES) {
    try {
      storage.removeItem(catalogStorageKey(theme))
    } catch {
      // Ignore : un cache non supprimable ne doit pas faire échouer l'appel.
    }
  }
}

export async function fetchTracks(theme: MusicTheme = 'all'): Promise<Track[]> {
  const cached = catalogCache.get(theme)
  if (cached) {
    return cached
  }

  const stored = readStoredCatalog(theme)
  if (stored && isCatalogSufficient(stored)) {
    catalogCache.set(theme, stored)
    return stored
  }

  const themesToLoad = theme === 'all' ? CONCRETE_THEMES : [theme]
  const results = await Promise.allSettled(
    themesToLoad.map((currentTheme) => fetchTracksForTheme(currentTheme)),
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`${failures.length} thème(s) iTunes n'ont pas pu être chargés`)
  }

  const perTheme = new Map<MusicTheme, Track[]>()
  results.forEach((result, index) => {
    const currentTheme = themesToLoad[index]
    if (currentTheme && result.status === 'fulfilled') {
      perTheme.set(currentTheme, deduplicateTracks(result.value))
    }
  })

  const tracks = deduplicateTracks(
    results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
  )

  if (!isCatalogSufficient(tracks)) {
    throw new Error(
      `Catalogue insuffisant pour le thème « ${MUSIC_THEME_LABELS[theme]} » `
      + `(${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}, ${MIN_CATALOG_SIZE} minimum).`,
    )
  }

  catalogCache.set(theme, tracks)
  writeStoredCatalog(theme, tracks)

  if (theme === 'all') {
    for (const [currentTheme, currentTracks] of perTheme) {
      if (isCatalogSufficient(currentTracks)) {
        catalogCache.set(currentTheme, currentTracks)
        writeStoredCatalog(currentTheme, currentTracks)
      }
    }
  }

  return tracks
}
