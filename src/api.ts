import {
  canonicalizeSongTitle,
  getCanonicalSongKey,
  isParasiteVersion,
  normalizeComparableText,
} from './song'
import { isRecord, isString, oneOf } from './shared/validate'

export type Track = {
  id: string
  title: string
  artist: string
  audioUrl: string
  imageUrl: string
}

export type ConcreteMusicTheme = 'pop' | 'rock' | 'rap' | 'electro' | 'chanson' | 'funk'
export type MusicTheme = 'all' | ConcreteMusicTheme

type ThemeDefinition = {
  label: string
  /** Libellés de genre iTunes normalisés rattachés à ce thème (FR et EN). */
  genres: readonly string[]
  queries: readonly string[]
}

// Source de vérité unique : un thème déclare son libellé, les genres iTunes qui
// lui correspondent et les requêtes de recherche qui l'alimentent.
export const THEMES: Record<ConcreteMusicTheme, ThemeDefinition> = {
  pop: { label: 'Pop', genres: ['pop'], queries: ['pop', 'pop music'] },
  rock: {
    label: 'Rock',
    genres: ['rock', 'alternative', 'hard rock', 'rock independant', 'indie rock'],
    queries: ['rock'],
  },
  rap: {
    label: 'Rap / Hip-Hop',
    genres: ['hip-hop', 'hip-hop/rap', 'hip hop', 'rap', 'rap francais'],
    queries: ['hip hop', 'rap'],
  },
  electro: {
    label: 'Électro',
    genres: ['dance', 'electronic', 'electronique', 'house', 'techno', 'trance'],
    queries: ['electronic', 'dance', 'house'],
  },
  chanson: {
    label: 'Chanson française',
    genres: ['variete francaise', 'chanson francaise', 'chanson', 'french pop', 'pop francaise', 'francais'],
    queries: ['variete francaise', 'chanson francaise'],
  },
  funk: {
    label: 'Funk / Disco',
    genres: ['funk', 'disco', 'baile funk', 'motown'],
    queries: ['funk', 'disco', 'disco funk'],
  },
}

const CONCRETE_THEMES = Object.keys(THEMES) as ConcreteMusicTheme[]

export const MUSIC_THEMES = ['all', ...CONCRETE_THEMES] as MusicTheme[]

export const MUSIC_THEME_LABELS = {
  all: 'Tous',
  pop: THEMES.pop.label,
  rock: THEMES.rock.label,
  rap: THEMES.rap.label,
  electro: THEMES.electro.label,
  chanson: THEMES.chanson.label,
  funk: THEMES.funk.label,
} satisfies Record<MusicTheme, string>

export const isMusicTheme = (value: unknown): value is MusicTheme =>
  oneOf(value, MUSIC_THEMES)

const GENRE_TO_THEME = new Map<string, ConcreteMusicTheme>(
  CONCRETE_THEMES.flatMap((theme) =>
    THEMES[theme].genres.map((genre) => [genre, theme] as const),
  ),
)

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

type StoredCatalog = {
  savedAt: number
  tracks: Track[]
}

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
export const MIN_CATALOG_SIZE = 20

const CATALOG_STORAGE_KEY = 'blindtest-catalog-v5'
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_MAX_ATTEMPTS = 3
const FETCH_RETRY_BASE_DELAY_MS = 250
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

const isTrack = (value: unknown): value is Track =>
  isRecord(value)
  && isString(value.id)
  && isString(value.title)
  && isString(value.artist)
  && typeof value.audioUrl === 'string'
  && typeof value.imageUrl === 'string'

const normalizeGenre = (genre: string): string =>
  genre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

const hasCleanTitle = (track: Track): boolean =>
  normalizeComparableText(track.title)
  === normalizeComparableText(canonicalizeSongTitle(track.title))

