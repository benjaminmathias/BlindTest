import { describe, expect, it, vi } from 'vitest'
import type { Track } from './api'
import {
  findGuessOption, formatGuessOption, getAnswerTracks, getAttemptScore, getRoundScore,
  searchGuessOptions, shuffleTracks, type GuessOption,
} from './game'
import { isSameSong } from './song'

const tracks: Track[] = Array.from({ length: 5 }, (_, index) => ({
  id: String(index),
  title: `Titre ${index}`,
  artist: `Artiste ${index}`,
  audioUrl: `audio-${index}`,
  imageUrl: `image-${index}`,
}))

describe('game', () => {
  it('mélange sans muter la liste', () => {
    const input = [...tracks]
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(shuffleTracks(input)).not.toBe(input)
    expect(input).toEqual(tracks)
    vi.restoreAllMocks()
  })

  it('produit quatre réponses uniques contenant la bonne', () => {
    const answers = getAnswerTracks(tracks, tracks[0]!)
    expect(answers).toHaveLength(4)
    expect(answers).toContain(tracks[0])
    expect(new Set(answers.map(({ title }) => title.toLowerCase())).size).toBe(4)
  })

  it('refuse un catalogue sans trois mauvais titres distincts', () => {
    expect(() => getAnswerTracks([
      tracks[0]!,
      { ...tracks[1]!, title: tracks[0]!.title },
      tracks[2]!,
      tracks[3]!,
    ], tracks[0]!)).toThrow('Pas assez de morceaux')
  })

  it('borne et fait décroître le score avec le temps', () => {
    expect(getRoundScore(10_000, 10_000, 1000)).toBe(1000)
    expect(getRoundScore(5_000, 10_000, 1000)).toBe(500)
    expect(getRoundScore(1, 10_000, 1000)).toBe(1)
    expect(getRoundScore(0, 10_000, 1000)).toBe(1)
  })

  it('résout une suggestion en ignorant casse et accents', () => {
    expect(formatGuessOption(tracks[0]!)).toBe('Titre 0 — Artiste 0')
    expect(findGuessOption([{ ...tracks[0]!, title: 'Été' }], ' ete — ARTISTE 0 ')?.id).toBe('0')
    expect(findGuessOption(tracks, 'réponse libre')).toBeNull()
  })

  it('applique la pénalité des cinq essais', () => {
    expect([1, 2, 3, 4, 5].map((attempt) =>
      getAttemptScore(10_000, 10_000, 1000, attempt),
    )).toEqual([1000, 800, 600, 400, 200])
    expect(getAttemptScore(10_000, 10_000, 1000, 6)).toBe(0)
  })
})

describe('searchGuessOptions', () => {
  const catalog: GuessOption[] = [
    { id: '1', title: 'Californication', artist: 'Red Hot Chili Peppers' },
    { id: '2', title: 'Dani California', artist: 'Red Hot Chili Peppers' },
    { id: '3', title: 'Otherside', artist: 'Red Hot Chili Peppers' },
    { id: '4', title: 'Scar Tissue', artist: 'Red Hot Chili Peppers' },
    { id: '5', title: "Can't Stop", artist: 'Red Hot Chili Peppers' },
    { id: '6', title: 'By the Way', artist: 'Red Hot Chili Peppers' },
    { id: '7', title: 'Été', artist: 'Cali' },
    { id: '8', title: 'Some Cali Song', artist: 'Autre' },
  ]

  it("n'affiche rien avant deux caractères", () => {
    expect(searchGuessOptions(catalog, '')).toEqual([])
    expect(searchGuessOptions(catalog, 'c')).toEqual([])
  })

  it('classe le titre en préfixe avant un artiste qui contient', () => {
    const results = searchGuessOptions(catalog, 'cali')
    expect(results[0]?.title).toBe('Californication')
    expect(results.map(({ id }) => id)).toEqual(['1', '7', '2', '8'])
  })

  it('trouve par artiste et limite à cinq résultats', () => {
    const results = searchGuessOptions(catalog, 'red')
    expect(results).toHaveLength(5)
    expect(results.every(({ artist }) => artist === 'Red Hot Chili Peppers')).toBe(true)
    expect(results.map(({ id }) => id)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(searchGuessOptions(catalog, '  CALI  ').map(({ id }) => id)).toEqual(['1', '7', '2', '8'])
    expect(searchGuessOptions(catalog, 'ete').map(({ id }) => id)).toEqual(['7'])
    expect(searchGuessOptions(catalog, 'red   hot').length).toBe(5)
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
})

describe('autocomplete canonique', () => {
  const catalog: GuessOption[] = [
    { id: '1', title: 'Wonderwall', artist: 'Oasis' },
    { id: '2', title: 'Wonderwall (Remastered)', artist: 'Oasis' },
    { id: '3', title: 'Wonderwall (2014 Remaster)', artist: 'Oasis' },
  ]

  it('ne montre qu’une suggestion malgré les éditions', () => {
    const results = searchGuessOptions(catalog, 'wonder')
    expect(results).toHaveLength(1)
    expect(results[0]?.artist).toBe('Oasis')
  })

  it('trouve par le titre canonique même si le titre brut est un remaster', () => {
    const results = searchGuessOptions(
      [{ id: '9', title: 'Wonderwall (2014 Remaster)', artist: 'Oasis' }],
      'wonder',
    )
    expect(results.map(({ id }) => id)).toEqual(['9'])
  })

  it('trouve par artiste', () => {
    expect(searchGuessOptions(catalog, 'oasis')).toHaveLength(1)
  })
})

describe('validation solo canonique', () => {
  const correct: Track = {
    id: '123', title: 'Wonderwall (Remastered)', artist: 'Oasis', audioUrl: '', imageUrl: '',
  }
  const guess: GuessOption = { id: '456', title: 'Wonderwall', artist: 'Oasis' }

  it('accepte une édition canonique équivalente', () => {
    expect(isSameSong(guess, correct)).toBe(true)
  })

  it('conserve le barème des essais', () => {
    expect([1, 2, 3, 4, 5].map((attempt) =>
      getAttemptScore(10_000, 10_000, 1000, attempt),
    )).toEqual([1000, 800, 600, 400, 200])
  })
})
