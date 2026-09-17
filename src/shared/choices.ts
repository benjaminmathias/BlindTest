import { MUSIC_THEMES, MUSIC_THEME_LABELS } from '../api'
import { ROUND_COUNT_OPTIONS, ROUND_DURATION_OPTIONS } from '../game'
import type { SelectOption } from './markup'

export const themeChoices: SelectOption[] = MUSIC_THEMES.map((theme) => ({
  value: theme,
  label: MUSIC_THEME_LABELS[theme],
}))

export const roundCountChoices: SelectOption[] = ROUND_COUNT_OPTIONS.map((count) => ({
  value: count,
  label: String(count),
}))

export const roundDurationChoices: SelectOption[] = ROUND_DURATION_OPTIONS.map((duration) => ({
  value: duration,
  label: `${duration} s`,
}))
