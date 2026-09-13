import { describe, expect, it, vi } from 'vitest'
import type { Track } from './api'
import {
  findGuessOption, formatGuessOption, getAnswerTracks, getAttemptScore, getRoundScore,
  shuffleTracks,
} from './game'

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
