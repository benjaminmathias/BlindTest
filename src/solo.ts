import { fetchTracks, type MusicTheme, type Track } from './api'
import { qs } from './dom'
import {
  formatGuessOption, getAttemptScore, pickUnplayedTrack, MAX_ATTEMPTS,
  type GuessOption, type RoundCount, type RoundDuration, type RoundOutcome,
} from './game'
import { roundRecapMarkup, roundTimelineMarkup, type RoundRecapEntry } from './guess/recap'
import { createGuessRound } from './round/guess'
import { roundStageMarkup } from './round/stage'
import { createRoundTimer, type RoundTimer } from './round/timer'
import { isSameSong } from './song'
import { animateScore, focusScreenHeading, formatRemainingTime, formatScore, setStatusMessage } from './ui'

const MAX_ROUND_SCORE = 1000

export type SoloGameState = {
  tracks: Track[]
  round: number
  roundCount: RoundCount
  roundDuration: RoundDuration
  score: number
  playedTrackIds: Set<string>
  roundHistory: (RoundOutcome | undefined)[]
  roundRecap: (RoundRecapEntry | undefined)[]
  audio: HTMLAudioElement | null
  timer: RoundTimer | null
}

type SoloGameOptions = {
  app: HTMLElement
  getVolume: () => number
  setupVolumeControls: () => void
  renderVolumeControlMarkup: (id: string, compact?: boolean) => string
  revealArtwork: (root: ParentNode, imageUrl: string, alt: string) => void
  renderRoundResult: (
    status: HTMLElement,
    result: 'correct' | 'wrong' | 'timeout' | 'skip',
    title: string,
    artist: string,
    points?: number,
  ) => void
  readHighScore: (roundCount: RoundCount) => number
  saveHighScore: (roundCount: RoundCount, score: number) => boolean
  renderHome: () => void
}

export type SoloGame = {
  start: (theme: MusicTheme, roundCount: RoundCount, duration: RoundDuration) => Promise<void>
  stop: () => void
  setVolume: (volume: number) => void
}

