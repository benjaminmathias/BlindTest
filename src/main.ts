import './style.css'
import { synchronizeMultiplayerClock } from './multiplayer/session'
import { renderHome, soloGame } from './screens/home'
import { volume } from './services'
import {
  readStoredMusicMarket,
  readStoredMusicTheme,
  readStoredRoundCount,
  readStoredRoundDuration,
} from './shared/storage'
import { state } from './state'

state.selectedTheme = readStoredMusicTheme()
state.selectedMarket = readStoredMusicMarket()
state.selectedRoundCount = readStoredRoundCount()
state.selectedRoundDuration = readStoredRoundDuration()

volume.addListener((value) => {
  soloGame.setVolume(value)

  if (state.multiplayerAudio) {
    state.multiplayerAudio.volume = value
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    return
  }

  if (state.multiplayerIsHost || state.multiplayerHostLeft || state.multiplayerGameOver
    || !state.roomConnection) {
    return
  }

  synchronizeMultiplayerClock(state.roomConnection, true)
})

renderHome()
