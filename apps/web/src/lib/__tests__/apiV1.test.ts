import { describe, expect, test } from 'bun:test'
import { z } from 'salvageunion-reference/zod'
import { endpoints } from '../../../ssg/endpoints'
import { redirectRules } from '../../reference/endpoints/redirects'
import { API_V1_PATH, apiV1ItemPath } from '../apiV1Paths'
import { SITE_URL } from '../constants'
import { getEntitySchemas } from '../gameData'

/**
 * The Dataset API v1 (ADR-053) holds to its published contract: it serves the
 * same files `/schema/*` does, each schema's `$id` is its v1 URL, everything
 * validates against its schema, and the manifest names only URLs the build
 * emits. These read the endpoints exactly as the build emits them.
 */

const outputs = new Map(
  endpoints.flatMap((endpoint) => endpoint.resolve()).map((output) => [output.outputPath, output])
)

function emitted(outputPath: string): string {
  const output = outputs.get(outputPath)
  if (!output) throw new Error(`the build emits no ${outputPath}`)
  return output.body()
}

/** A URL's path under `dist`, for an absolute URL on this site. */
function outputPathOf(url: string): string {
  expect(url.startsWith(`${SITE_URL}/`)).toBe(true)
  return url.slice(SITE_URL.length + 1)
}

const schemaIds = getEntitySchemas().map((schema) => schema.id)
const manifest = JSON.parse(emitted('api/v1/index.json'))

describe('the Dataset API v1', () => {
  test('the manifest names version 1 and every published schema, in order', () => {
    expect(manifest.version).toBe(1)
    expect(manifest.docs).toBe(`${SITE_URL}/api/`)
    expect(manifest.schemas.map((schema: { id: string }) => schema.id)).toEqual(schemaIds)
  })

  test.each(schemaIds)('%s: every manifest URL is an emitted file', (id) => {
    const entry = manifest.schemas.find((schema: { id: string }) => schema.id === id)
    expect(outputs.has(outputPathOf(entry.data))).toBe(true)
    expect(outputs.has(outputPathOf(entry.schema))).toBe(true)
    expect(entry.item).toBe(`${SITE_URL}${API_V1_PATH}/${id}/{slug}.json`)
  })

  test.each(schemaIds)('%s: the data is /schema/ byte for byte, counted and hashed', async (id) => {
    const body = emitted(`api/v1/${id}.json`)
    expect(body).toBe(emitted(`schema/${id}.json`))
    const entry = manifest.schemas.find((schema: { id: string }) => schema.id === id)
    expect(entry.itemCount).toBe(JSON.parse(body).length)
    const digest = new Bun.CryptoHasher('sha256').update(body).digest('hex')
    expect(entry.sha256).toBe(digest)
  })

  test.each(schemaIds)('%s: the schema names its v1 URL and differs in nothing else', (id) => {
    const v1 = JSON.parse(emitted(`api/v1/${id}.schema.json`))
    const unversioned = JSON.parse(emitted(`schema/${id}.schema.json`))
    expect(v1.$id).toBe(`${SITE_URL}/api/v1/${id}.schema.json`)
    expect({ ...v1, $id: null }).toEqual({ ...unversioned, $id: null })
  })

  test.each(schemaIds)('%s: the data validates against its v1 schema', (id) => {
    const schema = z.fromJSONSchema(JSON.parse(emitted(`api/v1/${id}.schema.json`)))
    const result = schema.safeParse(JSON.parse(emitted(`api/v1/${id}.json`)))
    expect(result.error?.issues.slice(0, 3) ?? []).toEqual([])
  })

  test('every v1 item is its /schema/ item, and every /schema/ item has one', () => {
    const legacy = [...outputs.keys()].filter((path) =>
      /^schema\/[^/]+\/item\/[^/]+\.json$/.test(path)
    )
    expect(legacy.length).toBeGreaterThan(schemaIds.length)
    const missing: string[] = []
    for (const path of legacy) {
      const [, id, slug] = path.match(/^schema\/([^/]+)\/item\/([^/]+)\.json$/) ?? []
      const v1 = apiV1ItemPath(id ?? '', slug ?? '').slice(1)
      if (!outputs.has(v1) || emitted(v1) !== emitted(path)) missing.push(v1)
    }
    expect(missing).toEqual([])
  })

  test('a former slug answers under v1 as it does under /schema/', () => {
    const rules = redirectRules()
    const legacy = rules.filter((rule) => /^\/schema\/.+\/item\/.+\.json$/.test(rule.from))
    expect(legacy.length).toBeGreaterThan(0)
    for (const rule of legacy) {
      const [, id, slug] = rule.from.match(/^\/schema\/([^/]+)\/item\/([^/]+)\.json$/) ?? []
      const [, , to] = rule.to.match(/^\/schema\/([^/]+)\/item\/([^/]+)\.json$/) ?? []
      expect(rules).toContainEqual({
        from: apiV1ItemPath(id ?? '', slug ?? ''),
        to: apiV1ItemPath(id ?? '', to ?? ''),
      })
    }
  })
})
