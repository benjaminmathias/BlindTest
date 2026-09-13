import { createClient } from '@supabase/supabase-js'
import type { MusicTheme } from './api'
import type { RoundCount } from './game'

export type HostSettings = {
  musicTheme: MusicTheme
  roundCount: RoundCount
}

export type Player = {
  playerId: string
  name: string
  isHost: boolean
  musicTheme?: MusicTheme
  roundCount?: RoundCount
}

export type MultiplayerAnswer = {
  id: string
  title: string
}

export type MultiplayerRound = {
  gameId: string
  roundId: string
  round: number
  startAt: number
  correctTrackId: string
  audioUrl: string
  title: string
  artist: string
  imageUrl: string
  answers: MultiplayerAnswer[]
}

export type PlayerAnswer = {
  roundId: string
  playerId: string
  answerId: string | null
}

export type AnswerResult = {
  roundId: string
  playerId: string
  answerId: string | null
  isCorrect: boolean
  addedScore: number
  totalScore: number
}

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
}

export type ClockSyncResult = {
  offsetMs: number
  rttMs: number
}

export type RoomConnection = {
  startGame: (gameId: string, settings: HostSettings) => Promise<void>
  updateGameSettings: (settings: HostSettings) => Promise<void>
  sendRound: (round: MultiplayerRound) => Promise<void>
  sendAnswer: (answer: PlayerAnswer) => Promise<void>
  sendAnswerResult: (result: AnswerResult) => Promise<void>
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
  onRoundStart: (round: MultiplayerRound) => void,
  onPlayerAnswer: (answer: PlayerAnswer) => void,
  onAnswerResult: (result: AnswerResult) => void,
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
  let clockPingCounter = 0
  let roomClosed = false
  let currentSettings: HostSettings | undefined = isHost ? settings : undefined

  const sendBroadcast = async (
    event: string,
    payload: object,
    errorMessage: string,
  ): Promise<void> => {
    const status = await channel.send({ type: 'broadcast', event, payload })

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
      .flatMap((presences) =>
        presences.map((presence) => ({
          playerId: presence.playerId,
          name: presence.name,
          isHost: presence.isHost === true,
          musicTheme: presence.musicTheme,
          roundCount: presence.roundCount,
        })),
      )
      .sort((firstPlayer, secondPlayer) => firstPlayer.name.localeCompare(secondPlayer.name))

    onPlayersChange(players)
  }

  channel.on('presence', { event: 'sync' }, updatePlayers)
  channel.on('presence', { event: 'join' }, updatePlayers)
  channel.on('presence', { event: 'leave' }, updatePlayers)
  channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
    onGameStart(payload as GameStart)
  })
  channel.on('broadcast', { event: 'round_start' }, ({ payload }) => {
    onRoundStart(payload as MultiplayerRound)
  })
  channel.on('broadcast', { event: 'player_answer' }, ({ payload }) => {
    onPlayerAnswer(payload as PlayerAnswer)
  })
  channel.on('broadcast', { event: 'answer_result' }, ({ payload }) => {
    onAnswerResult(payload as AnswerResult)
  })
  channel.on('broadcast', { event: 'round_complete' }, ({ payload }) => {
    onRoundComplete(payload as RoundComplete)
  })
  channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
    onGameOver(payload as GameOver)
  })
  channel.on('broadcast', { event: 'clock_ping' }, ({ payload }) => {
    if (!isHost) {
      return
    }

    const ping = payload as ClockPing

    if (!ping?.pingId || !ping.playerId) {
      return
    }

    void sendClockPong(ping).catch((error) => {
      console.error(error)
    })
  })
  channel.on('broadcast', { event: 'clock_pong' }, ({ payload }) => {
    const pong = payload as ClockPong

    if (pong?.playerId !== playerId || !pong.pingId) {
      return
    }

    const pendingPing = pendingClockPings.get(pong.pingId)

    if (!pendingPing) {
      return
    }

    pendingClockPings.delete(pong.pingId)
    window.clearTimeout(pendingPing.timeoutId)
    const receivedAt = Date.now()
    pendingPing.resolve({
      rttMs: receivedAt - pendingPing.startedAt,
      offsetMs: pong.hostNow - ((pendingPing.startedAt + receivedAt) / 2),
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

    const trackingStatus = await channel.track({
      playerId,
      name,
      isHost,
      musicTheme: currentSettings?.musicTheme,
      roundCount: currentSettings?.roundCount,
    })

    if (trackingStatus !== 'ok') {
      throw new Error('Impossible de publier la Presence')
    }

    updatePlayers()
  } catch (error) {
    roomClosed = true
    clearPendingClockPings()
    await supabase.removeChannel(channel)
    throw error
  }

  return {
    startGame: async (gameId, settings) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut commencer la partie')
      }

      currentSettings = settings

      await sendBroadcast(
        'game_start',
        {
          gameId,
          startedBy: playerId,
          musicTheme: settings.musicTheme,
          roundCount: settings.roundCount,
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
        })

        if (trackingStatus !== 'ok') {
          throw new Error('Impossible de publier les réglages de la partie')
        }
      } catch (error) {
        currentSettings = previousSettings
        throw error
      }
    },
    sendRound: async (round) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut envoyer une manche')
      }

      await sendBroadcast('round_start', round, 'Impossible d’envoyer la manche')
    },
    sendAnswer: async (answer) => {
      await sendBroadcast('player_answer', answer, 'Impossible d’envoyer la réponse')
    },
    sendAnswerResult: async (result) => {
      if (!isHost) {
        throw new Error('Seul l’hôte peut envoyer un résultat')
      }

      await sendBroadcast('answer_result', result, 'Impossible d’envoyer le résultat')
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
        await supabase.removeChannel(channel)
      }
    },
  }
}
