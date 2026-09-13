import { describe, expect, it } from 'vitest'
import { scorePlayerGuess } from './game'
import type { MultiplayerRound, PlayerGuess } from './realtime'

const round: MultiplayerRound = {
  gameId: 'g', roundId: 'r2', round: 2, startAt: 1_000, audioUrl: 'audio',
}

const catalog = new Map<string, { title: string; artist: string }>([
  ['correct', { title: 'Wonderwall (Remastered)', artist: 'Oasis' }],
  ['clean', { title: 'Wonderwall', artist: 'Oasis' }],
  ['live', { title: 'Wonderwall (Live)', artist: 'Oasis' }],
  ['other', { title: 'Wonderwall', artist: 'Autre Artiste' }],
  ['a', { title: 'A', artist: 'X' }],
  ['b', { title: 'B', artist: 'X' }],
  ['c', { title: 'C', artist: 'X' }],
  ['d', { title: 'D', artist: 'X' }],
  ['e', { title: 'E', artist: 'X' }],
])

function score(guess: PlayerGuess, overrides: Partial<Parameters<typeof scorePlayerGuess>[0]> = {}) {
  return scorePlayerGuess({
    isHost: true,
    round,
    correctTrack: catalog.get('correct')!,
    catalog,
    activePlayerIds: new Set(['p1']),
    finishedPlayerIds: new Set(),
    attempts: new Map(),
    triedAnswerIds: new Map(),
    scores: new Map(),
    guess,
    now: 5_000,
    roundDurationMs: 10_000,
    maxRoundScore: 1000,
    ...overrides,
  })
}

describe('autorité de manche', () => {
  it('ignore ancienne manche et mauvais roundId', () => {
    expect(score({ roundId: 'r1', guessId: 'g', playerId: 'p1', answerId: 'correct' })).toBeNull()
  })

  it('ignore une double réponse', () => {
    expect(score(
      { roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'correct' },
      { finishedPlayerIds: new Set(['p1']) },
    )).toBeNull()
  })

  it('ignore un joueur ayant quitté la manche et une action guest', () => {
    const guess = { roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'correct' }
    expect(score(guess, { activePlayerIds: new Set() })).toBeNull()
    expect(score(guess, { isHost: false })).toBeNull()
  })

  it('ignore une réponse absente des choix', () => {
    expect(score({ roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'inventée' })).toBeNull()
  })

  it('calcule le score uniquement côté hôte', () => {
    expect(score({ roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'correct' })).toMatchObject({
      isCorrect: true,
      addedScore: 600,
      totalScore: 600,
      attemptsRemaining: 4,
    })
  })

  it('termine après cinq mauvaises tentatives', () => {
    const attempts = new Map<string, number>()
    const triedAnswerIds = new Map<string, Set<string>>()
    const finishedPlayerIds = new Set<string>()
    let result = null
    for (const answerId of ['a', 'b', 'c', 'd', 'e']) {
      result = score(
        { roundId: 'r2', guessId: answerId, playerId: 'p1', answerId },
        { attempts, triedAnswerIds, finishedPlayerIds },
      )
    }
    expect(result).toMatchObject({ attemptsUsed: 5, attemptsRemaining: 0, finished: true })
  })
})

describe('validation canonique côté hôte', () => {
  it('accepte une autre édition de la même chanson', () => {
    expect(score({ roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'clean' }))
      .toMatchObject({ isCorrect: true })
  })

  it('refuse une version live', () => {
    expect(score({ roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'live' }))
      .toMatchObject({ isCorrect: false })
  })

  it('refuse un autre artiste', () => {
    expect(score({ roundId: 'r2', guessId: 'g', playerId: 'p1', answerId: 'other' }))
      .toMatchObject({ isCorrect: false })
  })
})
