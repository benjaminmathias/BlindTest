import { state } from '../state'
import type { RoomConnection } from './protocol'

const MULTIPLAYER_CLOCK_RESYNC_ROUND_INTERVAL = 3

export const isActiveConnection = (connection: RoomConnection | null): connection is RoomConnection =>
  connection !== null
  && state.roomConnection === connection
  && !state.multiplayerHostLeft
  && !state.multiplayerGameOver

export const getEstimatedHostNow = (): number => Date.now() + state.multiplayerClockOffsetMs

export function synchronizeMultiplayerClock(connection: RoomConnection, force = false): void {
  if (state.multiplayerIsHost || state.multiplayerHostLeft || state.multiplayerGameOver) {
    state.multiplayerClockOffsetMs = 0
    return
  }

  if (state.multiplayerClockSyncPromise) {
    if (force) {
      void state.multiplayerClockSyncPromise.then(() => {
        if (isActiveConnection(connection)) synchronizeMultiplayerClock(connection)
      })
    }
    return
  }

  const syncPromise = connection.syncClock()
    .then((result) => {
      if (!isActiveConnection(connection)) return
      if (result.rttMs > 0) state.multiplayerClockOffsetMs = result.offsetMs
      // Une synchronisation sans échantillon exploitable retombe sur l'horloge
      // locale : on marque quand même la tentative comme terminée pour ne pas
      // laisser « Synchronisation… » affiché indéfiniment.
      state.multiplayerClockSynced = true
    })
    .catch(console.error)

  state.multiplayerClockSyncPromise = syncPromise
  void syncPromise.finally(() => {
    if (state.multiplayerClockSyncPromise === syncPromise) state.multiplayerClockSyncPromise = null
  })
}

export function maybeResynchronizeMultiplayerClock(currentRound: number): void {
  if (!isActiveConnection(state.roomConnection)) return
  if (currentRound - state.multiplayerLastClockSyncRound < MULTIPLAYER_CLOCK_RESYNC_ROUND_INTERVAL) return

  state.multiplayerLastClockSyncRound = currentRound
  synchronizeMultiplayerClock(state.roomConnection)
}
