import { describe, expect, it } from 'vitest'
import { scorePlayerGuess } from './game'
import type { MultiplayerRound, PlayerGuess } from './protocol'

const round: MultiplayerRound = {
  gameId: 'g', roundId: 'r2', round: 2, startAt: 1_000, audioUrl: 'audio',
}

const roundEndsAt = round.startAt + 10_000

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

const guess = (answerId: string): PlayerGuess =>
  ({ roundId: 'r2', guessId: 'g', playerId: 'p1', answerId })

type ScoreState = Pick<
  Parameters<typeof scorePlayerGuess>[0],
  'attempts' | 'triedAnswerKeys' | 'finishedPlayerIds' | 'scores'
>

function scoringState(): ScoreState {
  return {
    attempts: new Map(),
    triedAnswerKeys: new Map(),
    finishedPlayerIds: new Set(),
    scores: new Map(),
  }
}

function score(
  playerGuess: PlayerGuess,
  overrides: Partial<Parameters<typeof scorePlayerGuess>[0]> = {},
) {
  return scorePlayerGuess({
    isHost: true,
    round,
    correctTrack: catalog.get('correct')!,
    catalog,
    activePlayerIds: new Set(['p1']),
    finishedPlayerIds: new Set(),
    attempts: new Map(),
    triedAnswerKeys: new Map(),
    scores: new Map(),
    guess: playerGuess,
    now: 5_000,
    roundDurationMs: 10_000,
    maxRoundScore: 1000,
    ...overrides,
  })
}

describe('autorité côté hôte', () => {
  it('ignore une ancienne manche', () => {
    expect(score({ ...guess('correct'), roundId: 'r1' })).toBeNull()
  })

  it('ignore une double réponse et une réponse absente des choix', () => {
    expect(score(guess('correct'), { finishedPlayerIds: new Set(['p1']) })).toBeNull()
    expect(score(guess('inventée'))).toBeNull()
  })

  it('ignore un joueur inactif et une action guest', () => {
    expect(score(guess('correct'), { activePlayerIds: new Set() })).toBeNull()
    expect(score(guess('correct'), { isHost: false })).toBeNull()
  })

  it('calcule le score uniquement côté hôte', () => {
    expect(score(guess('correct'))).toMatchObject({
      isCorrect: true,
      addedScore: 600,
      totalScore: 600,
      attemptsRemaining: 4,
    })
  })

  it('termine après cinq mauvaises tentatives', () => {
    const state = scoringState()
    let result = null
    for (const answerId of ['a', 'b', 'c', 'd', 'e']) {
      result = score(guess(answerId), state)
    }
    expect(result).toMatchObject({ attemptsUsed: 5, attemptsRemaining: 0, finished: true })
  })
})

describe('bornes de la manche', () => {
  it('rejette une réponse avant le début sans rien muter, puis évalue les bornes', () => {
    const early = scoringState()
    expect(score(guess('correct'), { ...early, now: round.startAt - 1 })).toBeNull()
    expect(early.attempts.size).toBe(0)
    expect(early.triedAnswerKeys.size).toBe(0)
    expect(early.finishedPlayerIds.size).toBe(0)
    expect(early.scores.size).toBe(0)

    const cases: [number, boolean][] = [
      [round.startAt, true],
      [round.startAt + 5_000, true],
      [roundEndsAt, false],
      [roundEndsAt + 5_000, false],
    ]

    for (const [now, isCorrect] of cases) {
      const result = score(guess('correct'), { ...scoringState(), now })
      expect(result).toMatchObject({ isCorrect, attemptsUsed: 1 })
      if (!isCorrect) expect(result?.finished).toBe(true)
    }
  })
})

describe('validation canonique côté hôte', () => {
  it('accepte une autre édition et refuse live ou autre artiste', () => {
    expect(score(guess('clean'))).toMatchObject({ isCorrect: true })
    expect(score(guess('live'))).toMatchObject({ isCorrect: false })
    expect(score(guess('other'))).toMatchObject({ isCorrect: false })
  })

  it('ne consomme qu’un essai pour une édition équivalente du même morceau', () => {
    const state = scoringState()
    expect(score(guess('correct'), state)).not.toBeNull()
    expect(score(guess('clean'), state)).toBeNull()
    expect(state.attempts.get('p1')).toBe(1)
  })
})
