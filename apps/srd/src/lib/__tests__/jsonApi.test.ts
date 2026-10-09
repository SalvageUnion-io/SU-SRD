import { describe, expect, test } from 'bun:test'
import { z } from 'salvageunion-reference/zod'
import { endpoints } from '../../../ssg/endpoints'
import { SITE_URL } from '../constants'
import { getEntitySchemas } from '../gameData'

/**
 * The public JSON API holds to its own published contract.
 *
 * It did not: `/schema/<id>.json` re-serialised the models, so every row
 * carried the `schemaName` that `BaseModel` stamps on it, and every
 * `/schema/<id>.schema.json` forbids that key — 4 of 4 sampled datasets failed
 * their own schema. Each schema's `$id` named a host that does not serve it, and
 * `llms.txt` taught an item URL that 404'd. These read the endpoints exactly as
 * the build emits them.
 */

const outputs = new Map(
  endpoints.flatMap((endpoint) => endpoint.resolve()).map((output) => [output.outputPath, output])
)

function emitted(outputPath: string): string {
  const output = outputs.get(outputPath)
  if (!output) throw new Error(`the build emits no ${outputPath}`)
  return output.body()
}

const schemaIds = getEntitySchemas().map((schema) => schema.id)
const validators = new Map(
  schemaIds.map((id) => [id, z.fromJSONSchema(JSON.parse(emitted(`schema/${id}.schema.json`)))])
)

function validator(id: string): z.ZodType {
  const found = validators.get(id)
  if (!found) throw new Error(`no emitted schema for ${id}`)
  return found
}

describe('the JSON API', () => {
  test.each(schemaIds)('/schema/%s.json validates against its emitted schema', (id) => {
    const result = validator(id).safeParse(JSON.parse(emitted(`schema/${id}.json`)))
    expect(result.error?.issues.slice(0, 3) ?? []).toEqual([])
  })

  test('every item endpoint validates against its schema', () => {
    const failures: string[] = []
    let checked = 0
    for (const [outputPath, output] of outputs) {
      const id = outputPath.match(/^schema\/([^/]+)\/item\/[^/]+\.json$/)?.[1]
      if (!id) continue
      checked++
      const result = validator(id).safeParse([JSON.parse(output.body())])
      if (!result.success) failures.push(`${outputPath}: ${result.error.issues[0]?.message}`)
    }
    expect(checked).toBeGreaterThan(schemaIds.length)
    expect(failures).toEqual([])
  })

  test.each(schemaIds)('/schema/%s.schema.json names its own URL as $id', (id) => {
    const outputPath = `schema/${id}.schema.json`
    expect(JSON.parse(emitted(outputPath)).$id).toBe(`${SITE_URL}/${outputPath}`)
  })

  test('every /schema/…json URL in llms.txt is an emitted endpoint', () => {
    const urls = emitted('llms.txt').match(/\/schema\/[^\s`)]+\.json/g) ?? []
    const concrete = urls.filter((url) => !url.includes('{'))
    expect(concrete.length).toBeGreaterThan(0)
    expect(concrete.filter((url) => !outputs.has(url.slice(1)))).toEqual([])
  })
})
