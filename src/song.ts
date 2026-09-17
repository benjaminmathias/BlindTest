export type SongIdentity = {
  title: string
  artist: string
}

export function normalizeComparableText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Normalisation caractère par caractère : renvoie le texte comparable et, pour
// chaque caractère normalisé, son index dans le texte d'origine. Sert à
// surligner une correspondance sans perdre les accents ni les espaces.
export function normalizeWithIndex(text: string): { normalized: string; map: number[] } {
  let normalized = ''
  const map: number[] = []

  for (let index = 0; index < text.length; index += 1) {
    const base = (text[index] ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    for (const character of base) {
      if (/\s/.test(character)) {
        if (normalized.length === 0 || normalized.endsWith(' ')) continue
        normalized += ' '
      } else {
        normalized += character
      }
      map.push(index)
    }
  }

  while (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    map.pop()
  }

  return { normalized, map }
}

function words(value: string): string[] {
  return normalizeComparableText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const REMASTER_WORDS = new Set(['remaster', 'remastered'])
const IGNORED_MARKER_WORDS = new Set(['version', 'edition'])
const YEAR_PATTERN = /^(?:19|20)\d{2}$/

function isRemasterMarker(content: string): boolean {
  const tokens = words(content).filter((word) => !IGNORED_MARKER_WORDS.has(word))

  if (tokens.length === 0 || tokens.length > 2) {
    return false
  }

  let hasRemaster = false

  for (const word of tokens) {
    if (REMASTER_WORDS.has(word)) {
      hasRemaster = true
      continue
    }

    if (YEAR_PATTERN.test(word)) {
      continue
    }

    return false
  }

  return hasRemaster
}

type MarkerSegment = {
  start: number
  end: number
  content: string
}

function findBracketSegments(title: string): MarkerSegment[] {
  const pattern = /\s*(?:\(([^()]*)\)|\[([^\[\]]*)\])/g
  const segments: MarkerSegment[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(title)) !== null) {
    segments.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1] ?? match[2] ?? '',
    })
  }

  return segments
}

function findDashSegment(title: string): MarkerSegment | null {
  const match = /\s[-–—]\s*([^-–—]+)$/.exec(title)

  if (!match) {
    return null
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
    content: match[1] ?? '',
  }
}

export function canonicalizeSongTitle(title: string): string {
  const original = title.trim()

  if (original.length === 0) {
    return original
  }

  let result = original
  const remasterBrackets = findBracketSegments(original)
    .filter((segment) => isRemasterMarker(segment.content))

  for (let index = remasterBrackets.length - 1; index >= 0; index -= 1) {
    const segment = remasterBrackets[index]!
    result = result.slice(0, segment.start) + result.slice(segment.end)
  }

  const dashSegment = findDashSegment(result)

  if (dashSegment && isRemasterMarker(dashSegment.content)) {
    result = result.slice(0, dashSegment.start)
  }

  const cleaned = result.replace(/\s{2,}/g, ' ').replace(/[\s\-–—]+$/g, '').trim()

  return cleaned.length > 0 ? cleaned : original
}

export function getDisplaySongTitle(title: string): string {
  return canonicalizeSongTitle(title)
}

const PARASITE_WORDS = new Set(['karaoke', 'tribute', 'cover', 'instrumental'])

function hasParasiteWord(content: string): boolean {
  return words(content).some((word) => PARASITE_WORDS.has(word))
}

export function isParasiteVersion(title: string): boolean {
  const bracketSegments = findBracketSegments(title)

  if (bracketSegments.some((segment) => hasParasiteWord(segment.content))) {
    return true
  }

  const dashSegment = findDashSegment(title)

  return dashSegment !== null && hasParasiteWord(dashSegment.content)
}

export function getCanonicalSongKey(song: SongIdentity): string {
  return `${normalizeComparableText(song.artist)}|${normalizeComparableText(canonicalizeSongTitle(song.title))}`
}

export function isSameSong(first: SongIdentity, second: SongIdentity): boolean {
  return getCanonicalSongKey(first) === getCanonicalSongKey(second)
}
