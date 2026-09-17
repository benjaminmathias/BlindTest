import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Handler = { kind: string; event: string; callback: (message: { payload: unknown }) => void }
type Presence = Record<string, unknown>

const bus = vi.hoisted(() => ({ channels: [] as FakeChannel[] }))

class FakeChannel {
  readonly topic: string

  constructor(topic: string) {
    this.topic = topic
  }
  handlers: Handler[] = []
  presence: Presence | null = null

  on(kind: string, filter: { event: string }, callback: Handler['callback']): this {
    this.handlers.push({ kind, event: filter.event, callback })
    return this
  }

  subscribe(callback: (status: string) => void): void {
    bus.channels.push(this)
    callback('SUBSCRIBED')
  }

  async track(presence: Presence): Promise<'ok'> {
    this.presence = presence
    this.emitPresence()
    return 'ok'
  }

  presenceState<T>(): Record<string, T[]> {
    return Object.fromEntries(bus.channels.flatMap((channel, index) =>
      channel.presence ? [[String(index), [channel.presence as T]]] : [],
    ))
  }

  async send(message: { type: string; event: string; payload: unknown }): Promise<'ok'> {
    for (const channel of bus.channels.filter(({ topic }) => topic === this.topic)) {
      for (const handler of channel.handlers) {
        if (handler.kind === message.type && handler.event === message.event) {
          handler.callback({ payload: message.payload })
        }
      }
    }
    return 'ok'
  }

  async untrack(): Promise<void> {
    this.presence = null
    this.emitPresence()
  }

  private emitPresence(): void {
    for (const channel of bus.channels) {
      channel.handlers
        .filter(({ kind, event }) => kind === 'presence' && event === 'sync')
        .forEach(({ callback }) => callback({ payload: {} }))
    }
  }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: (topic: string) => new FakeChannel(topic) as unknown as RealtimeChannel,
    removeChannel: async (channel: FakeChannel) => {
      bus.channels.splice(bus.channels.indexOf(channel), 1)
    },
  }),
}))

import { joinRoom } from './transport'
import type {
  AttemptResult,
  GameStart,
  MultiplayerRound,
  Player,
  PlayerGuess,
  RoomHandlers,
  RoundReveal,
} from './protocol'

const noop = (): void => undefined

function handlers(overrides: Partial<RoomHandlers> = {}): RoomHandlers {
  return {
    onPlayers: noop,
    onGameStart: noop,
    onGameCatalog: noop,
    onRoundStart: noop,
    onPlayerGuess: noop,
    onAttemptResult: noop,
    onScoreUpdate: noop,
    onRoundReveal: noop,
    onRoundComplete: noop,
    onGameOver: noop,
    ...overrides,
  }
}

beforeAll(() => {
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('crypto', { randomUUID: () => 'id' })
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key')
})

beforeEach(() => {
  bus.channels.length = 0
})

describe('protocole multijoueur intégré', () => {
  it('enchaîne deux clients sans révéler la réponse avant round_reveal', async () => {
    const guestStarts: GameStart[] = []
    const hostAnswers: PlayerGuess[] = []
    const guestResults: AttemptResult[] = []
    const guestReveals: RoundReveal[] = []
    const settings = { musicTheme: 'pop' as const, roundCount: 5 as const, roundDuration: 30 as const }
    const catalog = [
      { id: 'correct', title: 'Titre', artist: 'Artiste' },
      { id: 'other', title: 'Autre', artist: 'Artiste' },
    ]

    const host = await joinRoom('TEST', 'host', 'Host', true, settings, handlers({
      onPlayerGuess: (answer) => hostAnswers.push(answer),
    }))
    const guest = await joinRoom('TEST', 'guest', 'Guest', false, settings, handlers({
      onGameStart: (start) => guestStarts.push(start),
      onAttemptResult: (result) => guestResults.push(result),
      onRoundReveal: (reveal) => guestReveals.push(reveal),
    }))

    await host.startGame('game', settings, catalog)
    const round: MultiplayerRound = {
      gameId: 'game', roundId: 'round', round: 1, startAt: Date.now(), audioUrl: 'audio',
    }
    await host.sendRound(round)
    expect(JSON.stringify(round)).not.toContain('correctTrackId')
    expect(guestStarts).toHaveLength(1)
    expect(guestStarts[0]?.catalog).toEqual(catalog)

    await guest.sendGuess({ roundId: 'round', guessId: 'guess', answerId: 'correct' })
    expect(hostAnswers).toHaveLength(1)
    expect(hostAnswers[0]).toMatchObject({ roundId: 'round', playerId: 'guest', answerId: 'correct' })
    expect(guestReveals).toHaveLength(0)

    await host.sendAttemptResult({
      roundId: 'round', guessId: 'guess', playerId: 'guest', isCorrect: true,
      attemptsUsed: 1, attemptsRemaining: 4, finished: true, addedScore: 900, totalScore: 900,
    })
    await host.sendRoundReveal({
      roundId: 'round', correctTrackId: 'correct', title: 'Titre', artist: 'Artiste', imageUrl: '',
    })
    expect(guestResults[0]?.totalScore).toBe(900)
    expect(guestReveals[0]?.correctTrackId).toBe('correct')

    await guest.leave()
    await host.leave()
  }, 10_000)

  it('propage le départ de l’hôte au client restant', async () => {
    const snapshots: Player[][] = []
    const settings = { musicTheme: 'rock' as const, roundCount: 5 as const, roundDuration: 30 as const }
    const host = await joinRoom('LEFT', 'host', 'Host', true, settings, handlers())
    const guest = await joinRoom('LEFT', 'guest', 'Guest', false, settings, handlers({
      onPlayers: (players) => snapshots.push(players),
    }))

    await host.leave()
    expect(snapshots.at(-1)?.some(({ isHost }) => isHost)).toBe(false)
    await guest.leave()
  }, 10_000)

  it('ne conserve qu’un hôte lors d’une collision simultanée', async () => {
    const settings = { musicTheme: 'all' as const, roundCount: 5 as const, roundDuration: 30 as const }
    const connectHost = (playerId: string) =>
      joinRoom('RACE', playerId, playerId, true, settings, handlers())

    const results = await Promise.allSettled([connectHost('z-host'), connectHost('a-host')])
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
    const winner = results.find((result) => result.status === 'fulfilled')
    if (winner?.status === 'fulfilled') await winner.value.leave()
  }, 10_000)
})
