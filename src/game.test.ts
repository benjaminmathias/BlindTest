import { describe, expect, it, vi } from 'vitest'
import type { Track } from './api'
import {
  findGuessOption, formatGuessOption, getAttemptScore, getRoundScore,
  MAX_SUGGESTIONS, pickUnplayedTrack, searchGuessOptions, type GuessOption,
} from './game'
import { getCanonicalSongKey } from './song'

const tracks: Track[] = Array.from({ length: 5 }, (_, index) => ({
  id: String(index),
  title: `Titre ${index}`,
  artist: `Artiste ${index}`,
  audioUrl: `audio-${index}`,
  imageUrl: `image-${index}`,
}))

function withRandom<T>(value: number, run: () => T): T {
  vi.spyOn(Math, 'random').mockReturnValue(value)
  try {
    return run()
  } finally {
    vi.restoreAllMocks()
  }
}

const pepperCatalog: GuessOption[] = [
  { id: '1', title: 'Californication', artist: 'Red Hot Chili Peppers' },
  { id: '2', title: 'Dani California', artist: 'Red Hot Chili Peppers' },
  { id: '3', title: 'Otherside', artist: 'Red Hot Chili Peppers' },
  { id: '4', title: 'Scar Tissue', artist: 'Red Hot Chili Peppers' },
  { id: '5', title: "Can't Stop", artist: 'Red Hot Chili Peppers' },
  { id: '6', title: 'By the Way', artist: 'Red Hot Chili Peppers' },
  { id: '7', title: 'Été', artist: 'Cali' },
  { id: '8', title: 'Some Cali Song', artist: 'Autre' },
]

const oasisCatalog: GuessOption[] = [
  { id: '1', title: 'Wonderwall', artist: 'Oasis' },
  { id: '2', title: 'Wonderwall (Remastered)', artist: 'Oasis' },
  { id: '3', title: 'Wonderwall (2014 Remaster)', artist: 'Oasis' },
  { id: '4', title: 'Champagne Supernova', artist: 'Oasis' },
]

describe('game', () => {
  it('tire un morceau non joué puis réinitialise le tour complet', () => {
    const played = new Set<string>(['0', '1'])
    expect(withRandom(0, () => pickUnplayedTrack(tracks, played)).id).toBe('2')
    expect(played.has('2')).toBe(true)

    const exhausted = new Set(tracks.map(({ id }) => id))
    expect(withRandom(0, () => pickUnplayedTrack(tracks, exhausted)).id).toBe('0')
    expect(exhausted.size).toBe(1)
  })

  it('résout une suggestion en ignorant casse et accents', () => {
    expect(formatGuessOption(tracks[0]!)).toBe('Titre 0 — Artiste 0')
    expect(findGuessOption([{ ...tracks[0]!, title: 'Été' }], ' ete — ARTISTE 0 ')?.id).toBe('0')
    expect(findGuessOption(tracks, 'réponse libre')).toBeNull()
  })
})

describe('score de manche', () => {
  it('décroît avec le temps et plafonne au score maximum', () => {
    expect(getRoundScore(10_000, 10_000, 1000)).toBe(1000)
    expect(getRoundScore(5_000, 10_000, 1000)).toBe(500)
    expect(getRoundScore(1, 10_000, 1000)).toBe(1)
    expect(getRoundScore(20_000, 10_000, 1000)).toBe(1000)
  })

  it('retourne zéro hors bornes et pour des entrées invalides', () => {
    const cases: [number, number, number][] = [
      [0, 10_000, 1000],
      [-1, 10_000, 1000],
      [Number.NaN, 10_000, 1000],
      [Number.POSITIVE_INFINITY, 10_000, 1000],
      [5_000, 0, 1000],
      [5_000, -1, 1000],
      [5_000, Number.NaN, 1000],
      [5_000, 10_000, 0],
      [5_000, 10_000, -100],
    ]

    for (const [remaining, duration, max] of cases) {
      expect(getRoundScore(remaining, duration, max)).toBe(0)
    }
  })

  it('applique la pénalité des cinq essais', () => {
    expect([1, 2, 3, 4, 5].map((attempt) =>
      getAttemptScore(10_000, 10_000, 1000, attempt),
    )).toEqual([1000, 800, 600, 400, 200])
  })

  it('refuse une tentative invalide ou expirée', () => {
    for (const attempt of [0, -1, 6, 1.5]) {
      expect(getAttemptScore(10_000, 10_000, 1000, attempt)).toBe(0)
    }
    expect(getAttemptScore(0, 10_000, 1000, 1)).toBe(0)
    expect(getAttemptScore(Number.NaN, 10_000, 1000, 1)).toBe(0)
  })
})

