import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HIGH_SCORE_KEY,
  readHighScore,
  readStoredMusicMarket,
  readStoredMusicTheme,
  readStoredRoundCount,
  readStoredRoundDuration,
  readStoredVolume,
  saveHighScoreIfNeeded,
  storeMusicMarket,
  storeMusicTheme,
  storeRoundCount,
  storeRoundDuration,
  storeVolume,
} from './storage'

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => { store.clear() },
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => { store.delete(key) },
    setItem: (key, value) => { store.set(key, value) },
  }
}

let storage: Storage

afterEach(() => {
  vi.unstubAllGlobals()
})

function withStorage(): Storage {
  storage = createStorage()
  vi.stubGlobal('localStorage', storage)
  return storage
}

describe('préférences persistées', () => {
  it('retombe sur les valeurs par défaut quand rien n’est stocké', () => {
    withStorage()
    expect(readStoredVolume()).toBe(0.5)
    expect(readStoredMusicTheme()).toBe('all')
    expect(readStoredMusicMarket()).toBe('fr')
    expect(readStoredRoundCount()).toBe(5)
    expect(readStoredRoundDuration()).toBe(30)
  })

  it('relit ce qui a été écrit', () => {
    withStorage()
    storeVolume(0.8)
    storeMusicTheme('rock')
    storeMusicMarket('international')
    storeRoundCount(15)
    storeRoundDuration(20)

    expect(readStoredVolume()).toBe(0.8)
    expect(readStoredMusicTheme()).toBe('rock')
    expect(readStoredMusicMarket()).toBe('international')
    expect(readStoredRoundCount()).toBe(15)
    expect(readStoredRoundDuration()).toBe(20)
  })

  it('borne le volume et ignore les valeurs invalides', () => {
    withStorage()
    storeVolume(2)
    expect(readStoredVolume()).toBe(1)

    storage.setItem('blindtest-volume', 'nope')
    expect(readStoredVolume()).toBe(0.5)

    storage.setItem('blindtest-music-theme', 'polka')
    expect(readStoredMusicTheme()).toBe('all')

    storage.setItem('blindtest-music-market', 'be')
    expect(readStoredMusicMarket()).toBe('fr')

    storage.setItem('blindtest-round-count', '7')
    expect(readStoredRoundCount()).toBe(5)
  })
})

describe('meilleur score', () => {
  it('renvoie zéro sans score enregistré', () => {
    withStorage()
    expect(readHighScore(5)).toBe(0)
  })

  it('enregistre un score supérieur et ignore un score inférieur', () => {
    withStorage()
    expect(saveHighScoreIfNeeded(10, 400)).toBe(true)
    expect(readHighScore(10)).toBe(400)
    expect(saveHighScoreIfNeeded(10, 400)).toBe(false)
    expect(saveHighScoreIfNeeded(10, 200)).toBe(false)
    expect(readHighScore(10)).toBe(400)
  })

  it('migre le score historique vers la clé des cinq manches', () => {
    withStorage()
    storage.setItem(HIGH_SCORE_KEY, '1234')

    expect(readHighScore(5)).toBe(1234)
    expect(storage.getItem(`${HIGH_SCORE_KEY}-5`)).toBe('1234')
  })
})
