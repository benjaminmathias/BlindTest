import { app } from '../dom'
import { formatGuessOption, MAX_ATTEMPTS } from '../game'
import { createGuessArea } from '../guess-ui'
import { volume } from '../services'
import { renderArtworkMarkup } from '../shared/artwork'
import { createId } from '../shared/id'
import { state } from '../state'
import { focusScreenHeading, formatRemainingTime } from '../ui'
import { renderMultiplayerLeaderboard } from './leaderboard'
import type { AttemptResult, MultiplayerRound } from './realtime'
import {
  checkMultiplayerRoundCompletion,
  cleanupMultiplayerRound,
  getEstimatedHostNow,
  leaveMultiplayerRoom,
  maybeResynchronizeMultiplayerClock,
} from './session'

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
  state.multiplayerTriedAnswerIds = new Map()
  state.multiplayerRoundFinished = false
  state.multiplayerLastOwnGuess = null

  for (const playerId of state.multiplayerPlayerNames.keys()) {
    if (!state.multiplayerScores.has(playerId)) {
      state.multiplayerScores.set(playerId, 0)
    }
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
        <div class="game-stage">
          ${renderArtworkMarkup()}
          <div class="stage-readout">
            <div class="progress">
              <p id="multiplayer-timer" class="progress__time is-countdown">La manche commence...</p>
              <div class="progress__track" aria-hidden="true">
                <div id="multiplayer-timer-progress" class="progress__bar"></div>
              </div>
            </div>
            <p id="multiplayer-reveal" class="round-result-slot" role="status" aria-live="polite"></p>
          </div>
        </div>
        <p id="multiplayer-status" class="status" role="status" aria-live="polite"></p>
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
    </main>
  `
  focusScreenHeading(app)

  const gameStatus = document.querySelector<HTMLParagraphElement>('#multiplayer-status')!
  const gameTimer = document.querySelector<HTMLParagraphElement>('#multiplayer-timer')!
  const timerProgress = document.querySelector<HTMLDivElement>('#multiplayer-timer-progress')!
  const roundProgress = gameTimer.parentElement
  const leaveButton = document.querySelector<HTMLButtonElement>('#leave-multiplayer-round-button')!
  const playAudioButton = document.querySelector<HTMLButtonElement>('#play-audio-button')!
  let hasFinished = false
  let roundHasStarted = false
  let audioHasStarted = false
  let audioStartAttempted = false
  let waitingForResult = false
  const triedIds = new Set<string>()
  const roundDurationMs = state.currentGameRoundDuration * 1000

  volume.setupControls()

  const guessArea = createGuessArea(document.querySelector<HTMLElement>('[data-guess-area]')!, {
    catalog: state.multiplayerCatalog,
    maxAttempts: MAX_ATTEMPTS,
    placeholder: 'Rechercher un titre ou un artiste…',
    formId: 'multiplayer-guess-form',
    canSkip: false,
  })
  const form = guessArea.form
  state.multiplayerGuessArea = guessArea
  guessArea.setDisabled(true)
  guessArea.setExcludedIds(triedIds)

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
    guessArea.setDisabled(true)
    guessArea.setSubmitHidden(true)
    gameStatus.textContent = message
  }

  const onAttemptResult = (result: AttemptResult): void => {
    if (result.roundId !== round.roundId || result.playerId !== state.multiplayerPlayerId) return
    waitingForResult = false
    guessArea.slots.setResult(
      result.attemptsUsed - 1,
      result.isCorrect ? 'correct' : 'wrong',
      state.multiplayerLastOwnGuess ? formatGuessOption(state.multiplayerLastOwnGuess) : '',
    )
    guessArea.announceRemaining(result.attemptsRemaining)
    guessArea.setExcludedIds(triedIds)
    if (result.finished) {
      finishOwnRound(result.isCorrect ? 'Bonne réponse ! Résultat à venir…' : 'Plus aucun essai. Résultat à venir…')
    } else {
      guessArea.clearInput()
      guessArea.setDisabled(false)
      guessArea.focusInput()
    }
  }
  state.multiplayerAttemptResultHandler = onAttemptResult

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!isCurrentRound() || !roundHasStarted || hasFinished || waitingForResult) return
    const answer = guessArea.getSelectedOption()
    if (!answer) {
      guessArea.showError('Choisis un titre dans les suggestions.')
      return
    }
    if (triedIds.has(answer.id)) {
      guessArea.showError('Ce titre a déjà été essayé.')
      return
    }

    guessArea.clearError()
    triedIds.add(answer.id)
    guessArea.setExcludedIds(triedIds)
    state.multiplayerLastOwnGuess = answer
    waitingForResult = true
    guessArea.setDisabled(true)
    gameStatus.textContent = 'Vérification…'
    void state.roomConnection?.sendGuess({ roundId: round.roundId, guessId: createId(), answerId: answer.id })
      .catch((error) => {
        console.error(error)
        void leaveMultiplayerRoom('La connexion multijoueur a été interrompue.')
      })
  })

  const audio = new Audio(round.audioUrl)
  audio.volume = volume.get()
  audio.preload = 'auto'
  audio.addEventListener('error', () => {
    if (isCurrentRound() && !hasFinished) {
      gameStatus.textContent = 'Impossible de charger l’extrait audio.'
      playAudioButton.hidden = false
    }
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
    if (!isCurrentRound() || audioHasStarted || audioStartAttempted || !roundHasStarted) {
      return
    }

    const elapsedTime = getEstimatedHostNow() - round.startAt

    if (elapsedTime >= roundDurationMs) return

    if (audio.readyState < 1) {
      audio.addEventListener('loadedmetadata', () => {
        void startAudio()
      }, { once: true })
      return
    }

    audioStartAttempted = true
    const expectedAudioPosition = Math.max(0, elapsedTime / 1000)

    try {
      audio.currentTime = expectedAudioPosition
    } catch (error) {
      audioStartAttempted = false
      console.error(error)
      gameStatus.textContent = 'Impossible de positionner l’extrait audio.'
      playAudioButton.hidden = false
      return
    }

    try {
      await audio.play()

      if (!isCurrentRound()) {
        audio.pause()
        return
      }

      if (getEstimatedHostNow() - round.startAt >= roundDurationMs) {
        audio.pause()
        return
      }

      audioHasStarted = true
      playAudioButton.hidden = true
    } catch (error) {
      audioStartAttempted = false
      console.error(error)

      if (!isCurrentRound()) {
        return
      }

      gameStatus.textContent = 'Lecture audio bloquée par le navigateur.'
      playAudioButton.hidden = false
    }
  }

  playAudioButton.addEventListener('click', () => {
    void startAudio()
  })

  function startRoundAudio(): void {
    if (!isCurrentRound() || roundHasStarted) {
      return
    }

    const elapsedTime = getEstimatedHostNow() - round.startAt

    if (elapsedTime < 0) {
      scheduleRoundStart()
      return
    }

    roundHasStarted = true
    gameTimer.classList.remove('is-countdown')
    guessArea.setDisabled(false)
    guessArea.focusInput()
    void startAudio()
  }

  function scheduleRoundStart(): void {
    if (!isCurrentRound() || roundHasStarted) {
      return
    }

    if (state.multiplayerStartTimeoutId !== null) {
      window.clearTimeout(state.multiplayerStartTimeoutId)
    }

    const delay = Math.max(0, round.startAt - getEstimatedHostNow())
    state.multiplayerStartTimeoutId = window.setTimeout(() => {
      state.multiplayerStartTimeoutId = null
      startRoundAudio()
    }, delay)
  }

  const updateMultiplayerTimer = (): void => {
    if (!isCurrentRound()) {
      return
    }

    const now = getEstimatedHostNow()

    if (!roundHasStarted) {
      const timeUntilStart = round.startAt - now

      if (timeUntilStart > 0) {
        gameTimer.textContent = `${Math.ceil(timeUntilStart / 1000)}…`
        timerProgress.style.transform = 'scaleX(1)'
        roundProgress?.classList.remove('is-low')
        return
      }

      startRoundAudio()
    }

    const remainingTime = Math.max(
      0,
      round.startAt + roundDurationMs - getEstimatedHostNow(),
    )
    gameTimer.textContent = formatRemainingTime(remainingTime)
    timerProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, remainingTime / roundDurationMs))})`
    roundProgress?.classList.toggle('is-low', remainingTime > 0 && remainingTime <= 5000)

    if (remainingTime <= 0) {
      if (!hasFinished) {
        state.ownAnswerResult = null
        finishOwnRound('Temps écoulé. Résultat à venir…')
      }
      if (state.multiplayerIsHost) {
        for (const playerId of state.multiplayerRoundPlayerIds) state.finishedPlayerIds.add(playerId)
        checkMultiplayerRoundCompletion()
      }
    }
  }

  state.multiplayerTimerId = window.setInterval(updateMultiplayerTimer, 100)
  scheduleRoundStart()
  updateMultiplayerTimer()
  maybeResynchronizeMultiplayerClock(round.round)
}
