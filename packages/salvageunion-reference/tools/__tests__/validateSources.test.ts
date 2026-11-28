import { describe, expect, it } from 'bun:test'
import { SourceSchema } from '../../lib/schemas/enums'
import { loadAllDataFiles } from '../loadData'
import { findSourceIssues } from '../validateSourcesLogic'

const book = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  source: name,
  purchaseLink: 'https://example.test/book',
  ...extra,
})

describe('findSourceIssues', () => {
  it('passes one record per cited source, each its own source with a store link', () => {
    expect(findSourceIssues(['A', 'B'], [book('A'), book('B')])).toEqual([])
  })

  it('fails a cited source with no record, or two', () => {
    expect(findSourceIssues(['A', 'B'], [book('A')])).toHaveLength(1)
    expect(findSourceIssues(['A'], [book('A'), book('A')])).toHaveLength(1)
  })

  it('fails a record no source names, one citing another book, and one with no store link', () => {
    expect(findSourceIssues([], [book('A')])).toHaveLength(1)
    expect(findSourceIssues(['A'], [book('A', { source: 'B' })])).toHaveLength(1)
    expect(findSourceIssues(['A'], [book('A', { purchaseLink: undefined })])).toHaveLength(1)
  })
})

describe('the data', () => {
  it('every source is one book record, and every book a source', () => {
    expect(
      findSourceIssues(SourceSchema.options, loadAllDataFiles()['sources.json'] ?? [])
    ).toEqual([])
  })
})
