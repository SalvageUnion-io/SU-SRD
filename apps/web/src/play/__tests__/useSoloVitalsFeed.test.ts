import { describe, expect, test } from 'bun:test'
import { lineLabel, soloVitalsStep } from '../useSoloVitalsFeed'

/** The solo Feed's vitals lines (r6 A8): one line per unit for what an act moved. */

describe('soloVitalsStep', () => {
  test('an act that moves two vitals is one line', () => {
    const line = soloVitalsStep(
      'm',
      { currentSP: 9, currentHeat: 0 },
      { currentSP: 7, currentHeat: 2 },
      null,
      1000
    )
    expect(line === null ? null : lineLabel('Scrapper', line)).toBe('Scrapper · SP 9→7 · Heat 0→2')
  })

  test('repeats within the window fold in, keeping where each began; later ones start a new line', () => {
    const first = soloVitalsStep('m', { currentHeat: 0 }, { currentHeat: 1 }, null, 1000)
    const second = soloVitalsStep('m', { currentHeat: 1 }, { currentHeat: 2 }, first, 2000)
    expect(second?.slot).toBe(first?.slot as string)
    expect(second === null ? null : lineLabel('Scrapper', second)).toBe('Scrapper · Heat 0→2')
    const later = soloVitalsStep('m', { currentHeat: 2 }, { currentHeat: 3 }, second, 60_000)
    expect(later?.slot).not.toBe(first?.slot as string)
  })

  test('a vital back where it began says nothing, and a change already said is not said twice', () => {
    const up = soloVitalsStep('m', { currentHeat: 0 }, { currentHeat: 1 }, null, 1000)
    const back = soloVitalsStep('m', { currentHeat: 1 }, { currentHeat: 0 }, up, 1500)
    expect(back === null ? 'x' : lineLabel('Scrapper', back)).toBeNull()
    const open = soloVitalsStep(
      'm',
      { currentHeat: 6 },
      { currentHeat: 0 },
      null,
      1000,
      (t) => t === 'Heat 6→0'
    )
    expect(open).toBeNull()
  })
})
