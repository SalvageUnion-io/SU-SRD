#!/usr/bin/env bun
/**
 * check-client-contract — a Convex change that would break an already-open
 * ITUN tab must raise the build floor.
 *
 * ## The incident
 *
 * ITUN-CONVEX-9 (2026-10-09): #1212 made `entities.upsertByAppId`'s
 * `expectedUpdatedAt` required. A tab that was open across that deploy still
 * ran the old bundle, which never sent the field, so the backend refused the
 * pilot it had just built. The build floor exists to stop such a tab before it
 * writes (`apps/itun/convex/buildFloor.ts`). The floor only moves when somebody
 * raises it, though, so a breaking change needs something to catch the PR that
 * forgets to.
 *
 * ## The check
 *
 * It imports every module `convex/_generated/api.d.ts` registers and reads each
 * public function's argument validator (`exportArgs()`, the same JSON
 * `convex deploy` pushes). Then it compares them against the committed
 * snapshot, `tools/convex-client-contract.json`, which records the validators
 * as of the floor in force.
 *
 * - A change that rejects calls the snapshot's validators accepted is
 *   **breaking**: a deleted function, a new required argument, an optional
 *   argument made required, a removed field, a narrowed type. It fails unless
 *   `BUILD_FLOOR` was raised above the snapshot's floor.
 * - A change that only accepts more (a new function, a new optional argument,
 *   a widened union) is compatible and needs no raise.
 * - Either way, the snapshot must match the code: `--write` records it, and
 *   refuses to record a breaking change without a raised floor.
 *
 * ## Known limits
 *
 * It sees argument validators only. It cannot see:
 *
 * - a `v.any()` body whose meaning changed (slug-only refs, #1267)
 * - a return shape an older tab reads
 * - a function whose behaviour changed under the same arguments
 *
 * Those need the floor raised by hand. `buildFloor.ts` lists what counts.
 *
 * Usage:
 *   bun tools/check-client-contract.ts           # check
 *   bun tools/check-client-contract.ts --write   # record the snapshot
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

const ROOT = join(import.meta.dir, '..')
const CONVEX_DIR = join(ROOT, 'apps/itun/convex')
const API_PATH = join(CONVEX_DIR, '_generated/api.d.ts')
export const SNAPSHOT_PATH = join(ROOT, 'tools/convex-client-contract.json')

/** Well under today's ~77: trips only if the import walk found next to nothing. */
const FUNCTION_FLOOR = 50

/** A Convex validator as `exportArgs()` serializes it. */
export type ValidatorJSON =
  | { type: 'null' | 'number' | 'bigint' | 'boolean' | 'string' | 'bytes' | 'any' }
  | { type: 'literal'; value: unknown }
  | { type: 'id'; tableName: string }
  | { type: 'array'; value: ValidatorJSON }
  | { type: 'record'; keys: ValidatorJSON; values: { fieldType: ValidatorJSON; optional: boolean } }
  | { type: 'object'; value: Record<string, { fieldType: ValidatorJSON; optional: boolean }> }
  | { type: 'union'; value: ValidatorJSON[] }

/** `module:name` → that public function's argument validator. */
export type Contract = Record<string, ValidatorJSON>

export type Snapshot = { floor: number; functions: Contract }

/** A short rendering of a validator, for failure messages. */
function show(v: ValidatorJSON): string {
  switch (v.type) {
    case 'literal':
      return JSON.stringify(v.value)
    case 'id':
      return `id("${v.tableName}")`
    case 'array':
      return `${show(v.value)}[]`
    case 'union':
      return v.value.map(show).join(' | ')
    default:
      return v.type
  }
}

/** The primitive type a literal's value belongs to (bigint literals arrive as `{ $integer }`). */
function literalType(value: unknown): string {
  if (typeof value === 'object' && value !== null && '$integer' in value) return 'bigint'
  return typeof value
}

/**
 * Why `next` would refuse a value `prev` accepted, as one message per refusal;
 * empty when every value `prev` accepted, `next` accepts too.
 *
 * Conservative where it cannot be sure: a `prev` member that no single `next`
 * union member accepts whole is reported, even if several members would cover
 * it together. A false alarm costs one floor raise; a missed break strands a
 * tab.
 */
export function refusals(prev: ValidatorJSON, next: ValidatorJSON, path: string): string[] {
  if (next.type === 'any') return []
  if (prev.type === 'union') return prev.value.flatMap((member) => refusals(member, next, path))
  if (next.type === 'union') {
    // Report the closest member's refusals, which name the field that changed,
    // rather than "object is no longer accepted (now object | object)".
    const byMember = next.value.map((member) => refusals(prev, member, path))
    if (byMember.some((reasons) => reasons.length === 0)) return []
    return byMember.reduce((best, reasons) => (reasons.length < best.length ? reasons : best))
  }

  const refused = [`${path}: ${show(prev)} is no longer accepted (now ${show(next)})`]
  switch (prev.type) {
    case 'any':
      return refused
    case 'literal':
      if (next.type === 'literal') {
        return JSON.stringify(next.value) === JSON.stringify(prev.value) ? [] : refused
      }
      return next.type === literalType(prev.value) ? [] : refused
    case 'id':
      if (next.type === 'string') return []
      return next.type === 'id' && next.tableName === prev.tableName ? [] : refused
    case 'array':
      return next.type === 'array' ? refusals(prev.value, next.value, `${path}[]`) : refused
    case 'record':
      if (next.type !== 'record') return refused
      return [
        ...refusals(prev.keys, next.keys, `${path}{key}`),
        ...refusals(prev.values.fieldType, next.values.fieldType, `${path}{value}`),
      ]
    case 'object': {
      if (next.type !== 'object') return refused
      const out: string[] = []
      for (const [key, before] of Object.entries(prev.value)) {
        const after = next.value[key]
        const at = `${path}.${key}`
        if (after === undefined) {
          out.push(`${at}: removed, and an older tab may still send it`)
          continue
        }
        if (before.optional && !after.optional) out.push(`${at}: became required`)
        out.push(...refusals(before.fieldType, after.fieldType, at))
      }
      for (const [key, after] of Object.entries(next.value)) {
        if (prev.value[key] === undefined && !after.optional) {
          out.push(`${path}.${key}: new required argument, which an older tab never sends`)
        }
      }
      return out
    }
    default:
      return next.type === prev.type ? [] : refused
  }
}

