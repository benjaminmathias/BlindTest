import { createClient } from '@supabase/supabase-js'
import { isMusicTheme, type MusicTheme } from '../api'
import {
  isRoundCount,
  isRoundDuration,
  type GuessOption,
  type RoundCount,
  type RoundDuration,
} from '../game'

export type HostSettings = {
  musicTheme: MusicTheme
  roundCount: RoundCount
  roundDuration: RoundDuration
}

export type Player = {
  playerId: string
  name: string
  isHost: boolean
  musicTheme?: MusicTheme
  roundCount?: RoundCount
  roundDuration?: RoundDuration
  gameStarted?: boolean
}

export type GameCatalog = {
  gameId: string
  options: GuessOption[]
}

export type MultiplayerRound = {
  gameId: string
  roundId: string
  round: number
  startAt: number
  audioUrl: string
}

export type RoundReveal = {
  roundId: string
  correctTrackId: string
  title: string
  artist: string
  imageUrl: string
}

export type PlayerGuess = {
  roundId: string
  guessId: string
  playerId: string
  answerId: string
}

export type AttemptResult = {
  roundId: string
  guessId: string
  playerId: string
  isCorrect: boolean
  attemptsUsed: number
  attemptsRemaining: number
  finished: boolean
  addedScore: number
  totalScore: number
}

export type ScoreUpdate = Pick<AttemptResult, 'roundId' | 'playerId' | 'totalScore'>

export type RoundComplete = {
  roundId: string
  round: number
}

export type FinalScore = {
  playerId: string
  name: string
  score: number
}

export type GameOver = {
  gameId: string
  scores: FinalScore[]
}

export type GameStart = {
  gameId: string
  startedBy: string
  musicTheme: MusicTheme
  roundCount: RoundCount
  roundDuration: RoundDuration
}

export type ClockSyncResult = {
  offsetMs: number
  rttMs: number
}

export type RoomConnection = {
  startGame: (gameId: string, settings: HostSettings) => Promise<void>
  updateGameSettings: (settings: HostSettings) => Promise<void>
  sendCatalog: (catalog: GameCatalog) => Promise<void>
  sendRound: (round: MultiplayerRound) => Promise<void>
  sendGuess: (guess: Omit<PlayerGuess, 'playerId'>) => Promise<void>
  sendAttemptResult: (result: AttemptResult) => Promise<void>
  sendScoreUpdate: (update: ScoreUpdate) => Promise<void>
  sendRoundReveal: (reveal: RoundReveal) => Promise<void>
  sendRoundComplete: (result: RoundComplete) => Promise<void>
  sendGameOver: (gameOver: GameOver) => Promise<void>
  syncClock: () => Promise<ClockSyncResult>
  leave: () => Promise<void>
}

type ClockPing = {
  pingId: string
  playerId: string
}

type ClockPong = ClockPing & {
  hostNow: number
}

type PendingClockPing = {
  startedAt: number
  timeoutId: number
  resolve: (result: ClockSyncResult) => void
  reject: (error: Error) => void
}

const CLOCK_SAMPLE_COUNT = 5
const CLOCK_PING_TIMEOUT_MS = 750
const SUBSCRIBE_TIMEOUT_MS = 10_000
const PRESENCE_WAIT_MS = 800

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function isPlayer(value: unknown): value is Player {
  return isRecord(value) && isString(value.playerId) && isString(value.name)
    && typeof value.isHost === 'boolean'
    && (value.musicTheme === undefined || isMusicTheme(value.musicTheme))
    && (value.roundCount === undefined || isRoundCount(value.roundCount))
    && (value.roundDuration === undefined || isRoundDuration(value.roundDuration))
    && (value.gameStarted === undefined || typeof value.gameStarted === 'boolean')
}

export function getRoomAdmissionError(players: Player[], isHost: boolean): string | null {
  const hosts = players.filter((player) => player.isHost)
  if (isHost && hosts.length > 0) return 'Ce code de partie est déjà utilisé.'
  if (!isHost && hosts.length === 0) return 'Partie introuvable.'
  if (!isHost && hosts.some((host) => host.gameStarted === true)) {
    return 'Cette partie a déjà commencé.'
  }
  return null
}

export function isGameStart(value: unknown): value is GameStart {
  return isRecord(value) && isString(value.gameId) && isString(value.startedBy)
    && isMusicTheme(value.musicTheme)
    && isRoundCount(value.roundCount)
    && isRoundDuration(value.roundDuration)
}

