/** The export's write path: no key lands outside the output directory. */
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ExportSource } from '../export-lp-assets'
import { destinationFor, main } from '../export-lp-assets'
import { captured, fixtureTrees } from './fixtureTree'

describe('destinationFor', () => {
  const out = resolve('/tmp/export')

  test('places a key under the output directory', () => {
    expect(destinationFor(out, 'chassis/mule.webp')).toBe(join(out, 'chassis/mule.webp'))
  })

  test('refuses a key that climbs out of the output directory (CodeQL #93)', () => {
    expect(() => destinationFor(out, '../../etc/passwd')).toThrow(/escapes/)
    expect(() => destinationFor(out, 'chassis/../../x')).toThrow(/escapes/)
    expect(() => destinationFor(out, '/etc/passwd')).toThrow(/escapes/)
  })
})

describe('main', () => {
  const tree = fixtureTrees('export-lp-assets')
  const enc = (text: string) => new TextEncoder().encode(text)

  /** A fake bucket; `reads` lets a test serve different bytes on the verify pass. */
  function bucket(objects: Record<string, string>, reads: Record<string, string[]> = {}) {
    const served = new Map(Object.entries(reads).map(([k, v]) => [k, [...v]]))
    const asked: Array<{ bucket: string; prefix: string | undefined }> = []
    const connect = (name: string): ExportSource => ({
      list: async (prefix) => {
        asked.push({ bucket: name, prefix })
        return Object.keys(objects).map((key) => ({ key }))
      },
      bytes: async (key) => {
        const next = served.get(key)?.shift()
        const text = next ?? objects[key]
        if (text === undefined) throw new Error('no such key')
        return enc(text)
      },
    })
    return { connect, asked }
  }
  const run = async (argv: string[], connect: (b: string) => ExportSource) => {
    const io = captured()
    const code = await main(argv, { connect, ...io })
    return { code, ...io }
  }

  test('without an output directory prints usage and never connects', async () => {
    const b = bucket({})
    const r = await run(['--bucket', 'x'], b.connect)
    expect(r.code).toBe(1)
    expect(r.err[0]).toContain('usage: op run --env-file=tools/r2.op.env')
    expect(b.asked).toEqual([])
  })

  test('a flag with no value is an error, not an output directory', async () => {
    await expect(main(['out', '--prefix'], { connect: bucket({}).connect })).rejects.toThrow(
      '--prefix requires a value'
    )
  })

  test('refuses an empty listing rather than writing an empty export', async () => {
    const r = await run([tree({}), '--bucket', 'other'], bucket({}).connect)
    expect(r.code).toBe(1)
    expect(r.err).toEqual([
      'error: bucket "other" reported 0 objects — refusing to write an empty export',
    ])
  })

  test('exports, verifies by re-download and writes the manifest', async () => {
    const out = tree({})
    const b = bucket({ 'chassis/mule.webp': 'mule', 'npc/a.webp': 'aa' })
    const r = await run([out, '--prefix', 'chassis/'], b.connect)
    expect(r.code).toBe(0)
    expect(b.asked).toEqual([{ bucket: 'su-lp-assets', prefix: 'chassis/' }])
    expect(readFileSync(join(out, 'chassis/mule.webp'), 'utf8')).toBe('mule')
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
    expect(manifest.bucket).toBe('su-lp-assets')
    expect(manifest.exportedKeys).toBe(2)
    expect(manifest.objects[0]).toEqual({
      key: 'chassis/mule.webp',
      bytes: 4,
      sha256: createHash('sha256').update('mule').digest('hex'),
    })
    expect(r.out[0]).toBe('bucket "su-lp-assets" reports 2 object(s) under "chassis/"')
    expect(r.out.at(-1)).toContain('✓ exported and verified 2 object(s), 6 bytes total')
  })

  test('an object that fails or comes back empty makes the export INCOMPLETE', async () => {
    const out = tree({})
    const r = await run(
      [out],
      bucket({ 'ok.webp': 'ok', 'empty.webp': '', escape: 'x', '../up.webp': 'x' }).connect
    )
    expect(r.code).toBe(1)
    expect(r.err).toContain('  ✗ empty.webp: received 0 bytes')
    expect(r.err).toContain('  ✗ ../up.webp: key escapes the output directory: ../up.webp')
    expect(r.err).toContain('\n✗ 2/4 object(s) failed to export:')
    expect(r.err.at(-1)).toBe('  → the export is INCOMPLETE. Do not treat it as a backup.')
    expect(existsSync(join(out, 'manifest.json'))).toBe(false)
  })

  test('a re-download that differs, or fails, fails the verify pass', async () => {
    const out = tree({})
    const connect = bucket(
      { 'a.webp': 'aaaa', 'b.webp': 'bbbb' },
      // First read exports; the second is the verify pass.
      { 'a.webp': ['aaaa', 'aaa'], 'b.webp': ['bbbb'] }
    ).connect
    const flaky: (name: string) => ExportSource = (name) => {
      const inner = connect(name)
      let bReads = 0
      return {
        list: inner.list,
        bytes: async (key) => {
          if (key === 'b.webp' && bReads++ > 0) throw new Error('reset')
          return inner.bytes(key)
        },
      }
    }
    const r = await run([out], flaky)
    expect(r.code).toBe(1)
    expect(r.err).toEqual([
      '\n✗ 2 object(s) did not match on re-download:',
      '    a.webp',
      '    b.webp (reset)',
    ])
    expect(existsSync(join(out, 'manifest.json'))).toBe(false)
  })
})
