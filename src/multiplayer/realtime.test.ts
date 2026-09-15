import { describe, expect, it } from 'vitest'
import {
  isAttemptResult,
  isGameCatalog,
  getRoomAdmissionError,
  isGameOver,
  isGameStart,
  isMultiplayerRound,
  isPlayerGuess,
  isRoundComplete,
  isRoundReveal,
} from './realtime'

describe('validateurs Realtime', () => {
  it('accepte les payloads attendus', () => {
    expect(isGameStart({ gameId: 'g', startedBy: 'h', musicTheme: 'pop', roundCount: 5, roundDuration: 30, catalog: [{ id: '1', title: 'T', artist: 'A' }] })).toBe(true)
    expect(isGameCatalog({ gameId: 'g', options: [{ id: '1', title: 'T', artist: 'A' }] })).toBe(true)
    expect(isMultiplayerRound({
      gameId: 'g', roundId: 'r', round: 1, startAt: 1, audioUrl: 'https://audio',
    })).toBe(true)
    expect(isPlayerGuess({ roundId: 'r', guessId: 'g', playerId: 'p', answerId: '1' })).toBe(true)
    expect(isAttemptResult({ roundId: 'r', guessId: 'g', playerId: 'p', isCorrect: false, attemptsUsed: 1, attemptsRemaining: 4, finished: false, addedScore: 0, totalScore: 0 })).toBe(true)
    expect(isRoundReveal({ roundId: 'r', correctTrackId: '1', title: 'T', artist: 'A', imageUrl: '' })).toBe(true)
    expect(isRoundComplete({ roundId: 'r', round: 1 })).toBe(true)
    expect(isGameOver({ gameId: 'g', scores: [{ playerId: 'p', name: 'P', score: 0 }] })).toBe(true)
  })

  it('rejette les payloads invalides et les secrets dans round_start', () => {
    expect(isGameStart(null)).toBe(false)
    expect(isGameStart({ gameId: 'g', startedBy: 'h', musicTheme: 'polka', roundCount: 5, roundDuration: 30 })).toBe(false)
    expect(isGameStart({ gameId: 'g', startedBy: 'h', musicTheme: 'pop', roundCount: 5, roundDuration: 30 })).toBe(false)
    expect(isGameStart({ gameId: 'g', startedBy: 'h', musicTheme: 'pop', roundCount: 5, roundDuration: 30, catalog: [] })).toBe(false)
    expect(isPlayerGuess({ roundId: 'r', guessId: 'g', playerId: '', answerId: '1' })).toBe(false)
    expect(isMultiplayerRound({
      gameId: 'g', roundId: 'r', round: 1, startAt: 1, audioUrl: 'audio',
      correctTrackId: 'secret',
    })).toBe(false)
    expect(isGameOver({ gameId: 'g', scores: [{ score: -1 }] })).toBe(false)
  })
})

describe('admission dans une room', () => {
  const host = { playerId: 'h', name: 'Host', isHost: true }

  it('refuse une room sans hôte', () => {
    expect(getRoomAdmissionError([], false)).toBe('Partie introuvable.')
  })

  it('refuse un second hôte', () => {
    expect(getRoomAdmissionError([host], true)).toBe('Ce code de partie est déjà utilisé.')
  })

  it('refuse un late join', () => {
    expect(getRoomAdmissionError([{ ...host, gameStarted: true }], false))
      .toBe('Cette partie a déjà commencé.')
  })
})