export function deduplicateTracks(tracks: Track[]): Track[] {
  const uniqueTracks = new Map<string, Track>()

  for (const track of tracks) {
    const key = getCanonicalSongKey(track)
    const existing = uniqueTracks.get(key)

    if (!existing || (hasCleanTitle(track) && !hasCleanTitle(existing))) {
      uniqueTracks.set(key, track)
    }
  }

  return [...uniqueTracks.values()]
}

const countDistinctTitles = (tracks: Track[]): number =>
  new Set(
    tracks.map((track) => normalizeComparableText(canonicalizeSongTitle(track.title))),
  ).size

const isCatalogSufficient = (tracks: Track[]): boolean =>
  tracks.length >= MIN_CATALOG_SIZE && countDistinctTitles(tracks) >= 4

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const catalogStorageKey = (theme: MusicTheme): string => `${CATALOG_STORAGE_KEY}:${theme}`

function readStoredCatalog(theme: MusicTheme): Track[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(catalogStorageKey(theme))
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    const valid = isRecord(parsed)
      && typeof parsed.savedAt === 'number'
      && Array.isArray(parsed.tracks)
      && parsed.tracks.every(isTrack)

    if (!valid || Date.now() - (parsed as StoredCatalog).savedAt > CATALOG_TTL_MS) {
      storage.removeItem(catalogStorageKey(theme))
      return null
    }

    return (parsed as StoredCatalog).tracks
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

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchJson<T>(query: string, url: URL): Promise<T> {
  let lastError = new Error(`Erreur HTTP pour la recherche « ${query} »`)

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json() as T

      lastError = new Error(`Erreur HTTP pour la recherche « ${query} » : ${response.status}`)
      if (!RETRYABLE_STATUS_CODES.has(response.status)) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    if (attempt < FETCH_MAX_ATTEMPTS) {
      await sleep(FETCH_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
    }
  }

  throw lastError
}

async function fetchTracksForQuery(
  query: string,
  theme: ConcreteMusicTheme,
): Promise<Track[]> {
  const url = new URL(ITUNES_SEARCH_URL)
  url.search = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    country: 'FR',
    limit: '200',
  }).toString()

  const data = await fetchJson<ITunesResponse>(query, url)

  return (data.results ?? [])
    .filter((track) =>
      track.previewUrl
      && GENRE_TO_THEME.get(normalizeGenre(track.primaryGenreName ?? '')) === theme
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

function fetchTracksForQueryCached(query: string, theme: ConcreteMusicTheme): Promise<Track[]> {
  const key = `${theme}|${query}`
  const cached = queryCache.get(key)
  if (cached) return cached

  const promise = fetchTracksForQuery(query, theme).catch((error: unknown) => {
    queryCache.delete(key)
    throw error
  })
  queryCache.set(key, promise)
  return promise
}

async function fetchTracksForTheme(theme: ConcreteMusicTheme): Promise<Track[]> {
  const results = await Promise.allSettled(
    THEMES[theme].queries.map((query) => fetchTracksForQueryCached(query, theme)),
  )

  const failures = results.filter((result) => result.status === 'rejected').length
  if (failures > 0) {
    console.warn(`${failures} recherche(s) iTunes ont échoué pour le thème ${theme}`)
  }

  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
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
  if (cached) return cached

  const stored = readStoredCatalog(theme)
  if (stored && isCatalogSufficient(stored)) {
    catalogCache.set(theme, stored)
    return stored
  }

  const themesToLoad = theme === 'all' ? CONCRETE_THEMES : [theme]
  const results = await Promise.allSettled(themesToLoad.map(fetchTracksForTheme))

  const failures = results.filter((result) => result.status === 'rejected').length
  if (failures > 0) {
    console.warn(`${failures} thème(s) iTunes n'ont pas pu être chargés`)
  }

  const perTheme = new Map<ConcreteMusicTheme, Track[]>()
  results.forEach((result, index) => {
    const currentTheme = themesToLoad[index]
    if (currentTheme && result.status === 'fulfilled') {
      perTheme.set(currentTheme, deduplicateTracks(result.value))
    }
  })

  const tracks = deduplicateTracks(
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
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