export function isGameCatalog(value: unknown): value is GameCatalog {
  return isRecord(value) && isString(value.gameId) && Array.isArray(value.options)
    && value.options.length > 0
    && value.options.every((option) => isRecord(option) && isString(option.id)
      && isString(option.title) && isString(option.artist))
}

export function isMultiplayerRound(value: unknown): value is MultiplayerRound {
  return isRecord(value) && isString(value.gameId) && isString(value.roundId)
    && !('correctTrackId' in value) && !('title' in value)
    && !('artist' in value) && !('imageUrl' in value)
    && Number.isInteger(value.round) && (value.round as number) > 0
    && isFiniteNumber(value.startAt) && isString(value.audioUrl)
}

export function isPlayerGuess(value: unknown): value is PlayerGuess {
  return isRecord(value) && isString(value.roundId) && isString(value.guessId)
    && isString(value.playerId) && isString(value.answerId)
}

export function isAttemptResult(value: unknown): value is AttemptResult {
  return isRecord(value) && isString(value.roundId) && isString(value.guessId)
    && isString(value.playerId) && typeof value.isCorrect === 'boolean'
    && Number.isInteger(value.attemptsUsed) && (value.attemptsUsed as number) > 0
    && Number.isInteger(value.attemptsRemaining) && (value.attemptsRemaining as number) >= 0
    && typeof value.finished === 'boolean'
    && isFiniteNumber(value.addedScore) && value.addedScore >= 0
    && isFiniteNumber(value.totalScore) && value.totalScore >= 0
}

export function isScoreUpdate(value: unknown): value is ScoreUpdate {
  return isRecord(value) && isString(value.roundId) && isString(value.playerId)
    && isFiniteNumber(value.totalScore) && value.totalScore >= 0
}

export function isRoundComplete(value: unknown): value is RoundComplete {
  return isRecord(value) && isString(value.roundId) && Number.isInteger(value.round)
    && (value.round as number) > 0
}

export function isRoundReveal(value: unknown): value is RoundReveal {
  return isRecord(value) && isString(value.roundId) && isString(value.correctTrackId)
    && isString(value.title) && isString(value.artist) && typeof value.imageUrl === 'string'
}

export function isGameOver(value: unknown): value is GameOver {
  return isRecord(value) && isString(value.gameId) && Array.isArray(value.scores)
    && value.scores.every((score) => isRecord(score) && isString(score.playerId)
      && isString(score.name) && isFiniteNumber(score.score) && score.score >= 0)
}

function isClockPing(value: unknown): value is ClockPing {
  return isRecord(value) && isString(value.pingId) && isString(value.playerId)
}

function isClockPong(value: unknown): value is ClockPong {
  return isClockPing(value) && 'hostNow' in value && isFiniteNumber(value.hostNow)
}

function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('Variables d’environnement Supabase manquantes')
  }

  return createClient(url, publishableKey)
}

