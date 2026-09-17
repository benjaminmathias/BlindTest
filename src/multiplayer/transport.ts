import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { isRecord, isString } from '../shared/validate'
import {
  getRoomAdmissionError, isAttemptResult, isClockPing, isClockPong, isGameCatalog, isGameOver,
  isGameStart, isMultiplayerRound, isPlayer, isPlayerGuess, isRoundComplete, isRoundReveal,
  isScoreUpdate,
  type ClockPing, type ClockPong, type ClockSyncResult, type GameStart, type HostSettings,
  type Player, type RoomConnection, type RoomHandlers,
} from './protocol'

const CLOCK_SAMPLE_COUNT = 5
const CLOCK_PING_TIMEOUT_MS = 750
const SUBSCRIBE_TIMEOUT_MS = 10_000
const PRESENCE_WAIT_MS = 800

type PendingClockPing = {
  startedAt: number
  timeoutId: number
  resolve: (result: ClockSyncResult) => void
  reject: (error: Error) => void
}

function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) throw new Error('Variables d’environnement Supabase manquantes')
  return createClient(url, publishableKey)
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

function subscribeToChannel(
  channel: RealtimeChannel,
  timeoutMessage: string,
  failureMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(timeoutMessage))
    }, SUBSCRIBE_TIMEOUT_MS)

    channel.subscribe((status, error) => {
      if (settled) return

      if (status === 'SUBSCRIBED') {
        settled = true
        window.clearTimeout(timeoutId)
        resolve()
        return
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        settled = true
        window.clearTimeout(timeoutId)
        reject(error ?? new Error(`${failureMessage} (${status})`))
      }
    })
  })
}

