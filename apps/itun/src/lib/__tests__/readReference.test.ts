import { describe, expect, test } from 'bun:test'
import { SchemaNotLoadedError } from 'salvageunion-reference'
import { makeReferenceReader } from '../readReference'

/**
 * The bare `catch {}` this replaced (audit AP-15) treated "the schema is not
 * preloaded" and "the resolver is broken" identically. These pin the split.
 */
function recordingReader() {
  const reports: Array<{ error: unknown; source: string }> = []
  const read = makeReferenceReader((error, { source }) => {
    reports.push({ error, source })
  })
  return { read, reports }
}

describe('readReference', () => {
  test('returns what the read returns', () => {
    const { read, reports } = recordingReader()
    expect(read('src', () => 42, 0)).toBe(42)
    expect(reports).toHaveLength(0)
  })

  test('falls back silently when the schema is not preloaded', () => {
    const { read, reports } = recordingReader()
    const value = read(
      'src',
      () => {
        throw new SchemaNotLoadedError('chassis')
      },
      'fallback'
    )
    expect(value).toBe('fallback')
    expect(reports).toHaveLength(0)
  })

  test('falls back AND reports any other error', () => {
    const { read, reports } = recordingReader()
    const boom = new TypeError('broken resolver')
    const value = read(
      'Roster.mechChassisStats',
      () => {
        throw boom
      },
      null
    )
    expect(value).toBeNull()
    expect(reports).toEqual([{ error: boom, source: 'Roster.mechChassisStats' }])
  })

  test('reports once per source, not once per render', () => {
    const { read, reports } = recordingReader()
    const fail = () => {
      throw new Error('broken')
    }
    read('a', fail, null)
    read('a', fail, null)
    read('b', fail, null)
    expect(reports.map((r) => r.source)).toEqual(['a', 'b'])
  })
})
