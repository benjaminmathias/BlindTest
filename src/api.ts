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

export const MUSIC_THEMES = ['all', 'pop', 'rock', 'rap', 'electro', 'chanson', 'funk'] as const

export type MusicTheme = (typeof MUSIC_THEMES)[number]

export type ConcreteMusicTheme = Exclude<MusicTheme, 'all'>

export const MUSIC_MARKETS = ['fr', 'international'] as const

export type MusicMarket = (typeof MUSIC_MARKETS)[number]

export const DEFAULT_MUSIC_MARKET: MusicMarket = 'fr'

export const MUSIC_MARKET_LABELS: Record<MusicMarket, string> = {
  fr: 'Français',
  international: 'International',
}

// Seul levier « gratuit » de l'API iTunes pour changer de catalogue : le storefront.
export const MUSIC_MARKET_COUNTRY: Record<MusicMarket, string> = {
  fr: 'FR',
  international: 'US',
}

export const MUSIC_THEME_LABELS: Record<MusicTheme, string> = {
  all: 'Tous',
  pop: 'Pop',
  rock: 'Rock',
  rap: 'Rap / Hip-Hop',
  electro: 'Électro',
  chanson: 'Chanson française',
  funk: 'Funk / Disco',
}

export function isMusicTheme(value: unknown): value is MusicTheme {
  return typeof value === 'string' && (MUSIC_THEMES as readonly string[]).includes(value)
}

export function isMusicMarket(value: unknown): value is MusicMarket {
  return typeof value === 'string' && (MUSIC_MARKETS as readonly string[]).includes(value)
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
}

type StoredCatalog = {
  savedAt: number
  tracks: Track[]
}

const CONCRETE_THEMES: ConcreteMusicTheme[] = ['pop', 'rock', 'rap', 'electro', 'chanson', 'funk']

// Source de vérité unique, commune aux storefronts FR et US : un libellé de genre
// iTunes normalisé est rattaché à un seul thème, quelle que soit la langue du
// storefront (ex. « Electronic » en US, « Électronique » en FR).
const GENRE_TO_THEME: Record<string, ConcreteMusicTheme> = {
  pop: 'pop',
  rock: 'rock',
  alternative: 'rock',
  'hard rock': 'rock',
  'rock independant': 'rock',
  'indie rock': 'rock',
  'hip-hop': 'rap',
  'hip-hop/rap': 'rap',
  'hip hop': 'rap',
  rap: 'rap',
  'rap francais': 'rap',
  dance: 'electro',
  electronic: 'electro',
  electronique: 'electro',
  house: 'electro',
  techno: 'electro',
  trance: 'electro',
  'variete francaise': 'chanson',
  'chanson francaise': 'chanson',
  chanson: 'chanson',
  'french pop': 'chanson',
  'pop francaise': 'chanson',
  francais: 'chanson',
  funk: 'funk',
  disco: 'funk',
  'baile funk': 'funk',
  motown: 'funk',
}

const THEME_CONFIG: Record<ConcreteMusicTheme, ThemeConfig> = {
  pop: {
    queries: ['pop', 'pop music'],
  },
  rock: {
    queries: ['rock'],
  },
  rap: {
    queries: ['hip hop', 'rap'],
  },
  electro: {
    queries: ['electronic', 'dance', 'house'],
  },
  chanson: {
    queries: ['variete francaise', 'chanson francaise'],
  },
  funk: {
    queries: ['funk', 'disco', 'disco funk'],
  },
}

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const ITUNES_LIMIT = '200'
export const MIN_CATALOG_SIZE = 20

const CATALOG_STORAGE_KEY = 'blindtest-catalog-v4'
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

function catalogStorageKey(market: MusicMarket, theme: MusicTheme): string {
  return `${CATALOG_STORAGE_KEY}:${market}:${theme}`
}

