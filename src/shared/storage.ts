import {
  DEFAULT_MUSIC_MARKET,
  isMusicMarket,
  isMusicTheme,
  type MusicMarket,
  type MusicTheme,
} from '../api'
import { isRoundCount, isRoundDuration, type RoundCount, type RoundDuration } from '../game'

export const HIGH_SCORE_KEY = 'blindtest-high-score'
export const VOLUME_KEY = 'blindtest-volume'
export const MUSIC_THEME_KEY = 'blindtest-music-theme'
export const MUSIC_MARKET_KEY = 'blindtest-music-market'
export const ROUND_COUNT_KEY = 'blindtest-round-count'
export const ROUND_DURATION_KEY = 'blindtest-round-duration'
export const DEFAULT_VOLUME = 0.5
export const DEFAULT_MUSIC_THEME: MusicTheme = 'all'
export { DEFAULT_MUSIC_MARKET }
export const DEFAULT_ROUND_COUNT: RoundCount = 5
export const DEFAULT_ROUND_DURATION: RoundDuration = 30

export function readStoredVolume(): number {
  const storedValue = localStorage.getItem(VOLUME_KEY)

  if (storedValue === null) {
    return DEFAULT_VOLUME
  }

  const storedVolume = Number(storedValue)

  if (!Number.isFinite(storedVolume)) {
    return DEFAULT_VOLUME
  }

  return Math.min(1, Math.max(0, storedVolume))
}

export function storeVolume(volume: number): void {
  localStorage.setItem(VOLUME_KEY, String(volume))
}

export function readStoredMusicTheme(): MusicTheme {
  const storedTheme = localStorage.getItem(MUSIC_THEME_KEY)

  return isMusicTheme(storedTheme) ? storedTheme : DEFAULT_MUSIC_THEME
}

export function storeMusicTheme(theme: MusicTheme): void {
  localStorage.setItem(MUSIC_THEME_KEY, theme)
}

export function readStoredMusicMarket(): MusicMarket {
  const storedMarket = localStorage.getItem(MUSIC_MARKET_KEY)

  return isMusicMarket(storedMarket) ? storedMarket : DEFAULT_MUSIC_MARKET
}

export function storeMusicMarket(market: MusicMarket): void {
  localStorage.setItem(MUSIC_MARKET_KEY, market)
}

export function readStoredRoundCount(): RoundCount {
  const storedRoundCount = Number(localStorage.getItem(ROUND_COUNT_KEY))

  return isRoundCount(storedRoundCount) ? storedRoundCount : DEFAULT_ROUND_COUNT
}

export function storeRoundCount(roundCount: RoundCount): void {
  localStorage.setItem(ROUND_COUNT_KEY, String(roundCount))
}

export function readStoredRoundDuration(): RoundDuration {
  const storedDuration = Number(localStorage.getItem(ROUND_DURATION_KEY))
  return isRoundDuration(storedDuration) ? storedDuration : DEFAULT_ROUND_DURATION
}

export function storeRoundDuration(duration: RoundDuration): void {
  localStorage.setItem(ROUND_DURATION_KEY, String(duration))
}

function highScoreKey(roundCount: RoundCount): string {
  return `${HIGH_SCORE_KEY}-${roundCount}`
}

export function readHighScore(roundCount: RoundCount): number {
  const storedScore = Number(localStorage.getItem(highScoreKey(roundCount)))

  if (Number.isFinite(storedScore) && storedScore > 0) {
    return storedScore
  }

  if (roundCount === 5 && localStorage.getItem(highScoreKey(5)) === null) {
    const legacyScore = Number(localStorage.getItem(HIGH_SCORE_KEY))

    if (Number.isFinite(legacyScore) && legacyScore > 0) {
      localStorage.setItem(highScoreKey(5), String(legacyScore))
      return legacyScore
    }
  }

  return 0
}

export function saveHighScoreIfNeeded(roundCount: RoundCount, value: number): boolean {
  if (value <= readHighScore(roundCount)) {
    return false
  }

  localStorage.setItem(highScoreKey(roundCount), String(value))
  return true
}
