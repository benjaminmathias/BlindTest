import { isMusicTheme, type MusicTheme } from '../api'
import {
  isRoundCount,
  isRoundDuration,
  type RoundCount,
  type RoundDuration,
} from '../game'

export const HIGH_SCORE_KEY = 'blindtest-high-score'

const VOLUME_KEY = 'blindtest-volume'
const MUSIC_THEME_KEY = 'blindtest-music-theme'
const ROUND_COUNT_KEY = 'blindtest-round-count'
const ROUND_DURATION_KEY = 'blindtest-round-duration'

export const DEFAULT_VOLUME = 0.5
export const DEFAULT_MUSIC_THEME: MusicTheme = 'all'
export const DEFAULT_ROUND_COUNT: RoundCount = 5
export const DEFAULT_ROUND_DURATION: RoundDuration = 30

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Quota dépassé ou mode privé : la préférence retombe sur sa valeur par défaut.
  }
}

type Preference<T> = {
  read: () => T
  write: (value: T) => void
}

function preference<T>(
  key: string,
  parse: (raw: string | null) => T | null,
  fallback: T,
  serialize: (value: T) => string = String,
): Preference<T> {
  return {
    read: () => parse(readRaw(key)) ?? fallback,
    write: (value) => writeRaw(key, serialize(value)),
  }
}

function numberPreference<T extends number>(
  key: string,
  isValid: (value: number) => value is T,
  fallback: T,
): Preference<T> {
  return preference(
    key,
    (raw) => {
      if (raw === null) return null
      const value = Number(raw)
      return Number.isFinite(value) && isValid(value) ? value : null
    },
    fallback,
  )
}

const volume = preference<number>(
  VOLUME_KEY,
  (raw) => {
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null
  },
  DEFAULT_VOLUME,
)

const musicTheme = preference<MusicTheme>(
  MUSIC_THEME_KEY,
  (raw) => (isMusicTheme(raw) ? raw : null),
  DEFAULT_MUSIC_THEME,
)

const roundCount = numberPreference(ROUND_COUNT_KEY, isRoundCount, DEFAULT_ROUND_COUNT)
const roundDuration = numberPreference(ROUND_DURATION_KEY, isRoundDuration, DEFAULT_ROUND_DURATION)

export const readStoredVolume = (): number => volume.read()
export const storeVolume = (value: number): void => volume.write(value)
export const readStoredMusicTheme = (): MusicTheme => musicTheme.read()
export const storeMusicTheme = (value: MusicTheme): void => musicTheme.write(value)
export const readStoredRoundCount = (): RoundCount => roundCount.read()
export const storeRoundCount = (value: RoundCount): void => roundCount.write(value)
export const readStoredRoundDuration = (): RoundDuration => roundDuration.read()
export const storeRoundDuration = (value: RoundDuration): void => roundDuration.write(value)

function highScoreKey(roundCount: RoundCount): string {
  return `${HIGH_SCORE_KEY}-${roundCount}`
}

export function readHighScore(roundCount: RoundCount): number {
  const storedScore = Number(readRaw(highScoreKey(roundCount)))

  if (Number.isFinite(storedScore) && storedScore > 0) {
    return storedScore
  }

  // Migration de l'ancienne clé unique vers la clé par nombre de manches.
  if (roundCount === 5 && readRaw(highScoreKey(5)) === null) {
    const legacyScore = Number(readRaw(HIGH_SCORE_KEY))

    if (Number.isFinite(legacyScore) && legacyScore > 0) {
      writeRaw(highScoreKey(5), String(legacyScore))
      return legacyScore
    }
  }

  return 0
}

export function saveHighScoreIfNeeded(roundCount: RoundCount, value: number): boolean {
  if (value <= readHighScore(roundCount)) {
    return false
  }

  writeRaw(highScoreKey(roundCount), String(value))
  return true
}