/** Every way `next` breaks a tab built against `prev`. */
export function breaksBetween(prev: Contract, next: Contract): string[] {
  const out: string[] = []
  for (const [fn, before] of Object.entries(prev)) {
    const after = next[fn]
    if (after === undefined)
      out.push(`${fn}: deleted or renamed, and an older tab may still call it`)
    else out.push(...refusals(before, after, fn))
  }
  return out
}

export type Verdict = { ok: true; write: boolean; message: string } | { ok: false; message: string }

const RAISE =
  'raise BUILD_FLOOR in apps/itun/convex/buildFloor.ts to the current time (`date +%s`), then run `bun tools/check-client-contract.ts --write`.'

/**
 * The decision, apart from the filesystem. `write` is whether the snapshot on
 * disk differs from the one this would record.
 */
export function verdict(snapshot: Snapshot | null, current: Contract, floor: number): Verdict {
  const recorded: Snapshot = { floor, functions: current }
  if (snapshot === null) {
    return { ok: true, write: true, message: 'no snapshot yet' }
  }
  if (floor < snapshot.floor) {
    return {
      ok: false,
      message: `BUILD_FLOOR (${floor}) is below the snapshot's floor (${snapshot.floor}). Never lower it: a lower floor lets back in tabs this backend refuses.`,
    }
  }
  const breaks = breaksBetween(snapshot.functions, current)
  if (breaks.length > 0 && floor === snapshot.floor) {
    return {
      ok: false,
      message: [
        'These changes refuse calls that an already-open ITUN tab still makes:',
        ...breaks.map((b) => `  - ${b}`),
        '',
        `Either keep them compatible (make the new argument optional, keep the old function), or ${RAISE}`,
      ].join('\n'),
    }
  }
  const write = JSON.stringify(snapshot) !== JSON.stringify(recorded)
  return { ok: true, write, message: breaks.length > 0 ? 'breaking, floor raised' : 'compatible' }
}

/** The module paths `api.d.ts` registers (`model/entities`, `games`, …). */
function registeredModules(): string[] {
  const source = readFileSync(API_PATH, 'utf8')
  return [...source.matchAll(/^import type \* as \w+ from "\.\.\/([\w/.]+)\.js";$/gm)]
    .map((m) => m[1])
    .filter((path): path is string => path !== undefined)
}

type Registered = { isPublic?: boolean; exportArgs?: () => string }

/** Every public function's argument validator, keyed and sorted by `module:name`. */
async function readContract(): Promise<{ contract: Contract; modules: number }> {
  const modules = registeredModules()
  const entries: Array<[string, ValidatorJSON]> = []
  for (const path of modules) {
    const mod: Record<string, unknown> = await import(join(CONVEX_DIR, `${path}.ts`))
    for (const [name, value] of Object.entries(mod)) {
      const fn = value as Registered | null
      if (fn?.isPublic !== true || typeof fn.exportArgs !== 'function') continue
      entries.push([`${path}:${name}`, JSON.parse(fn.exportArgs()) as ValidatorJSON])
    }
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return { contract: Object.fromEntries(entries), modules: modules.length }
}

function readSnapshot(): Snapshot | null {
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot
  } catch {
    // No snapshot yet: `verdict` treats that as "record one".
    return null
  }
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write')
  const { BUILD_FLOOR } = await import(join(CONVEX_DIR, 'buildFloor.ts'))
  const { contract, modules } = await readContract()
  const count = Object.keys(contract).length
  assertScanFloor('client contract (public Convex functions)', count, FUNCTION_FLOOR)

  const result = verdict(readSnapshot(), contract, BUILD_FLOOR)
  if (!result.ok) {
    console.error(`\n✗ client contract: ${result.message}\n`)
    process.exit(1)
  }
  if (result.write && !write) {
    console.error(
      `\n✗ client contract: tools/convex-client-contract.json is out of date (${result.message}). Run \`bun tools/check-client-contract.ts --write\` and commit it.\n`
    )
    process.exit(1)
  }
  if (result.write) {
    writeFileSync(
      SNAPSHOT_PATH,
      `${JSON.stringify({ floor: BUILD_FLOOR, functions: contract }, null, 2)}\n`
    )
    console.log(`✓ client contract: recorded ${count} public functions (${result.message})`)
    return
  }
  console.log(
    `✓ client contract: ${count} public functions in ${modules} modules match the snapshot (floor ${BUILD_FLOOR})`
  )
}

if (import.meta.main) await main()
