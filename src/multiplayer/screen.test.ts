// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { state } from '../state'
import type { MultiplayerRound, RoomConnection } from './protocol'

class FakeAudio {
  volume = 1
  preload = ''
  currentTime = 0
  readyState = 0
  paused = true
  src: string

  constructor(src: string) {
    this.src = src
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  load(): void {}
  async play(): Promise<void> {
    this.paused = false
  }
  pause(): void {
    this.paused = true
  }
}

const catalog = [
  { id: 'a', title: 'Wonderwall', artist: 'Oasis' },
  { id: 'b', title: 'Champagne Supernova', artist: 'Oasis' },
]

const round: MultiplayerRound = {
  gameId: 'g', roundId: 'r1', round: 1, startAt: Date.now() - 1000, audioUrl: 'audio',
}

type GameScreen = typeof import('./game-screen')
type Session = typeof import('./session')
type ResultScreens = typeof import('./result-screens')

let renderMultiplayerRound: GameScreen['renderMultiplayerRound']
let cleanupMultiplayerRound: Session['cleanupMultiplayerRound']
let handleMultiplayerHostLeft: ResultScreens['handleMultiplayerHostLeft']
let handleGameOver: ResultScreens['handleGameOver']

let sendGuess: ReturnType<typeof vi.fn>
let leave: ReturnType<typeof vi.fn>

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>'
  vi.stubGlobal('Audio', FakeAudio)

  const gameScreen = await import('./game-screen')
  const session = await import('./session')
  const results = await import('./result-screens')
  renderMultiplayerRound = gameScreen.renderMultiplayerRound
  cleanupMultiplayerRound = session.cleanupMultiplayerRound
  handleMultiplayerHostLeft = results.handleMultiplayerHostLeft
  handleGameOver = results.handleGameOver
})

beforeEach(() => {
  document.querySelector('#app')!.innerHTML = ''
  sendGuess = vi.fn().mockResolvedValue(undefined)
  leave = vi.fn().mockResolvedValue(undefined)

  state.multiplayerHostLeft = false
  state.multiplayerGameOver = false
  state.multiplayerIsHost = false
  state.multiplayerPlayerId = 'me'
  state.currentMultiplayerGameId = 'g'
  state.currentGameRoundCount = 5
  state.currentGameRoundDuration = 30
  state.currentMultiplayerRound = null
  state.multiplayerGuessArea = null
  state.multiplayerTimer = null
  state.multiplayerLastOwnGuess = null
  state.multiplayerAttemptResultHandler = null
  state.multiplayerRoundFinished = false
  state.multiplayerPlayerNames = new Map([['me', 'Me'], ['other', 'Other']])
  state.multiplayerScores = new Map()
  state.multiplayerCatalog = catalog
  state.multiplayerOwnRoundHistory = []
  state.multiplayerOwnRoundRecap = []
  state.roomConnection = { sendGuess, leave } as unknown as RoomConnection
})

afterEach(() => {
  cleanupMultiplayerRound()
  state.roomConnection = null
})

function type(value: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('.guess-search__input')!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input
}

function submitGuess(): void {
  document.querySelector<HTMLFormElement>('#multiplayer-guess-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('écran de manche multijoueur', () => {
  it('enregistre la zone de saisie et envoie la réponse choisie', () => {
    renderMultiplayerRound(round)

    expect(document.querySelector('#multiplayer-guess-form')).not.toBeNull()
    // Régression : la zone doit être exposée à l'état pour le nettoyage et le catalogue.
    expect(state.multiplayerGuessArea).not.toBeNull()

    type('wonder')
    document.querySelector<HTMLLIElement>('.guess-suggestion')!.click()
    submitGuess()

    expect(sendGuess).toHaveBeenCalledWith({
      roundId: 'r1', guessId: expect.any(String), answerId: 'a',
    })
    expect(state.multiplayerLastOwnGuess?.id).toBe('a')
  })

  it('applique le résultat de l’hôte aux emplacements d’essai', () => {
    renderMultiplayerRound(round)
    type('wonder')
    document.querySelector<HTMLLIElement>('.guess-suggestion')!.click()
    submitGuess()

    state.multiplayerAttemptResultHandler?.({
      roundId: 'r1', guessId: 'g', playerId: 'me', isCorrect: true,
      attemptsUsed: 1, attemptsRemaining: 4, finished: true, addedScore: 900, totalScore: 900,
    })

    const slot = document.querySelector('.attempt-slot--correct')
    expect(slot).not.toBeNull()
    expect(slot?.textContent).toContain('Wonderwall')
  })

  it('détruit la zone de saisie au nettoyage de la manche', () => {
    renderMultiplayerRound(round)
    const destroy = vi.spyOn(state.multiplayerGuessArea!, 'destroy')

    cleanupMultiplayerRound()

    expect(destroy).toHaveBeenCalled()
    expect(state.multiplayerGuessArea).toBeNull()
    expect(state.multiplayerTimer).toBeNull()
  })

  it('affiche l’écran de fin quand l’hôte quitte', () => {
    renderMultiplayerRound(round)

    handleMultiplayerHostLeft()

    expect(document.querySelector('#host-left-title')).not.toBeNull()
    expect(leave).toHaveBeenCalled()
    expect(state.roomConnection).toBeNull()
  })

  it('affiche le classement final à la fin de la partie', () => {
    handleGameOver({
      gameId: 'g',
      scores: [
        { playerId: 'other', name: 'Other', score: 1200 },
        { playerId: 'me', name: 'Me', score: 800 },
      ],
    })

    const rows = document.querySelectorAll('#multiplayer-final-leaderboard li')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('Other')
    expect(rows[1]?.classList.contains('is-current-player')).toBe(true)
  })
})
