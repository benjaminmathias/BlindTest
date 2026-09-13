import { describe, expect, it } from 'vitest'
import {
  canonicalizeSongTitle,
  getCanonicalSongKey,
  getDisplaySongTitle,
  isParasiteVersion,
  isSameSong,
  normalizeComparableText,
} from './song'

const oasis = { title: 'Wonderwall', artist: 'Oasis' }
const wonderwall = (title: string) => ({ title, artist: 'Oasis' })

describe('normalizeComparableText', () => {
  it('ignore casse, accents et espaces superflus', () => {
    expect(normalizeComparableText('  Été   à PARIS ')).toBe('ete a paris')
  })
})

describe('canonicalizeSongTitle', () => {
  it('neutralise les variantes remaster', () => {
    const variants = [
      'Wonderwall',
      'Wonderwall (Remastered)',
      'Wonderwall (Remaster)',
      'Wonderwall (2014 Remaster)',
      'Wonderwall (2014 Remastered)',
      'Wonderwall - Remastered',
      'Wonderwall - 2014 Remaster',
      'Wonderwall [Remastered]',
      'Wonderwall (Remastered 2014)',
    ]

    for (const variant of variants) {
      expect(canonicalizeSongTitle(variant)).toBe('Wonderwall')
    }
  })

  it('gère les crochets avec année et les mots version', () => {
    expect(canonicalizeSongTitle('Where Is My Mind? (2007 Remaster)')).toBe('Where Is My Mind?')
    expect(canonicalizeSongTitle('Running Up That Hill (A Deal With God) [2018 Remaster]'))
      .toBe('Running Up That Hill (A Deal With God)')
    expect(canonicalizeSongTitle('Song (Remastered Version)')).toBe('Song')
  })

  it('conserve les vraies versions alternatives', () => {
    for (const suffix of [
      '(Live)', '(Acoustic)', '(Demo)', '(Remix)', '(Radio Edit)',
      '(Extended Mix)', '(Instrumental)',
    ]) {
      expect(canonicalizeSongTitle(`Wonderwall ${suffix}`)).toBe(`Wonderwall ${suffix}`)
    }
  })

  it('ne touche pas un titre qui est déjà canonique', () => {
    expect(canonicalizeSongTitle('Hallelujah')).toBe('Hallelujah')
    expect(canonicalizeSongTitle('')).toBe('')
  })

  it("retourne le titre d'origine si tout est retiré", () => {
    expect(canonicalizeSongTitle('(Remastered)')).toBe('(Remastered)')
  })

  it('getDisplaySongTitle suit la canonicalisation', () => {
    expect(getDisplaySongTitle('Wonderwall (2014 Remaster)')).toBe('Wonderwall')
    expect(getDisplaySongTitle('Californication (Live)')).toBe('Californication (Live)')
  })
})

describe('getCanonicalSongKey / isSameSong', () => {
  it('produit une clé artiste|titre canonique', () => {
    expect(getCanonicalSongKey(wonderwall('Wonderwall (Remastered)'))).toBe('oasis|wonderwall')
  })

  it('reconnaît la même chanson sous plusieurs éditions', () => {
    expect(isSameSong(wonderwall('Wonderwall (Remastered)'), oasis)).toBe(true)
    expect(isSameSong(wonderwall('Wonderwall - 2014 Remaster'), oasis)).toBe(true)
    expect(isSameSong(wonderwall('Wonderwall [Remastered]'), oasis)).toBe(true)
  })

  it('ignore accents et casse pour artiste et titre', () => {
    expect(isSameSong(
      { title: 'Été', artist: 'Cali' },
      { title: 'ete', artist: 'CALI ' },
    )).toBe(true)
  })

  it('ne fusionne pas les versions alternatives', () => {
    expect(isSameSong(wonderwall('Wonderwall (Live)'), oasis)).toBe(false)
    expect(isSameSong(wonderwall('Wonderwall (Acoustic)'), oasis)).toBe(false)
    expect(isSameSong(wonderwall('Wonderwall (Demo)'), oasis)).toBe(false)
    expect(isSameSong(wonderwall('Wonderwall (Remix)'), oasis)).toBe(false)
    expect(isSameSong(wonderwall('Wonderwall (Radio Edit)'), oasis)).toBe(false)
    expect(isSameSong(wonderwall('Wonderwall (Extended Mix)'), oasis)).toBe(false)
    expect(isSameSong(wonderwall('Wonderwall (Instrumental)'), oasis)).toBe(false)
  })

  it('ne fusionne pas deux artistes différents', () => {
    expect(isSameSong(
      wonderwall('Wonderwall (Remastered)'),
      { title: 'Wonderwall', artist: 'Autre Artiste' },
    )).toBe(false)
  })
})

describe('isParasiteVersion', () => {
  it('détecte les versions parasites entre parenthèses, crochets ou après tiret', () => {
    expect(isParasiteVersion('Wonderwall (Instrumental)')).toBe(true)
    expect(isParasiteVersion('Wonderwall (Karaoke Version)')).toBe(true)
    expect(isParasiteVersion('Wonderwall (Tribute to Oasis)')).toBe(true)
    expect(isParasiteVersion('Wonderwall [Cover]')).toBe(true)
    expect(isParasiteVersion('Wonderwall - Instrumental')).toBe(true)
  })

  it('ne filtre pas les titres légitimes contenant ces mots', () => {
    expect(isParasiteVersion('Tribute')).toBe(false)
    expect(isParasiteVersion('Cover Me')).toBe(false)
    expect(isParasiteVersion('Under Cover of Darkness')).toBe(false)
  })

  it('ne filtre pas les versions Live, Acoustic ou Remix', () => {
    expect(isParasiteVersion('Wonderwall (Live)')).toBe(false)
    expect(isParasiteVersion('Wonderwall (Acoustic)')).toBe(false)
    expect(isParasiteVersion('Wonderwall (Remix)')).toBe(false)
    expect(isParasiteVersion('Wonderwall (Radio Edit)')).toBe(false)
  })
})
