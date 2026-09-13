import { fetchTracks, type MusicTheme, type Track } from './api'
import {
  findGuessOption, formatGuessOption, getAttemptScore, getRandomTrack, MAX_ATTEMPTS,
  type GuessOption, type RoundCount, type RoundDuration,
} from './game'
import { focusScreenHeading, formatRemainingTime, formatScore, setStatusMessage } from './ui'

const MAX_ROUND_SCORE = 1000

export type SoloGameState = {
  tracks: Track[]
  round: number
  roundCount: RoundCount
  roundDuration: RoundDuration
  score: number
  playedTrackIds: Set<string>
  audio: HTMLAudioElement | null
  timerId: number | null
}

type SoloGameOptions = {
  app: HTMLElement
  getVolume: () => number
  setupVolumeControls: () => void
  renderVolumeControlMarkup: (id: string, compact?: boolean) => string
  renderArtworkMarkup: () => string
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
    playedTrackIds: new Set(), audio: null, timerId: null,
  }

  const stopTimer = (): void => {
    if (state.timerId !== null) window.clearInterval(state.timerId)
    state.timerId = null
  }

  const stopAudio = (): void => {
    state.audio?.pause()
    if (state.audio) state.audio.currentTime = 0
    state.audio = null
  }

  const stop = (): void => {
    stopTimer()
    stopAudio()
  }

  const showResult = (): void => {
    stop()
    const isNewHighScore = options.saveHighScore(state.roundCount, state.score)
    const highScore = options.readHighScore(state.roundCount)
    options.app.innerHTML = `
      <main class="welcome welcome--result">
        <section class="welcome__content result-shell surface" aria-labelledby="result-title">
          <h1 id="result-title">Partie terminée</h1>
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

    const replayButton = options.app.querySelector<HTMLButtonElement>('#replay-button')!
    options.app.querySelector<HTMLButtonElement>('#return-home-button')!.addEventListener('click', () => {
      stop()
      options.renderHome()
    })
    replayButton.addEventListener('click', async () => {
      replayButton.disabled = true
      state.round = 1
      state.playedTrackIds.clear()
      state.score = 0
      try {
        await startRound()
      } catch (error) {
        console.error(error)
        setStatusMessage(options.app.querySelector('.status'), 'Impossible de relancer la partie.', true)
        replayButton.disabled = false
      }
    })
  }

  const startRound = async (): Promise<void> => {
    stop()
    let availableTracks = state.tracks.filter((track) => !state.playedTrackIds.has(track.id))
    if (availableTracks.length === 0) {
      state.playedTrackIds.clear()
      availableTracks = state.tracks
    }

    const correctTrack = getRandomTrack(availableTracks)
    state.playedTrackIds.add(correctTrack.id)
    const roundDurationMs = state.roundDuration * 1000
    const audio = new Audio(correctTrack.audioUrl)
    audio.volume = options.getVolume()
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
          <div class="game-stage">${options.renderArtworkMarkup()}<div class="progress">
            <p id="timer" class="progress__time">${formatRemainingTime(roundDurationMs)}</p>
            <div class="progress__track" aria-hidden="true"><div id="timer-progress" class="progress__bar"></div></div>
          </div></div>
          <h1 id="question-title" class="question-title">Quel est ce titre ?</h1>
          <form id="guess-form" class="guess-form">
            <label for="guess-input">Titre</label>
            <input id="guess-input" type="text" list="guess-options" autocomplete="off" aria-describedby="attempts-left" />
            <datalist id="guess-options"></datalist>
            <button class="button-primary" type="submit">Valider</button>
          </form>
          <p id="attempts-left" class="status">5 essais restants</p>
          <ul id="guess-history" class="guess-history" aria-live="polite"></ul>
          <p id="game-status" class="status" role="status" aria-live="polite">Extrait en cours...</p>
          <button id="solo-play-audio-button" class="button-primary next-button" type="button"${audioBlocked ? '' : ' hidden'}>Lire l'extrait</button>
          <button id="skip-round-button" class="button-secondary next-button" type="button">Passer</button>
        </section>
      </main>`
    focusScreenHeading(options.app)

    const form = options.app.querySelector<HTMLFormElement>('#guess-form')!
    const input = options.app.querySelector<HTMLInputElement>('#guess-input')!
    const datalist = options.app.querySelector<HTMLDataListElement>('#guess-options')!
    const attemptsLabel = options.app.querySelector<HTMLParagraphElement>('#attempts-left')!
    const history = options.app.querySelector<HTMLUListElement>('#guess-history')!
    const status = options.app.querySelector<HTMLParagraphElement>('#game-status')!
    const timer = options.app.querySelector<HTMLParagraphElement>('#timer')!
    const progress = options.app.querySelector<HTMLDivElement>('#timer-progress')!
    const scoreDisplay = options.app.querySelector<HTMLSpanElement>('#score')!
    const playButton = options.app.querySelector<HTMLButtonElement>('#solo-play-audio-button')!
    const skipButton = options.app.querySelector<HTMLButtonElement>('#skip-round-button')!
    const triedIds = new Set<string>()
    let attemptsUsed = 0
    for (const track of state.tracks) {
      const option = document.createElement('option')
      option.value = formatGuessOption(track)
      datalist.append(option)
    }
    options.setupVolumeControls()

    if (audioBlocked) status.textContent = 'Lecture audio bloquée par le navigateur.'
    playButton.addEventListener('click', async () => {
      try {
        await audio.play()
        playButton.hidden = true
        status.textContent = 'Extrait en cours...'
      } catch (error) {
        console.error(error)
        status.textContent = 'Impossible de lire l’extrait audio.'
      }
    })

    input.focus()
    const remaining = (): number => Math.max(0, roundDurationMs - (performance.now() - roundStartedAt))
    const updateTimer = (value: number): void => {
      timer.textContent = formatRemainingTime(value)
      progress.style.transform = `scaleX(${Math.max(0, Math.min(1, value / roundDurationMs))})`
    }
    const finish = (selected: GuessOption | null, outcome?: 'timeout' | 'skip'): void => {
      if (hasAnswered) return
      const time = remaining()
      const timedOut = time <= 0
      hasAnswered = true
      stop()
      updateTimer(time)
      input.disabled = true
      form.querySelector<HTMLButtonElement>('button')!.disabled = true
      skipButton.disabled = true
      options.revealArtwork(document, correctTrack.imageUrl, `Cover de ${correctTrack.title} par ${correctTrack.artist}`)
      const isCorrect = selected?.id === correctTrack.id
      if (timedOut || outcome === 'timeout') {
        options.renderRoundResult(status, 'timeout', correctTrack.title, correctTrack.artist)
      } else if (outcome === 'skip') {
        options.renderRoundResult(status, 'skip', correctTrack.title, correctTrack.artist)
      } else if (isCorrect) {
        const points = getAttemptScore(time, roundDurationMs, MAX_ROUND_SCORE, attemptsUsed)
        state.score += points
        scoreDisplay.textContent = formatScore(state.score)
        options.renderRoundResult(status, 'correct', correctTrack.title, correctTrack.artist, points)
      } else {
        options.renderRoundResult(status, 'wrong', correctTrack.title, correctTrack.artist)
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
      status.insertAdjacentElement('afterend', next)
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const guess = findGuessOption(state.tracks, input.value)
      if (!guess) {
        input.setAttribute('aria-invalid', 'true')
        status.textContent = 'Choisis une suggestion dans la liste.'
        input.focus()
        return
      }
      if (triedIds.has(guess.id)) {
        input.setAttribute('aria-invalid', 'true')
        status.textContent = 'Cette réponse a déjà été essayée.'
        input.focus()
        return
      }
      input.removeAttribute('aria-invalid')
      triedIds.add(guess.id)
      attemptsUsed += 1
      const attemptsLeft = MAX_ATTEMPTS - attemptsUsed
      attemptsLabel.textContent = `${attemptsLeft} essai${attemptsLeft === 1 ? '' : 's'} restant${attemptsLeft === 1 ? '' : 's'}`
      const item = document.createElement('li')
      item.textContent = formatGuessOption(guess)
      item.className = guess.id === correctTrack.id ? 'is-correct' : 'is-wrong'
      history.append(item)
      if (guess.id === correctTrack.id || attemptsUsed === MAX_ATTEMPTS) {
        finish(guess)
        return
      }
      status.textContent = 'Mauvaise réponse.'
      input.value = ''
      input.focus()
    })
    skipButton.addEventListener('click', () => finish(null, 'skip'))
    state.timerId = window.setInterval(() => {
      const time = remaining()
      updateTimer(time)
      if (time <= 0) finish(null, 'timeout')
    }, 100)
    updateTimer(remaining())
  }

  return {
    start: async (theme, roundCount, duration) => {
      state.tracks = await fetchTracks(theme)
      state.round = 1
      state.roundCount = roundCount
      state.roundDuration = duration
      state.score = 0
      state.playedTrackIds.clear()
      await startRound()
    },
    stop,
    setVolume: (volume) => {
      if (state.audio) state.audio.volume = volume
    },
  }
}
