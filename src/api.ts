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

function normalizeTrackKey(track: Track): string {
  return `${track.artist.trim().toLowerCase()}|${track.title.trim().toLowerCase()}`
}

function deduplicateTracks(tracks: Track[]): Track[] {
  const uniqueTracks = new Map<string, Track>()

  for (const track of tracks) {
    const key = normalizeTrackKey(track)

    if (!uniqueTracks.has(key)) {
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
        track.previewUrl && acceptedGenres.has(normalizeGenre(track.primaryGenreName ?? '')),
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

  const tracksByQuery = await Promise.all(
    config.queries.map((query) => fetchTracksForQuery(query, acceptedGenres)),
  )

  return tracksByQuery.flat()
}

export async function fetchTracks(theme: MusicTheme = 'all'): Promise<Track[]> {
  const themesToLoad = theme === 'all' ? CONCRETE_THEMES : [theme]
  const tracksByTheme = await Promise.all(
    themesToLoad.map((currentTheme) => fetchTracksForTheme(currentTheme)),
  )
  const tracks = deduplicateTracks(tracksByTheme.flat())

  if (tracks.length < MIN_CATALOG_SIZE) {
    throw new Error(
      `Catalogue insuffisant pour le thème « ${MUSIC_THEME_LABELS[theme]} » `
      + `(${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}, ${MIN_CATALOG_SIZE} minimum).`,
    )
  }

  return tracks
}
