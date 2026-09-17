import { app, qs } from '../dom'
import { formatGuessOption } from '../game'
import { createId } from '../shared/id'
import { state } from '../state'
import { volume } from '../services'
import { createGuessRound } from '../round/guess'
import { roundStageMarkup } from '../round/stage'
import { createRoundTimer } from '../round/timer'
import { focusScreenHeading } from '../ui'
import { renderMultiplayerLeaderboard } from './leaderboard'
import type { AttemptResult, MultiplayerRound } from './protocol'
import {
  checkMultiplayerRoundCompletion,
  cleanupMultiplayerRound,
  leaveMultiplayerRoom,
} from './session'
import { getEstimatedHostNow, maybeResynchronizeMultiplayerClock } from './clock'

export function renderMultiplayerRound(round: MultiplayerRound): void {
  if (
    state.multiplayerHostLeft
    || state.multiplayerGameOver
    || round.gameId !== state.currentMultiplayerGameId
  ) {
    return
  }

  cleanupMultiplayerRound()
  state.currentMultiplayerRound = round
  state.currentRoundReveal = null
  state.ownAnswerResult = null
  state.multiplayerLastRoundId = round.roundId
  state.multiplayerCurrentRoundNumber = round.round
  state.finishedPlayerIds = new Set()
  state.multiplayerAttempts = new Map()
  state.multiplayerTriedAnswerKeys = new Map()
  state.multiplayerRoundFinished = false
  state.multiplayerLastOwnGuess = null
  state.multiplayerLastOwnElapsedMs = 0

  for (const playerId of state.multiplayerPlayerNames.keys()) {
    if (!state.multiplayerScores.has(playerId)) state.multiplayerScores.set(playerId, 0)
  }

  app.innerHTML = `
    <main class="welcome welcome--game">
      <section class="welcome__content game-shell" aria-labelledby="multiplayer-question-title">
        <header class="game-topbar">
          <p class="round-label">Manche ${round.round} / ${state.currentGameRoundCount}</p>
          <div class="game-topbar__right">
            <div class="game-volume">
              <label class="sr-only" for="volume-slider-round">Volume</label>
              ${volume.renderMarkup('volume-slider-round', true)}
            </div>
          </div>
        </header>
        ${roundStageMarkup({
          timerId: 'multiplayer-timer',
          progressId: 'multiplayer-timer-progress',
          revealId: 'multiplayer-reveal',
          initialTime: 'La manche commence...',
          countdown: true,
        })}
        <p id="multiplayer-status" class="status" role="status" aria-live="polite"></p>
        <p id="multiplayer-timer-status" class="sr-only" role="status" aria-live="polite"></p>
        <p id="multiplayer-sync-note" class="status" role="status" aria-live="polite" hidden>Synchronisation…</p>
        <h1 id="multiplayer-question-title" class="sr-only">Quel est ce titre ?</h1>
        <div data-guess-area></div>
        <button id="play-audio-button" class="button-primary next-button" type="button" hidden>Lire l'extrait</button>
        <section class="leaderboard-section" aria-labelledby="leaderboard-title">
          <h2 id="leaderboard-title" class="leaderboard-heading">Classement</h2>
          <ol id="multiplayer-leaderboard" class="leaderboard"></ol>
        </section>
        <button id="leave-multiplayer-round-button" class="button-secondary leave-button" type="button">
          Quitter la partie
        </button>
      </section>
    </main>`
  focusScreenHeading(app)

  const gameStatus = qs<HTMLParagraphElement>('#multiplayer-status')!
  const syncNote = qs<HTMLParagraphElement>('#multiplayer-sync-note')!
  const gameTimer = qs<HTMLParagraphElement>('#multiplayer-timer')!
  const timerStatus = qs<HTMLParagraphElement>('#multiplayer-timer-status')!
  const timerProgress = qs<HTMLDivElement>('#multiplayer-timer-progress')!
  const leaveButton = qs<HTMLButtonElement>('#leave-multiplayer-round-button')!
  const playAudioButton = qs<HTMLButtonElement>('#play-audio-button')!
  let hasFinished = false
  let roundHasStarted = false
  let audioHasStarted = false
  let audioStartAttempted = false
  let waitingForResult = false
  const roundDurationMs = state.currentGameRoundDuration * 1000

  volume.setupControls()

  const isCurrentRound = (): boolean =>
    state.currentMultiplayerRound?.roundId === round.roundId
    && !state.multiplayerRoundFinished
    && !state.multiplayerHostLeft
    && !state.multiplayerGameOver

  renderMultiplayerLeaderboard()

  leaveButton.addEventListener('click', () => {
    leaveButton.disabled = true
    void leaveMultiplayerRoom()
  })

  const finishOwnRound = (message: string): void => {
    hasFinished = true
    guessRound.area.setDisabled(true)
    guessRound.area.setSubmitHidden(true)
    playAudioButton.hidden = true
    gameStatus.textContent = message
  }

  const onAttemptResult = (result: AttemptResult): void => {
    if (result.roundId !== round.roundId || result.playerId !== state.multiplayerPlayerId) return
    waitingForResult = false
    guessRound.recordAttempt(
      result.attemptsUsed - 1,
      result.isCorrect,
      state.multiplayerLastOwnGuess ? formatGuessOption(state.multiplayerLastOwnGuess) : '',
      result.attemptsRemaining,
    )
    guessRound.area.setExcludedKeys(guessRound.triedKeys)

    if (result.finished) {
      state.multiplayerLastOwnElapsedMs = Math.min(
        roundDurationMs,
        Math.max(0, getEstimatedHostNow() - round.startAt),
      )
      finishOwnRound(
        result.isCorrect ? 'Bonne réponse ! Résultat à venir…' : 'Plus aucun essai. Résultat à venir…',
      )
    } else {
      guessRound.area.clearInput()
      guessRound.area.setDisabled(false)
      guessRound.area.focusInput()
    }
  }
  state.multiplayerAttemptResultHandler = onAttemptResult

  const guessRound = createGuessRound({
    container: qs<HTMLElement>('[data-guess-area]')!,
    catalog: state.multiplayerCatalog,
    formId: 'multiplayer-guess-form',
    canSkip: false,
    focusOnError: false,
    duplicateMessage: 'Ce titre a déjà été essayé.',
    emptyMessage: 'Choisis un titre dans les suggestions.',
    canSubmit: () => isCurrentRound() && roundHasStarted && !hasFinished && !waitingForResult,
    onGuess: (guess) => {
      state.multiplayerLastOwnGuess = guess
      waitingForResult = true
      guessRound.area.setDisabled(true)
      gameStatus.textContent = 'Vérification…'
      void state.roomConnection?.sendGuess({
        roundId: round.roundId,
        guessId: createId(),
        answerId: guess.id,
      }).catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('Connexion interrompue.')
      })
    },
  })
  guessRound.area.setDisabled(true)

  const audio = new Audio(round.audioUrl)
  audio.volume = volume.get()
  audio.preload = 'auto'
  let audioReloadCount = 0
  audio.addEventListener('error', () => {
    if (!isCurrentRound() || hasFinished) return

    if (audioReloadCount < 1) {
      audioReloadCount += 1
      window.setTimeout(() => {
        if (isCurrentRound() && audio.readyState < 3) audio.load()
      }, 1000)
      return
    }

    gameStatus.textContent = 'Impossible de charger l’extrait audio.'
    playAudioButton.hidden = false
  })

  try {
    audio.load()
  } catch (error) {
    console.error(error)
    gameStatus.textContent = 'Impossible de charger l’extrait audio.'
    playAudioButton.hidden = false
  }

  state.multiplayerAudio = audio

  const startAudio = async (): Promise<void> => {
    if (!isCurrentRound() || audioHasStarted || audioStartAttempted || !roundHasStarted) return

    const elapsedTime = getEstimatedHostNow() - round.startAt
    if (elapsedTime >= roundDurationMs) return

    if (audio.readyState < 1) {
      audio.addEventListener('loadedmetadata', () => { void startAudio() }, { once: true })
      return
    }

    audioStartAttempted = true

    try {
      audio.currentTime = Math.max(0, elapsedTime / 1000)
    } catch (error) {
      audioStartAttempted = false
      console.error(error)
      gameStatus.textContent = 'Impossible de positionner l’extrait audio.'
      playAudioButton.hidden = false
      return
    }

    try {
      await audio.play()

      if (!isCurrentRound() || getEstimatedHostNow() - round.startAt >= roundDurationMs) {
        audio.pause()
        return
      }

      audioHasStarted = true
      playAudioButton.hidden = true
    } catch (error) {
      audioStartAttempted = false
      console.error(error)
      if (!isCurrentRound()) return
      gameStatus.textContent = 'Lecture audio bloquée par le navigateur.'
      playAudioButton.hidden = false
    }
  }

  playAudioButton.addEventListener('click', () => { void startAudio() })

  state.multiplayerTimer = createRoundTimer({
    startAt: round.startAt,
    durationMs: roundDurationMs,
    now: getEstimatedHostNow,
    timeEl: gameTimer,
    progressEl: timerProgress,
    statusEl: timerStatus,
    onStart: () => {
      if (!isCurrentRound() || roundHasStarted) return
      roundHasStarted = true
      gameTimer.classList.remove('is-countdown')
      guessRound.area.setDisabled(false)
      guessRound.area.focusInput()
      void startAudio()
    },
    onTick: () => {
      if (!isCurrentRound()) return
      syncNote.hidden = state.multiplayerIsHost || state.multiplayerClockSynced
    },
    onExpire: () => {
      if (!isCurrentRound()) return

      if (!hasFinished) {
        state.ownAnswerResult = null
        state.multiplayerLastOwnElapsedMs = roundDurationMs
        finishOwnRound('Temps écoulé. Résultat à venir…')
      }

      if (state.multiplayerIsHost) {
        for (const playerId of state.multiplayerRoundPlayerIds) state.finishedPlayerIds.add(playerId)
        checkMultiplayerRoundCompletion()
      }
    },
  })

  maybeResynchronizeMultiplayerClock(round.round)
}
