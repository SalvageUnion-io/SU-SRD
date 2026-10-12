import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BASE_PORTS, CHECKOUT_ROOT, isPrimaryCheckout, portFor, portOffset } from '../lib/ports'

/**
 * `packages/gates/lib/ports.ts` — the per-checkout dev-server ports that keep
 * parallel worktrees off each other's servers.
 */

describe('portOffset', () => {
  test('the primary checkout keeps the base ports', () => {
    expect(portOffset('/any/path', true)).toBe(0)
  })

  test('a worktree gets a stable offset of 1..99 from its path', () => {
    const offset = portOffset('/repo/.claude/worktrees/a', false)
    expect(offset).toBe(portOffset('/repo/.claude/worktrees/a', false))
    expect(offset).toBeGreaterThanOrEqual(1)
    expect(offset).toBeLessThanOrEqual(99)
  })

  test('different worktrees mostly get different offsets', () => {
    const offsets = new Set(
      Array.from({ length: 20 }, (_, i) => portOffset(`/repo/.claude/worktrees/w${i}`, false))
    )
    expect(offsets.size).toBeGreaterThan(10)
  })
})

describe('isPrimaryCheckout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ports-'))
  const primary = join(dir, 'primary')
  const linked = join(dir, 'linked')
  mkdirSync(join(primary, '.git'), { recursive: true })
  mkdirSync(linked)
  writeFileSync(join(linked, '.git'), 'gitdir: /elsewhere\n')

  test('a .git directory is the primary checkout, a .git file a linked worktree', () => {
    expect(isPrimaryCheckout(primary)).toBe(true)
    expect(isPrimaryCheckout(linked)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('portFor', () => {
  test('CI always uses the base port', () => {
    expect(portFor('srd', { root: '/repo/.claude/worktrees/a', ci: true })).toBe(BASE_PORTS.srd)
  })

  test("this checkout's port is the base plus its offset", () => {
    const offset = portOffset(CHECKOUT_ROOT, isPrimaryCheckout(CHECKOUT_ROOT))
    expect(portFor('stories', { ci: false })).toBe(BASE_PORTS.stories + offset)
  })
})