describe('searchGuessOptions', () => {
  it("n'affiche rien avant deux caractères", () => {
    expect(searchGuessOptions(pepperCatalog, '')).toEqual([])
    expect(searchGuessOptions(pepperCatalog, 'c')).toEqual([])
  })

  it('classe les résultats et limite à cinq', () => {
    expect(searchGuessOptions(pepperCatalog, 'cali').map(({ id }) => id))
      .toEqual(['1', '7', '2', '8'])
    expect(searchGuessOptions(pepperCatalog, 'red')).toHaveLength(5)
  })

  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(searchGuessOptions(pepperCatalog, '  CALI  ').map(({ id }) => id))
      .toEqual(['1', '7', '2', '8'])
    expect(searchGuessOptions(pepperCatalog, 'ete').map(({ id }) => id)).toEqual(['7'])
    expect(searchGuessOptions(pepperCatalog, 'red   hot')).toHaveLength(5)
  })

  it('déduplique par identifiant et par clé canonique', () => {
    const duplicates: GuessOption[] = [
      { id: 'a', title: 'Californication', artist: 'Red Hot Chili Peppers' },
      { id: 'a', title: 'Californication', artist: 'Red Hot Chili Peppers' },
      { id: 'b', title: 'Californication', artist: 'Red Hot Chili Peppers' },
      { id: 'c', title: 'Californication (Remaster)', artist: 'Red Hot Chili Peppers' },
    ]
    expect(searchGuessOptions(duplicates, 'cali')).toHaveLength(1)
  })

  it('ne montre qu’une édition et trouve par titre canonique ou artiste', () => {
    expect(searchGuessOptions(oasisCatalog, 'wonder')).toHaveLength(1)
    expect(searchGuessOptions(oasisCatalog, 'oasis').map(({ id }) => id)).toEqual(['1', '4'])
    expect(searchGuessOptions(
      [{ id: '9', title: 'Wonderwall (2014 Remaster)', artist: 'Oasis' }],
      'wonder',
    ).map(({ id }) => id)).toEqual(['9'])
  })
})

describe('exclusions canoniques', () => {
  const wonderwallKey = getCanonicalSongKey({ title: 'Wonderwall', artist: 'Oasis' })

  it('exclut toute la chanson logique avant la déduplication', () => {
    expect(searchGuessOptions(oasisCatalog, 'wonder', MAX_SUGGESTIONS, new Set([wonderwallKey])))
      .toEqual([])
  })

  it('conserve les autres chansons et applique la limite après exclusion', () => {
    expect(searchGuessOptions(oasisCatalog, 'oasis', MAX_SUGGESTIONS, new Set([wonderwallKey]))
      .map(({ id }) => id)).toEqual(['4'])

    const large: GuessOption[] = Array.from({ length: 7 }, (_, index) => ({
      id: String(index),
      title: `Oasis Song ${index}`,
      artist: 'Oasis',
    }))
    const excluded = getCanonicalSongKey({ title: 'Oasis Song 0', artist: 'Oasis' })

    const results = searchGuessOptions(large, 'oasis', MAX_SUGGESTIONS, new Set([excluded]))

    expect(results).toHaveLength(MAX_SUGGESTIONS)
    expect(results.some(({ id }) => id === '0')).toBe(false)
  })
})
