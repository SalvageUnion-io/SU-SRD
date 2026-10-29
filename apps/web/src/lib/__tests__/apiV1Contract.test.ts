import { describe, expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { apiV1SchemaEndpoint } from '../../reference/endpoints/apiV1'
import type { RouteContext } from '../../reference/types'

/**
 * The Dataset API v1's written promise (ADR-056, the `/api/` page): within v1
 * a change only ever adds. `/api/v1/` and `/schema/` change together, so their
 * parity (`apiV1.test.ts`) cannot see a field renamed in the reference
 * package's Zod schemas. This holds the published JSON Schemas to the
 * committed contract (`tools/baselines/api-v1-contract.json`): every schema,
 * and every path in it (a property, an array's items, a record's values) with
 * its types and whether it is required.
 *
 * A property that disappears, changes type or changes whether it is required
 * fails; a new schema or property passes. To record additions, rewrite the
 * contract with `UPDATE_API_V1_CONTRACT=1 bun test apiV1Contract`, which
 * refuses while anything breaks.
 */

const CONTRACT_PATH = join(import.meta.dir, '../../../../../tools/baselines/api-v1-contract.json')

type JsonSchema = {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  allOf?: JsonSchema[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema | JsonSchema[]
  additionalProperties?: boolean | JsonSchema
}

/** One schema's contract: each path to `<required|optional|each> <type> | <type>`. */
type SchemaContract = Record<string, string>
type Contract = Record<string, SchemaContract>

function jsonType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value
}

function variants(node: JsonSchema): JsonSchema[] {
  return [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]
}

/** The JSON types a value under `node` can have. */
function typesOf(node: JsonSchema): Set<string> {
  const out = new Set<string>()
  if (node.type !== undefined) for (const t of [node.type].flat()) out.add(t)
  else if (node.const !== undefined) out.add(jsonType(node.const))
  else if (node.enum) for (const value of node.enum) out.add(jsonType(value))
  for (const variant of variants(node)) for (const t of typesOf(variant)) out.add(t)
  if (out.size === 0) out.add('any')
  return out
}

/** How a path is there: always, maybe, or as each item of an array or value of a record. */
type Presence = 'required' | 'optional' | 'each'
type Entry = { types: Set<string>; presence: Presence }

function record(into: Map<string, Entry>, path: string, node: JsonSchema, presence: Presence) {
  const known = into.get(path)
  if (!known) {
    into.set(path, { types: typesOf(node), presence })
    return
  }
  for (const t of typesOf(node)) known.types.add(t)
  if (known.presence === 'required' && presence === 'optional') known.presence = 'optional'
}

/** Every path under `node`: `name`, `stats.hp`, `content[]`, `content[].type`, `extras{}`. */
function collect(node: JsonSchema, path: string, into: Map<string, Entry>): void {
  for (const variant of variants(node)) collect(variant, path, into)
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    const childPath = path ? `${path}.${key}` : key
    record(into, childPath, child, (node.required ?? []).includes(key) ? 'required' : 'optional')
    collect(child, childPath, into)
  }
  for (const item of [node.items ?? []].flat()) {
    record(into, `${path}[]`, item, 'each')
    collect(item, `${path}[]`, into)
  }
  if (typeof node.additionalProperties === 'object') {
    record(into, `${path}{}`, node.additionalProperties, 'each')
    collect(node.additionalProperties, `${path}{}`, into)
  }
}

/** A published JSON Schema's contract: the paths of one entity (`items`). */
function schemaContract(schema: JsonSchema): SchemaContract {
  const entries = new Map<string, Entry>()
  collect(schema, '', entries)
  return Object.fromEntries(
    [...entries]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, { types, presence }]) => [path, `${presence} ${[...types].sort().join(' | ')}`])
  )
}

/** What breaks the promise between the committed contract and the published one. */
function contractBreaks(committed: Contract, published: Contract): string[] {
  const breaks: string[] = []
  for (const [schemaId, paths] of Object.entries(committed)) {
    const now = published[schemaId]
    if (!now) {
      breaks.push(`${schemaId}: the schema is gone`)
      continue
    }
    for (const [path, was] of Object.entries(paths)) {
      const is = now[path]
      if (is === undefined) breaks.push(`${schemaId}: ${path} is gone (was ${was})`)
      else if (is !== was) breaks.push(`${schemaId}: ${path} was ${was}, is ${is}`)
    }
  }
  return breaks
}

function publishedContract(): Contract {
  const contract: Contract = {}
  for (const path of apiV1SchemaEndpoint.getStaticPaths?.() ?? []) {
    const body = apiV1SchemaEndpoint.body(
      path as RouteContext<typeof path.params, typeof path.props>
    )
    contract[path.params.schemaId] = schemaContract(JSON.parse(body) as JsonSchema)
  }
  return contract
}

describe('the Dataset API v1 contract', () => {
  const published = publishedContract()
  const committed = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as Contract

  test('the published schemas only add to the committed contract', () => {
    const breaks = contractBreaks(committed, published)
    expect(breaks).toEqual([])
    if (process.env.UPDATE_API_V1_CONTRACT === '1') {
      writeFileSync(CONTRACT_PATH, `${JSON.stringify(published, null, 2)}\n`)
    }
  })

  test('holds every schema v1 served when it was written', () => {
    expect(Object.keys(committed).length).toBeGreaterThan(20)
  })
})

describe('contractBreaks', () => {
  const was: Contract = { chassis: { name: 'required string', notes: 'optional string' } }

  test('passes an added property and an added schema', () => {
    const now = {
      chassis: { ...was.chassis, hasArtwork: 'optional boolean' },
      drones: { name: 'required string' },
    }
    expect(contractBreaks(was, now)).toEqual([])
  })

  test('fails a property that disappears, changes type or becomes required', () => {
    expect(contractBreaks(was, { chassis: { name: 'required string' } })).toEqual([
      'chassis: notes is gone (was optional string)',
    ])
    expect(
      contractBreaks(was, { chassis: { name: 'required number', notes: 'optional string' } })
    ).toEqual(['chassis: name was required string, is required number'])
    expect(
      contractBreaks(was, { chassis: { name: 'required string', notes: 'required string' } })
    ).toEqual(['chassis: notes was optional string, is required string'])
  })

  test('fails a schema that disappears', () => {
    expect(contractBreaks(was, {})).toEqual(['chassis: the schema is gone'])
  })

  test('reads paths through arrays, unions and records', () => {
    expect(
      schemaContract({
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            cost: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            tags: { type: 'array', items: { type: 'object', properties: { id: { const: 'x' } } } },
            extras: { type: 'object', additionalProperties: { type: 'number' } },
          },
        },
      })
    ).toEqual({
      '[]': 'each object',
      '[].cost': 'optional integer | null',
      '[].extras': 'optional object',
      '[].extras{}': 'each number',
      '[].name': 'required string',
      '[].tags': 'optional array',
      '[].tags[]': 'each object',
      '[].tags[].id': 'optional string',
    })
  })
})