export async function joinRoom(
  roomCode: string,
  playerId: string,
  name: string,
  isHost: boolean,
  settings: HostSettings,
  handlers: RoomHandlers,
): Promise<RoomConnection> {
  const supabase = createSupabaseClient()
  const channel = supabase.channel(`room:${roomCode}`, { config: { broadcast: { self: true } } })
  const pendingClockPings = new Map<string, PendingClockPing>()
  const privateChannels = new Map<string, RealtimeChannel>()
  const privateSubscriptions = new Map<string, Promise<RealtimeChannel>>()
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
    if (status !== 'ok') throw new Error(errorMessage)
  }

  const clearPendingClockPings = (): void => {
    for (const pendingPing of pendingClockPings.values()) {
      window.clearTimeout(pendingPing.timeoutId)
      pendingPing.reject(new Error('Synchronisation de l’horloge interrompue'))
    }
    pendingClockPings.clear()
  }

  const isHostMessage = (payload: unknown): boolean => {
    if (!isRecord(payload) || !isString(payload.senderId)) return false
    return Object.values(channel.presenceState<Player>()).flat()
      .some((presence) =>
        isPlayer(presence) && presence.isHost && presence.playerId === payload.senderId)
  }

  const ensurePrivateChannel = (targetPlayerId: string): Promise<RealtimeChannel> => {
    const existing = privateSubscriptions.get(targetPlayerId)
    if (existing) return existing

    const privateChannel = supabase.channel(`room:${roomCode}:player:${targetPlayerId}`, {
      config: { broadcast: { self: true } },
    })
    privateChannels.set(targetPlayerId, privateChannel)

    privateChannel.on('broadcast', { event: 'player_guess' }, ({ payload }) => {
      if (isHost && isRecord(payload) && isPlayerGuess(payload)
        && payload.playerId === targetPlayerId
        && 'senderId' in payload && payload.senderId === payload.playerId) {
        handlers.onPlayerGuess(payload)
      }
    })
    privateChannel.on('broadcast', { event: 'attempt_result' }, ({ payload }) => {
      if (targetPlayerId === playerId && isHostMessage(payload) && isAttemptResult(payload)
        && payload.playerId === playerId) {
        handlers.onAttemptResult(payload)
      }
    })

    const subscription = subscribeToChannel(
      privateChannel,
      'Délai de connexion au canal privé dépassé',
      'Impossible de rejoindre le canal privé',
    ).then(() => privateChannel)

    privateSubscriptions.set(targetPlayerId, subscription)
    return subscription
  }

  const updatePlayers = (): void => {
    const players = Object.values(channel.presenceState<Player>())
      .flatMap((presences) => presences)
      .filter(isPlayer)
      .map((presence) => ({
        playerId: presence.playerId,
        name: presence.name,
        isHost: presence.isHost,
        musicTheme: presence.musicTheme,
        roundCount: presence.roundCount,
        roundDuration: presence.roundDuration,
        gameStarted: presence.gameStarted === true,
      }))
      .sort((first, second) => first.name.localeCompare(second.name))

    handlers.onPlayers(players)

    if (isHost) {
      for (const player of players) void ensurePrivateChannel(player.playerId).catch(console.error)
    }
  }

  const trackPresence = async (errorMessage: string): Promise<void> => {
    const status = await channel.track({
      playerId, name, isHost,
      musicTheme: currentSettings?.musicTheme,
      roundCount: currentSettings?.roundCount,
      roundDuration: currentSettings?.roundDuration,
      gameStarted,
    })
    if (status !== 'ok') throw new Error(errorMessage)
  }

  const sendClockPong = (ping: ClockPing): Promise<void> =>
    sendBroadcast(
      'clock_pong',
      { pingId: ping.pingId, playerId: ping.playerId, hostNow: Date.now() } satisfies ClockPong,
      'Impossible d’envoyer la synchronisation de l’horloge',
    )

  const pingClock = (): Promise<ClockSyncResult> => {
    const pingId = `${playerId}-${Date.now()}-${clockPingCounter}`
    clockPingCounter += 1

    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const timeoutId = window.setTimeout(() => {
        pendingClockPings.delete(pingId)
        reject(new Error('Délai de synchronisation dépassé'))
      }, CLOCK_PING_TIMEOUT_MS)

      pendingClockPings.set(pingId, { startedAt, timeoutId, resolve, reject })

      void sendBroadcast(
        'clock_ping',
        { pingId, playerId } satisfies ClockPing,
        'Impossible d’envoyer le ping d’horloge',
      ).catch((error: unknown) => {
        const pendingPing = pendingClockPings.get(pingId)
        if (!pendingPing) return
        pendingClockPings.delete(pingId)
        window.clearTimeout(pendingPing.timeoutId)
        pendingPing.reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  const route = <T>(
    event: string,
    accepts: (value: unknown) => value is T,
    handle: (payload: T) => void,
  ): void => {
    channel.on('broadcast', { event }, ({ payload }) => {
      if (isHostMessage(payload) && accepts(payload)) handle(payload)
    })
  }

  channel.on('presence', { event: 'sync' }, updatePlayers)
  channel.on('presence', { event: 'join' }, updatePlayers)
  channel.on('presence', { event: 'leave' }, updatePlayers)

  route('game_start', isGameStart, handlers.onGameStart)
  route('game_catalog', isGameCatalog, handlers.onGameCatalog)
  route('round_start', isMultiplayerRound, handlers.onRoundStart)
  route('score_update', isScoreUpdate, handlers.onScoreUpdate)
  route('round_reveal', isRoundReveal, handlers.onRoundReveal)
  route('round_complete', isRoundComplete, handlers.onRoundComplete)
  route('game_over', isGameOver, handlers.onGameOver)

  channel.on('broadcast', { event: 'clock_ping' }, ({ payload }) => {
    if (!isHost || !isClockPing(payload)) return
    void sendClockPong(payload).catch(console.error)
  })
  channel.on('broadcast', { event: 'clock_pong' }, ({ payload }) => {
    if (!isClockPong(payload) || payload.playerId !== playerId) return

    const pendingPing = pendingClockPings.get(payload.pingId)
    if (!pendingPing) return

    pendingClockPings.delete(payload.pingId)
    window.clearTimeout(pendingPing.timeoutId)
    const receivedAt = Date.now()
    pendingPing.resolve({
      rttMs: receivedAt - pendingPing.startedAt,
      offsetMs: payload.hostNow - (pendingPing.startedAt + receivedAt) / 2,
    })
  })

  const hostSend = async (
    forbiddenMessage: string,
    event: string,
    payload: object,
    errorMessage: string,
  ): Promise<void> => {
    if (!isHost) throw new Error(`Seul l’hôte peut ${forbiddenMessage}`)
    await sendBroadcast(event, payload, errorMessage)
  }

  try {
    await subscribeToChannel(
      channel,
      'Délai de connexion à la room dépassé',
      'Impossible de rejoindre la room',
    )
    await sleep(PRESENCE_WAIT_MS)

    const existingPlayers = Object.values(channel.presenceState<Player>()).flat()
    const admissionError = getRoomAdmissionError(existingPlayers.filter(isPlayer), isHost)
    if (admissionError) throw new Error(admissionError)

    await trackPresence('Impossible de publier la Presence')
    await sleep(250)

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
    await Promise.all(
      [...privateChannels.values()].map((privateChannel) => supabase.removeChannel(privateChannel)),
    )
    await supabase.removeChannel(channel)
    throw error
  }

  return {
    startGame: async (gameId, nextSettings, catalog) => {
      if (!isHost) throw new Error('Seul l’hôte peut commencer la partie')
      currentSettings = nextSettings
      gameStarted = true
      await trackPresence('Impossible de publier le démarrage')
      await sendBroadcast(
        'game_start',
        {
          gameId, startedBy: playerId,
          musicTheme: nextSettings.musicTheme, roundCount: nextSettings.roundCount,
          roundDuration: nextSettings.roundDuration, catalog,
        } satisfies GameStart,
        'Impossible d’envoyer le démarrage de la partie',
      )
    },
    updateGameSettings: async (nextSettings) => {
      if (!isHost) throw new Error('Seul l’hôte peut modifier les réglages')

      const previousSettings = currentSettings
      currentSettings = nextSettings
      try {
        await trackPresence('Impossible de publier les réglages de la partie')
      } catch (error) {
        currentSettings = previousSettings
        throw error
      }
    },
    sendCatalog: (catalog) =>
      hostSend('envoyer le catalogue', 'game_catalog', catalog, 'Impossible d’envoyer le catalogue'),
    sendRound: (round) =>
      hostSend('envoyer une manche', 'round_start', round, 'Impossible d’envoyer la manche'),
    sendGuess: async (guess) => {
      const privateChannel = await ensurePrivateChannel(playerId)
      const status = await privateChannel.send({
        type: 'broadcast', event: 'player_guess',
        payload: { ...guess, playerId, senderId: playerId },
      })
      if (status !== 'ok') throw new Error('Impossible d’envoyer la réponse')
    },
    sendAttemptResult: async (result) => {
      if (!isHost) throw new Error('Seul l’hôte peut envoyer un résultat')

      const privateChannel = await ensurePrivateChannel(result.playerId)
      const status = await privateChannel.send({
        type: 'broadcast', event: 'attempt_result',
        payload: { ...result, senderId: playerId },
      })
      if (status !== 'ok') throw new Error('Impossible d’envoyer le résultat')
    },
    sendScoreUpdate: (update) =>
      hostSend('publier le score', 'score_update', update, 'Impossible de publier le score'),
    sendRoundReveal: (reveal) =>
      hostSend('révéler une manche', 'round_reveal', reveal, 'Impossible de révéler la manche'),
    sendRoundComplete: (result) =>
      hostSend('terminer une manche', 'round_complete', result, 'Impossible de terminer la manche'),
    sendGameOver: (gameOver) =>
      hostSend('terminer la partie', 'game_over', gameOver, 'Impossible de terminer la partie'),
    syncClock: async () => {
      if (isHost || roomClosed) return { offsetMs: 0, rttMs: 0 }

      const samples: ClockSyncResult[] = []
      for (let index = 0; index < CLOCK_SAMPLE_COUNT && !roomClosed; index += 1) {
        try {
          samples.push(await pingClock())
        } catch {
          // Un échantillon perdu ne doit pas empêcher les suivants.
        }
      }

      return samples.reduce(
        (bestSample, sample) => (sample.rttMs < bestSample.rttMs ? sample : bestSample),
        { offsetMs: 0, rttMs: 0 },
      )
    },
    leave: async () => {
      roomClosed = true
      clearPendingClockPings()
      try {
        await channel.untrack()
      } finally {
        await Promise.all(
          [...privateChannels.values()].map((privateChannel) =>
            supabase.removeChannel(privateChannel)),
        )
        await supabase.removeChannel(channel)
      }
    },
  }
}
