import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { replaceAtomically } from '../generate-route-tree'

/**
 * `tools/check-generated.ts` regenerates the route tree while the pre-push
 * test suite reads every tracked file, so the committed tree must stay
 * readable for the whole run — it used to be renamed aside first, and a
 * concurrent reader failed with ENOENT.
 */
describe('replaceAtomically', () => {
  let dir: string
  let target: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'route-tree-'))
    target = join(dir, 'routeTree.gen.ts')
    writeFileSync(target, 'committed\n')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  test('the committed tree stays readable while the generator runs', async () => {
    const seen: string[] = []
    const outcome = await replaceAtomically(target, async (scratch) => {
      seen.push(readFileSync(target, 'utf8'))
      writeFileSync(scratch, 'regenerated\n')
      seen.push(readFileSync(target, 'utf8'))
    })
    expect(seen).toEqual(['committed\n', 'committed\n'])
    expect(outcome).toBe('replaced')
    expect(readFileSync(target, 'utf8')).toBe('regenerated\n')
    expect(readdirSync(dir)).toEqual(['routeTree.gen.ts'])
  })

  test('identical output leaves the committed file untouched', async () => {
    const before = statSync(target)
    const outcome = await replaceAtomically(target, async (scratch) => {
      writeFileSync(scratch, 'committed\n')
    })
    expect(outcome).toBe('unchanged')
    expect(statSync(target).ino).toBe(before.ino)
    expect(statSync(target).mtimeMs).toBe(before.mtimeMs)
    expect(readdirSync(dir)).toEqual(['routeTree.gen.ts'])
  })

  test('the scratch file sits beside the target, so relative imports match', async () => {
    let scratchPath = ''
    await replaceAtomically(target, async (scratch) => {
      scratchPath = scratch
      writeFileSync(scratch, 'x')
    })
    expect(join(scratchPath, '..')).toBe(dir)
    expect(scratchPath).toEndWith('.ts')
  })

  test('a generator that writes nothing fails and keeps the committed tree', async () => {
    await expect(replaceAtomically(target, async () => {})).rejects.toThrow('did not write')
    expect(readFileSync(target, 'utf8')).toBe('committed\n')
    expect(readdirSync(dir)).toEqual(['routeTree.gen.ts'])
  })

  test('a generator that throws keeps the committed tree and cleans up', async () => {
    await expect(
      replaceAtomically(target, async (scratch) => {
        writeFileSync(scratch, 'partial')
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(readFileSync(target, 'utf8')).toBe('committed\n')
    expect(readdirSync(dir)).toEqual(['routeTree.gen.ts'])
  })

  test('a missing target is created', async () => {
    rmSync(target)
    expect(existsSync(target)).toBe(false)
    const outcome = await replaceAtomically(target, async (scratch) => {
      writeFileSync(scratch, 'fresh\n')
    })
    expect(outcome).toBe('replaced')
    expect(readFileSync(target, 'utf8')).toBe('fresh\n')
  })
})
