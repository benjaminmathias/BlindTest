export type RoundMarkName = 'correct' | 'wrong' | 'timeout' | 'skip'

export const ROUND_MARKS = {
  correct:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10.5l3.2 3.2L15 6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  wrong:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.2 6.2l7.6 7.6M13.8 6.2l-7.6 7.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>',
  timeout:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>',
  skip:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 4.7L11.8 10 5 15.3z" fill="currentColor" /><rect x="12.6" y="4.7" width="2.6" height="10.6" rx="1.3" fill="currentColor" /></svg>',
} as const satisfies Record<RoundMarkName, string>