export async function joinRoom(
  roomCode: string,
  playerId: string,
  name: string,
  isHost: boolean,
  settings: HostSettings,
  onPlayersChange: (players: Player[]) => void,
  onGameStart: (gameStart: GameStart) => void,
  onGameCatalog: (catalog: GameCatalog) => void,
  onRoundStart: (round: MultiplayerRound) => void,
  onPlayerGuess: (guess: PlayerGuess) => void,
  onAttemptResult: (result: AttemptResult) => void,
  onScoreUpdate: (update: ScoreUpdate) => void,
  onRoundReveal: (reveal: RoundReveal) => void,
  onRoundComplete: (result: RoundComplete) => void,
  onGameOver: (gameOver: GameOver) => void,
): Promise<RoomConnection> {
  const supabase = createSupabaseClient()
  const channel = supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: {
        self: true,
      },
    },
  })
  const pendingClockPings = new Map<string, PendingClockPing>()
  const privateChannels = new Map<string, ReturnType<typeof supabase.channel>>()
  const privateSubscriptions = new Map<string, Promise<ReturnType<typeof supabase.channel>>>()
  let clockPingCounter = 0
  let roomClosed = false
  let currentSettings: HostSettings | undefined = isHost ? settings : undefined
  let gameStarted = false

  const sendBroadcast = async (
    event: string,
    payload: object,
    errorMessage: string,
  ): Promise<void> => {
    const status = await channel.send({
      type: 'broadcast', event, payload: { ...payload, senderId: playerId },
    })

    if (status !== 'ok') {
      throw new Error(errorMessage)
    }
  }

  const clearPendingClockPings = (): void => {
    for (const pendingPing of pendingClockPings.values()) {
      window.clearTimeout(pendingPing.timeoutId)
      pendingPing.reject(new Error('Synchronisation de l’horloge interrompue'))
    }

    pendingClockPings.clear()
  }

  const sendClockPong = async (ping: ClockPing): Promise<void> => {
    await sendBroadcast(
      'clock_pong',
      {
        pingId: ping.pingId,
        playerId: ping.playerId,
        hostNow: Date.now(),
      } satisfies ClockPong,
      'Impossible d’envoyer la synchronisation de l’horloge',
    )
  }

  const updatePlayers = (): void => {
    const players = Object.values(channel.presenceState<Player>())
      .flatMap((presences) => presences)
      .filter(isPlayer)
      .map((presence) => ({
          playerId: presence.playerId,
          name: presence.name,
          isHost: presence.isHost === true,
          musicTheme: presence.musicTheme,
          roundCount: presence.roundCount,
          roundDuration: presence.roundDuration,
          gameStarted: presence.gameStarted === true,
        }))
      .sort((firstPlayer, secondPlayer) => firstPlayer.name.localeCompare(secondPlayer.name))

    onPlayersChange(players)
    if (isHost) {
      for (const player of players) void ensurePrivateChannel(player.playerId).catch(console.error)
    }
  }

  channel.on('presence', { event: 'sync' }, updatePlayers)
  channel.on('presence', { event: 'join' }, updatePlayers)
  channel.on('presence', { event: 'leave' }, updatePlayers)
  // Supabase Broadcast n'authentifie pas cryptographiquement l'émetteur côté client :
  // ce contrôle bloque les usages normaux abusifs, pas un client qui forge directement le protocole.
  const isHostMessage = (payload: unknown): boolean => {
    if (!isRecord(payload) || !isString(payload.senderId)) return false
    return Object.values(channel.presenceState<Player>()).flat().some(
      (presence) => isPlayer(presence) && presence.isHost && presence.playerId === payload.senderId,
    )
  }
  const ensurePrivateChannel = (targetPlayerId: string) => {
    const existing = privateSubscriptions.get(targetPlayerId)
    if (existing) return existing

    const privateChannel = supabase.channel(`room:${roomCode}:player:${targetPlayerId}`, {
      config: { broadcast: { self: true } },
    })
    privateChannels.set(targetPlayerId, privateChannel)
    privateChannel.on('broadcast', { event: 'player_guess' }, ({ payload }) => {
      if (isHost && isPlayerGuess(payload) && payload.playerId === targetPlayerId
        && 'senderId' in payload && payload.senderId === payload.playerId) onPlayerGuess(payload)
    })
    privateChannel.on('broadcast', { event: 'attempt_result' }, ({ payload }) => {
      if (targetPlayerId === playerId && isHostMessage(payload) && isAttemptResult(payload)
        && payload.playerId === playerId) onAttemptResult(payload)
    })

    const subscription = new Promise<typeof privateChannel>((resolve, reject) => {
      let settled = false
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('Délai de connexion au canal privé dépassé'))
        }
      }, SUBSCRIBE_TIMEOUT_MS)
      privateChannel.subscribe((status, error) => {
        if (settled) return
        if (status === 'SUBSCRIBED') {
          settled = true
          window.clearTimeout(timeoutId)
          resolve(privateChannel)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settled = true
          window.clearTimeout(timeoutId)
          reject(error ?? new Error(`Impossible de rejoindre le canal privé (${status})`))
        }
      })
    })
    privateSubscriptions.set(targetPlayerId, subscription)
    return subscription
  }
  channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
    if (isHostMessage(payload) && isGameStart(payload)) onGameStart(payload)
  })
  channel.on('broadcast', { event: 'game_catalog' }, ({ payload }) => {
    if (isHostMessage(payload) && isGameCatalog(payload)) onGameCatalog(payload)
  })
  channel.on('broadcast', { event: 'round_start' }, ({ payload }) => {
    if (isHostMessage(payload) && isMultiplayerRound(payload)) onRoundStart(payload)
  })
  channel.on('broadcast', { event: 'score_update' }, ({ payload }) => {
    if (isHostMessage(payload) && isScoreUpdate(payload)) onScoreUpdate(payload)
  })
  channel.on('broadcast', { event: 'round_reveal' }, ({ payload }) => {
    if (isHostMessage(payload) && isRoundReveal(payload)) onRoundReveal(payload)
  })
  channel.on('broadcast', { event: 'round_complete' }, ({ payload }) => {
    if (isHostMessage(payload) && isRoundComplete(payload)) onRoundComplete(payload)
  })
  channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
    if (isHostMessage(payload) && isGameOver(payload)) onGameOver(payload)
  })
  channel.on('broadcast', { event: 'clock_ping' }, ({ payload }) => {
    if (!isHost) {
      return
    }

    if (!isClockPing(payload)) {
      return
    }
    void sendClockPong(payload).catch((error) => {
      console.error(error)
    })
  })
  channel.on('broadcast', { event: 'clock_pong' }, ({ payload }) => {
    if (!isClockPong(payload) || payload.playerId !== playerId) {
      return
    }
    const pendingPing = pendingClockPings.get(payload.pingId)

    if (!pendingPing) {
      return
    }

    pendingClockPings.delete(payload.pingId)
    window.clearTimeout(pendingPing.timeoutId)
    const receivedAt = Date.now()
    pendingPing.resolve({
      rttMs: receivedAt - pendingPing.startedAt,
      offsetMs: payload.hostNow - ((pendingPing.startedAt + receivedAt) / 2),
    })
  })

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('Délai de connexion à la room dépassé'))
        }
      }, SUBSCRIBE_TIMEOUT_MS)

      channel.subscribe((status, error) => {
        if (settled) {
          return
        }

        if (status === 'SUBSCRIBED') {
          settled = true
          window.clearTimeout(timeoutId)
          resolve()
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settled = true
          window.clearTimeout(timeoutId)
          reject(error ?? new Error(`Impossible de rejoindre la room (${status})`))
        }
      })
    })

    await new Promise((resolve) => window.setTimeout(resolve, PRESENCE_WAIT_MS))
    const existingPlayers = Object.values(channel.presenceState<Player>()).flat()
    const admissionError = getRoomAdmissionError(existingPlayers.filter(isPlayer), isHost)
    if (admissionError) throw new Error(admissionError)

    const trackingStatus = await channel.track({
      playerId,
      name,
      isHost,
      musicTheme: currentSettings?.musicTheme,
      roundCount: currentSettings?.roundCount,
      roundDuration: currentSettings?.roundDuration,
      gameStarted,
    })

    if (trackingStatus !== 'ok') {
      throw new Error('Impossible de publier la Presence')
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250))
    const hosts = Object.values(channel.presenceState<Player>()).flat()
      .filter((presence) => isPlayer(presence) && presence.isHost)
    if (isHost && hosts.length > 1
      && hosts.map(({ playerId: id }) => id).sort()[0] !== playerId) {
      throw new Error('Ce code de partie est déjà utilisé.')
    }
    if (!isHost && hosts.some((host) => host.gameStarted === true)) {
      throw new Error('Cette partie a déjà commencé.')
    }

    await ensurePrivateChannel(playerId)
    updatePlayers()
  } catch (error) {
    roomClosed = true
    clearPendingClockPings()
    await Promise.all([...privateChannels.values()].map((privateChannel) =>
      supabase.removeChannel(privateChannel)))
    await supabase.removeChannel(channel)
    throw error
  }

  return {
    startGame: async (gameId, settings) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut commencer la partie')
      }

      currentSettings = settings
      gameStarted = true

      const trackingStatus = await channel.track({
        playerId, name, isHost, gameStarted,
        musicTheme: settings.musicTheme, roundCount: settings.roundCount,
        roundDuration: settings.roundDuration,
      })
      if (trackingStatus !== 'ok') throw new Error('Impossible de publier le démarrage')

      await sendBroadcast(
        'game_start',
        {
          gameId,
          startedBy: playerId,
          musicTheme: settings.musicTheme,
          roundCount: settings.roundCount,
          roundDuration: settings.roundDuration,
        } satisfies GameStart,
        'Impossible d’envoyer le démarrage de la partie',
      )
    },
    updateGameSettings: async (settings) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut modifier les réglages')
      }

      const previousSettings = currentSettings
      currentSettings = settings

      try {
        const trackingStatus = await channel.track({
          playerId,
          name,
          isHost,
          musicTheme: currentSettings.musicTheme,
          roundCount: currentSettings.roundCount,
          roundDuration: currentSettings.roundDuration,
          gameStarted,
        })

        if (trackingStatus !== 'ok') {
          throw new Error('Impossible de publier les réglages de la partie')
        }
      } catch (error) {
        currentSettings = previousSettings
        throw error
      }
    },
    sendCatalog: async (catalog) => {
      if (!isHost) throw new Error('Seul l’hôte peut envoyer le catalogue')
      await sendBroadcast('game_catalog', catalog, 'Impossible d’envoyer le catalogue')
    },
    sendRound: async (round) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut envoyer une manche')
      }

      await sendBroadcast('round_start', round, 'Impossible d’envoyer la manche')
    },
    sendGuess: async (guess) => {
      const privateChannel = await ensurePrivateChannel(playerId)
      const status = await privateChannel.send({
        type: 'broadcast', event: 'player_guess',
        payload: { ...guess, playerId, senderId: playerId },
      })
      if (status !== 'ok') throw new Error('Impossible d’envoyer la réponse')
    },
    sendAttemptResult: async (result) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut envoyer un résultat')
      }
      const privateChannel = await ensurePrivateChannel(result.playerId)
      const status = await privateChannel.send({
        type: 'broadcast', event: 'attempt_result', payload: { ...result, senderId: playerId },
      })
      if (status !== 'ok') throw new Error('Impossible d’envoyer le résultat')
    },
    sendScoreUpdate: async (update) => {
      if (!isHost) throw new Error('Seul l’hôte peut publier le score')
      await sendBroadcast('score_update', update, 'Impossible de publier le score')
    },
    sendRoundReveal: async (reveal) => {
      if (!isHost) throw new Error('Seul l’hôte peut révéler une manche')
      await sendBroadcast('round_reveal', reveal, 'Impossible de révéler la manche')
    },
    sendRoundComplete: async (result) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut terminer une manche')
      }

      await sendBroadcast('round_complete', result, 'Impossible de terminer la manche')
    },
    sendGameOver: async (gameOver) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut terminer la partie')
      }

      await sendBroadcast('game_over', gameOver, 'Impossible de terminer la partie')
    },
    syncClock: async () => {
      if (isHost || roomClosed) {
        return { offsetMs: 0, rttMs: 0 }
      }

      const samples: ClockSyncResult[] = []

      for (let sampleIndex = 0; sampleIndex < CLOCK_SAMPLE_COUNT; sampleIndex += 1) {
        if (roomClosed) {
          break
        }

        const pingId = `${playerId}-${Date.now()}-${clockPingCounter}`
        clockPingCounter += 1

        try {
          const sample = await new Promise<ClockSyncResult>((resolve, reject) => {
            const startedAt = Date.now()
            const timeoutId = window.setTimeout(() => {
              pendingClockPings.delete(pingId)
              reject(new Error('Délai de synchronisation dépassé'))
            }, CLOCK_PING_TIMEOUT_MS)

            pendingClockPings.set(pingId, {
              startedAt,
              timeoutId,
              resolve,
              reject,
            })

            void sendBroadcast(
              'clock_ping',
              { pingId, playerId } satisfies ClockPing,
              'Impossible d’envoyer le ping d’horloge',
            ).catch((error: unknown) => {
              const pendingPing = pendingClockPings.get(pingId)

              if (pendingPing) {
                pendingClockPings.delete(pingId)
                window.clearTimeout(pendingPing.timeoutId)
                pendingPing.reject(error instanceof Error ? error : new Error(String(error)))
              }
            })
          })

          samples.push(sample)
        } catch {
          // Un échantillon perdu ne doit pas empêcher les suivants.
        }
      }

      if (samples.length === 0) {
        return { offsetMs: 0, rttMs: 0 }
      }

      return samples.reduce((bestSample, sample) =>
        sample.rttMs < bestSample.rttMs ? sample : bestSample,
      )
    },
    leave: async () => {
      roomClosed = true
      clearPendingClockPings()

      try {
        await channel.untrack()
      } finally {
        await Promise.all([...privateChannels.values()].map((privateChannel) =>
          supabase.removeChannel(privateChannel)))
        await supabase.removeChannel(channel)
      }
    },
  }
}