export function createSoloGame(options: SoloGameOptions): SoloGame {
  const state: SoloGameState = {
    tracks: [], round: 0, roundCount: 5, roundDuration: 30, score: 0,
    playedTrackIds: new Set(), roundHistory: [], roundRecap: [], audio: null, timer: null,
  }

  const stop = (): void => {
    state.timer?.stop()
    state.timer = null
    state.audio?.pause()
    if (state.audio) state.audio.currentTime = 0
    state.audio = null
  }

  const showResult = (): void => {
    stop()
    const isNewHighScore = options.saveHighScore(state.roundCount, state.score)
    const highScore = options.readHighScore(state.roundCount)
    options.app.innerHTML = `
      <main class="welcome welcome--result">
        <section class="welcome__content result-shell surface" aria-labelledby="result-title">
          <h1 id="result-title">Partie terminée</h1>
          <div class="result-progress">
            ${roundTimelineMarkup(state.roundCount, state.roundHistory, -1)}
            ${roundRecapMarkup(state.roundRecap, state.roundCount)}
          </div>
          <div class="score-summary">
            <div class="stat"><span class="stat__label">Score</span><span class="stat__value">${formatScore(state.score)} / ${formatScore(state.roundCount * MAX_ROUND_SCORE)}</span></div>
            <div class="stat"><span class="stat__label">Meilleur score · ${state.roundCount} manches</span><span class="stat__value stat__value--score">${formatScore(highScore)}</span></div>
          </div>
          ${isNewHighScore ? '<p class="new-high-score">Nouveau record !</p>' : ''}
          <div class="result-actions">
            <button id="replay-button" class="button-primary" type="button">Rejouer</button>
            <button id="return-home-button" class="button-secondary" type="button">Retour à l'accueil</button>
          </div>
          <p class="status" role="status" aria-live="polite"></p>
        </section>
      </main>`
    focusScreenHeading(options.app)

    qs<HTMLButtonElement>('#return-home-button', options.app)!.addEventListener('click', () => {
      stop()
      options.renderHome()
    })

    const replayButton = qs<HTMLButtonElement>('#replay-button', options.app)!
    replayButton.addEventListener('click', async () => {
      replayButton.disabled = true
      state.round = 1
      state.playedTrackIds.clear()
      state.roundHistory = []
      state.roundRecap = []
      state.score = 0
      try {
        await startRound()
      } catch (error) {
        console.error(error)
        setStatusMessage(qs('.status', options.app), 'Impossible de relancer la partie.', true)
        replayButton.disabled = false
      }
    })
  }

  const startRound = async (): Promise<void> => {
    stop()
    const correctTrack = pickUnplayedTrack(state.tracks, state.playedTrackIds)
    const roundDurationMs = state.roundDuration * 1000
    const audio = new Audio(correctTrack.audioUrl)
    audio.volume = options.getVolume()
    audio.preload = 'auto'
    state.audio = audio

    let audioBlocked = false
    try {
      await audio.play()
    } catch (error) {
      console.error(error)
      audioBlocked = true
    }

    const roundStartedAt = performance.now()
    let hasAnswered = false
    let attemptsUsed = 0
    let lastGuess: GuessOption | null = null

    options.app.innerHTML = `
      <main class="welcome welcome--game">
        <section class="welcome__content game-shell" aria-labelledby="question-title">
          <header class="game-topbar">
            <p class="round-label">Manche ${state.round} / ${state.roundCount}</p>
            <div class="game-topbar__right">
              <p class="round-score">Score <span id="score">${formatScore(state.score)}</span></p>
              <div class="game-volume"><label class="sr-only" for="volume-slider-round">Volume</label>${options.renderVolumeControlMarkup('volume-slider-round', true)}</div>
            </div>
          </header>
          ${roundStageMarkup({
            timerId: 'timer', progressId: 'timer-progress', revealId: 'game-reveal',
            initialTime: formatRemainingTime(roundDurationMs),
          })}
          <p id="game-status" class="status" role="status" aria-live="polite"></p>
          <p id="solo-timer-status" class="sr-only" role="status" aria-live="polite"></p>
          <h1 id="question-title" class="sr-only">Quel est ce titre ?</h1>
          <div data-guess-area></div>
          <button id="solo-play-audio-button" class="button-primary next-button" type="button"${audioBlocked ? '' : ' hidden'}>Lire l'extrait</button>
        </section>
      </main>`
    focusScreenHeading(options.app)

    const status = qs<HTMLParagraphElement>('#game-status', options.app)!
    const revealCard = qs<HTMLParagraphElement>('#game-reveal', options.app)!
    const timerEl = qs<HTMLParagraphElement>('#timer', options.app)!
    const timerStatus = qs<HTMLParagraphElement>('#solo-timer-status', options.app)!
    const progressEl = qs<HTMLDivElement>('#timer-progress', options.app)!
    const scoreDisplay = qs<HTMLSpanElement>('#score', options.app)!
    const playButton = qs<HTMLButtonElement>('#solo-play-audio-button', options.app)!

    options.setupVolumeControls()

    if (audioBlocked) status.textContent = 'Lecture audio bloquée par le navigateur.'
    playButton.addEventListener('click', async () => {
      playButton.disabled = true
      try {
        await audio.play()
        playButton.hidden = true
      } catch (error) {
        console.error(error)
        playButton.disabled = false
        status.textContent = 'Impossible de lire l’extrait audio.'
      }
    })

    const guessRound = createGuessRound({
      container: qs<HTMLElement>('[data-guess-area]', options.app)!,
      catalog: state.tracks,
      canSkip: true,
      onSkip: () => finish(null, 'skip'),
      onGuess: (guess) => {
        lastGuess = guess
        attemptsUsed += 1
        const isCorrect = isSameSong(guess, correctTrack)
        guessRound.recordAttempt(
          attemptsUsed - 1, isCorrect, formatGuessOption(guess), MAX_ATTEMPTS - attemptsUsed,
        )

        if (isCorrect || attemptsUsed === MAX_ATTEMPTS) {
          finish(guess)
          return
        }

        guessRound.area.clearInput()
        guessRound.area.focusInput()
      },
    })
    guessRound.area.focusInput()

    const finish = (selected: GuessOption | null, outcome?: 'timeout' | 'skip'): void => {
      if (hasAnswered) return

      const time = Math.max(0, roundDurationMs - (performance.now() - roundStartedAt))
      const timedOut = time <= 0
      hasAnswered = true
      stop()
      playButton.hidden = true
      playButton.disabled = true
      timerEl.textContent = formatRemainingTime(time)
      progressEl.style.transform = `scaleX(${Math.max(0, Math.min(1, time / roundDurationMs))})`
      timerEl.parentElement?.classList.toggle('is-low', time > 0 && time <= 5000)

      const guessArea = guessRound.area
      guessArea.setDisabled(true)
      guessArea.setSubmitHidden(true)
      guessArea.destroy()
      options.revealArtwork(
        document, correctTrack.imageUrl,
        `Cover de ${correctTrack.title} par ${correctTrack.artist}`,
      )

      const isCorrect = selected ? isSameSong(selected, correctTrack) : false
      const roundOutcome: RoundOutcome =
        timedOut || outcome === 'timeout' ? 'timeout'
          : outcome === 'skip' ? 'skipped'
            : isCorrect ? 'correct' : 'failed'

      state.roundHistory[state.round - 1] = roundOutcome
      state.roundRecap[state.round - 1] = {
        outcome: roundOutcome,
        guess: selected ?? lastGuess,
        attemptsUsed,
        elapsedMs: Math.min(roundDurationMs, Math.max(0, roundDurationMs - time)),
        solution: { title: correctTrack.title, artist: correctTrack.artist },
      }
      status.textContent = ''

      if (roundOutcome === 'correct') {
        const points = getAttemptScore(time, roundDurationMs, MAX_ROUND_SCORE, attemptsUsed)
        const previousScore = state.score
        state.score += points
        animateScore(scoreDisplay, previousScore, state.score)
        options.renderRoundResult(revealCard, 'correct', correctTrack.title, correctTrack.artist, points)
      } else {
        const result = roundOutcome === 'timeout' ? 'timeout' : roundOutcome === 'skipped' ? 'skip' : 'wrong'
        options.renderRoundResult(revealCard, result, correctTrack.title, correctTrack.artist)
      }

      const next = document.createElement('button')
      next.type = 'button'
      next.className = 'button-primary next-button'
      next.textContent = state.round === state.roundCount ? 'Voir le résultat' : 'Manche suivante'
      next.addEventListener('click', async () => {
        next.disabled = true
        if (state.round === state.roundCount) return showResult()
        state.round += 1
        try {
          await startRound()
        } catch (error) {
          console.error(error)
          status.textContent = 'Impossible de lancer la manche suivante.'
          next.disabled = false
        }
      })

      const searchRow = qs('.guess-search', options.app)
      if (searchRow) searchRow.replaceWith(next)
      else status.insertAdjacentElement('afterend', next)
    }

    state.timer = createRoundTimer({
      startAt: roundStartedAt,
      durationMs: roundDurationMs,
      now: () => performance.now(),
      timeEl: timerEl,
      progressEl,
      statusEl: timerStatus,
      onExpire: () => finish(null, 'timeout'),
    })
  }

  return {
    start: async (theme, roundCount, duration) => {
      state.tracks = await fetchTracks(theme)
      state.round = 1
      state.roundCount = roundCount
      state.roundDuration = duration
      state.score = 0
      state.playedTrackIds.clear()
      state.roundHistory = []
      state.roundRecap = []
      await startRound()
    },
    stop,
    setVolume: (volume) => {
      if (state.audio) state.audio.volume = volume
    },
  }
}
