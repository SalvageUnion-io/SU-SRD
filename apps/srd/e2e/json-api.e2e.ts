import { test, expect } from '@playwright/test'

/**
 * (d) The static JSON API endpoint (`/schema/[schemaId].json`) returns a valid
 * JSON array of entities. This is a pre-rendered file, so no page hydration is
 * involved — a plain request assertion is sufficient.
 */
test('schema JSON endpoint returns a valid entity array', async ({ request }) => {
  const res = await request.get('/schema/chassis.json')

  expect(res.ok()).toBeTruthy()
  expect(res.headers()['content-type']).toContain('application/json')

  const body = (await res.json()) as unknown
  expect(Array.isArray(body)).toBe(true)

  const entities = body as Array<Record<string, unknown>>
  expect(entities.length).toBeGreaterThan(0)
  expect(entities[0]).toHaveProperty('name')
})
