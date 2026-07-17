import { describe, test, expect } from 'bun:test'
import {
  extractReferenceEntityDetails,
  CALLOUT_META_LABELS,
  CALLOUT_META_LABEL_VALUES,
  getClassTypeLabel,
} from '../referenceEntityDataExtraction'

type ExtractArg = Parameters<typeof extractReferenceEntityDetails>[0]

describe('callout meta de-dup contract', () => {
  // Guards the invariant the entity card relies on: every "meta" label the
  // producer relocates to the header callout must be in CALLOUT_META_LABEL_VALUES,
  // which is the exact set the data-row de-dup filter removes. If these drift, the
  // label would render in BOTH the callout and the data row.

  test('extraction emits "Recommended" and the de-dup set removes it', () => {
    const recommended = {
      id: 'x',
      name: 'Test System',
      source: 'Salvage Union Core Rulebook',
      page: 1,
      recommended: true,
    } as unknown as ExtractArg

    const details = extractReferenceEntityDetails(recommended, 'systems', 'AP')
    const recommendedMeta = details.find(
      (d) => d.type === 'meta' && d.label === CALLOUT_META_LABELS.recommended
    )
    expect(recommendedMeta).toBeDefined()
    expect(CALLOUT_META_LABEL_VALUES).toContain(CALLOUT_META_LABELS.recommended)
  })

  test('getClassTypeLabel only ever returns values in the de-dup set', () => {
    const baseLabel = getClassTypeLabel({} as unknown as ExtractArg)
    const hybridLabel = getClassTypeLabel({ hybrid: true } as unknown as ExtractArg)
    expect(baseLabel).toBe(CALLOUT_META_LABELS.baseClass)
    expect(hybridLabel).toBe(CALLOUT_META_LABELS.hybridClass)
    expect(CALLOUT_META_LABEL_VALUES).toContain(baseLabel)
    expect(CALLOUT_META_LABEL_VALUES).toContain(hybridLabel)
  })
})
