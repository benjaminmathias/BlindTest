import { renderArtworkMarkup } from '../shared/artwork'

export type RoundStageOptions = {
  timerId: string
  progressId: string
  revealId: string
  initialTime: string
  countdown?: boolean
}

// Scène commune aux deux modes : couverture mystère, horloge et emplacement du
// résultat (le résultat prend la place de l'horloge, rien ne bouge dessous).
export function roundStageMarkup(options: RoundStageOptions): string {
  return `
    <div class="game-stage">
      ${renderArtworkMarkup()}
      <div class="stage-readout">
        <div class="progress">
          <p id="${options.timerId}" class="progress__time${options.countdown ? ' is-countdown' : ''}" role="timer">${options.initialTime}</p>
          <div class="progress__track" aria-hidden="true"><div id="${options.progressId}" class="progress__bar"></div></div>
        </div>
        <p id="${options.revealId}" class="round-result-slot" role="status" aria-live="polite"></p>
      </div>
    </div>`
}
