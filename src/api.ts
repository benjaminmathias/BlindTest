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

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Erreur HTTP pour la recherche « ${query} » : ${response.status}`)
  }

  const data: ITunesResponse = await response.json()

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

async function fetchTracksForTheme(theme: Exclude<MusicTheme, 'all'>): Promise<Track[]> {
  const config = THEME_CONFIG[theme]
  const acceptedGenres = new Set(config.genres.map(normalizeGenre))

  const results = await Promise.allSettled(
    config.queries.map((query) => fetchTracksForQuery(query, acceptedGenres)),
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
}

export async function fetchTracks(theme: MusicTheme = 'all'): Promise<Track[]> {
  const cached = catalogCache.get(theme)
  if (cached) {
    return cached
  }

  const themesToLoad = theme === 'all' ? CONCRETE_THEMES : [theme]
  const results = await Promise.allSettled(
    themesToLoad.map((currentTheme) => fetchTracksForTheme(currentTheme)),
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`${failures.length} thème(s) iTunes n'ont pas pu être chargés`)
  }
  const tracks = deduplicateTracks(
    results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
  )
  const distinctTitleCount = new Set(
    tracks.map((track) =>
      normalizeComparableText(canonicalizeSongTitle(track.title)),
    ),
  ).size

  if (tracks.length < MIN_CATALOG_SIZE || distinctTitleCount < 4) {
    throw new Error(
      `Catalogue insuffisant pour le thème « ${MUSIC_THEME_LABELS[theme]} » `
      + `(${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}, ${MIN_CATALOG_SIZE} minimum).`,
    )
  }

  catalogCache.set(theme, tracks)
  return tracks
}