function readStoredCatalog(market: MusicMarket, theme: MusicTheme): Track[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(catalogStorageKey(market, theme))
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)

    if (
      !isRecord(parsed)
      || typeof parsed.savedAt !== 'number'
      || !Array.isArray(parsed.tracks)
      || !parsed.tracks.every(isTrack)
    ) {
      storage.removeItem(catalogStorageKey(market, theme))
      return null
    }

    if (Date.now() - parsed.savedAt > CATALOG_TTL_MS) {
      storage.removeItem(catalogStorageKey(market, theme))
      return null
    }

    return parsed.tracks
  } catch {
    return null
  }
}

function writeStoredCatalog(market: MusicMarket, theme: MusicTheme, tracks: Track[]): void {
  const storage = getStorage()
  if (!storage) return

  try {
    const payload: StoredCatalog = { savedAt: Date.now(), tracks }
    storage.setItem(catalogStorageKey(market, theme), JSON.stringify(payload))
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
  theme: ConcreteMusicTheme,
  market: MusicMarket,
): Promise<Track[]> {
  const url = new URL(ITUNES_SEARCH_URL)
  url.search = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    country: MUSIC_MARKET_COUNTRY[market],
    limit: ITUNES_LIMIT,
  }).toString()

  const data = await fetchJson<ITunesResponse>(query, url)

  return (data.results ?? [])
    .filter(
      (track) =>
        track.previewUrl
        && GENRE_TO_THEME[normalizeGenre(track.primaryGenreName ?? '')] === theme
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
  theme: ConcreteMusicTheme,
  market: MusicMarket,
): Promise<Track[]> {
  const key = `${market}|${theme}|${query}`
  const cached = queryCache.get(key)

  if (cached) {
    return cached
  }

  const promise = fetchTracksForQuery(query, theme, market).catch((error: unknown) => {
    queryCache.delete(key)
    throw error
  })
  queryCache.set(key, promise)
  return promise
}

async function fetchTracksForTheme(
  theme: ConcreteMusicTheme,
  market: MusicMarket,
): Promise<Track[]> {
  const config = THEME_CONFIG[theme]

  const results = await Promise.allSettled(
    config.queries.map((query) => fetchTracksForQueryCached(query, theme, market)),
  )

  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`${failures.length} recherche(s) iTunes ont échoué pour le thème ${theme}`)
  }

  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}

function catalogCacheKey(market: MusicMarket, theme: MusicTheme): string {
  return `${market}|${theme}`
}

const catalogCache = new Map<string, Track[]>()

export function clearCatalogCache(): void {
  catalogCache.clear()
  queryCache.clear()

  const storage = getStorage()
  if (!storage) return

  for (const market of MUSIC_MARKETS) {
    for (const theme of MUSIC_THEMES) {
      try {
        storage.removeItem(catalogStorageKey(market, theme))
      } catch {
        // Ignore : un cache non supprimable ne doit pas faire échouer l'appel.
      }
    }
  }
}

export async function fetchTracks(
  theme: MusicTheme = 'all',
  market: MusicMarket = DEFAULT_MUSIC_MARKET,
): Promise<Track[]> {
  const cacheKey = catalogCacheKey(market, theme)
  const cached = catalogCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const stored = readStoredCatalog(market, theme)
  if (stored && isCatalogSufficient(stored)) {
    catalogCache.set(cacheKey, stored)
    return stored
  }

  const themesToLoad = theme === 'all' ? CONCRETE_THEMES : [theme]
  const results = await Promise.allSettled(
    themesToLoad.map((currentTheme) => fetchTracksForTheme(currentTheme, market)),
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`${failures.length} thème(s) iTunes n'ont pas pu être chargés`)
  }

  const perTheme = new Map<ConcreteMusicTheme, Track[]>()
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

  catalogCache.set(cacheKey, tracks)
  writeStoredCatalog(market, theme, tracks)

  if (theme === 'all') {
    for (const [currentTheme, currentTracks] of perTheme) {
      if (isCatalogSufficient(currentTracks)) {
        catalogCache.set(catalogCacheKey(market, currentTheme), currentTracks)
        writeStoredCatalog(market, currentTheme, currentTracks)
      }
    }
  }

  return tracks
}
