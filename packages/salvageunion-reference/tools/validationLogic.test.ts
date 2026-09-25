import { describe, expect, test } from 'bun:test'
import { z } from '../lib/zod.js'
import { checkAllFiles, checkFile, validateUUID } from './checkUniqueIdsLogic.js'
import { selectChecks } from './validate.js'
import { findActionReferenceErrors } from './validateActionReferencesLogic.js'
import { findReferenceErrors } from './validateReferencesLogic.js'
import {
  validateAllFilesAgainstSchemas,
  validateFileAgainstSchema,
} from './validateSchemasLogic.js'
import { findSlugCollisions } from './validateSlugsLogic.js'

/**
 * Fixture tests for the five data validators that gate merges through
 * `tools/validate.ts` and had no test of their own: ids, slugs, references,
 * actions and schemas. Each runs against a tiny hand-built data bag, so a
 * detector that silently stops detecting fails here — the real dataset is
 * clean, which means a broken validator and a working one look identical on it.
 */

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('ids', () => {
  test('accepts a v4 UUID and rejects anything else', () => {
    expect(validateUUID(A)).toBe(true)
    expect(validateUUID('11111111-1111-1111-1111-111111111111')).toBe(false) // not v4
    expect(validateUUID('pilot')).toBe(false)
  })

  test('finds invalid and in-file duplicate ids, including nested action ids', () => {
    const r = checkFile('systems.json', [{ id: A, actions: [{ id: 'bad', name: 'x' }] }, { id: A }])
    expect(r.invalidUUIDs).toEqual([{ id: 'bad', index: 0, context: 'root.actions[0]' }])
    expect(r.duplicatesInFile).toEqual([{ id: A, indices: [0, 1] }])
  })

  test('slug-id files are exempt from the UUID format but not from duplicates', () => {
    const r = checkFile('catalog-categories.json', [{ id: 'pilot' }, { id: 'pilot' }])
    expect(r.invalidUUIDs).toEqual([])
    expect(r.duplicatesInFile).toHaveLength(1)
  })

  test('an id reused across files is a global duplicate', () => {
    const r = checkAllFiles({ 'a.json': [{ id: A }], 'b.json': [{ id: A }, { id: B }] })
    expect(r.globalDuplicates.map((d) => d.id)).toEqual([A])
    expect(r.uniqueIds).toBe(2)
  })
})

describe('slugs', () => {
  test('two names that slug identically collide; different files do not', () => {
    const collisions = findSlugCollisions({
      'systems.json': [{ name: 'Heavy Arm' }, { name: 'Heavy-Arm' }, { name: 'Light Arm' }],
      'modules.json': [{ name: 'Heavy Arm' }],
    })
    expect(collisions).toHaveLength(1)
    expect(collisions[0]?.file).toBe('systems.json')
    expect(collisions[0]?.slug).toBe('heavy-arm')
  })
})

describe('references', () => {
  const base = {
    'systems.json': [{ name: 'Laser' }],
    'modules.json': [{ name: 'Scanner' }],
    'roll-tables.json': [{ name: 'Salvage' }],
  }

  test('a chassis pattern naming an unknown system or module is an error', () => {
    const errors = findReferenceErrors({
      ...base,
      'chassis.json': [
        { name: 'Mule', patterns: [{ name: 'P', systems: ['Laser', 'Ghost'], modules: ['Nope'] }] },
      ],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Ghost', 'Nope'])
  })

  test('a drone may list a module in systems, but not an unknown name', () => {
    const errors = findReferenceErrors({
      ...base,
      'drones.json': [{ name: 'D', systems: ['Laser', 'Scanner', 'Missing'] }],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Missing'])
  })

  test('a tableName anywhere in an entity must name a real roll table', () => {
    const errors = findReferenceErrors({
      ...base,
      'systems.json': [{ name: 'Laser', actions: [{ effect: { tableName: 'Nowhere' } }] }],
      'modules.json': [{ name: 'Scanner', tableName: 'Salvage' }],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Nowhere'])
  })

  test('a catalog shortlist must name entities of the schema it cites', () => {
    const errors = findReferenceErrors({
      ...base,
      'actions.json': [
        {
          name: 'Pick',
          choices: [
            {
              id: 'c1',
              source: { kind: 'catalog', entities: ['Laser', 'Ghost'], schema: ['systems'] },
            },
            { id: 'c2', source: { kind: 'catalog', entities: ['Laser'] } },
          ],
        },
      ],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Ghost', 'Laser'])
    expect(errors[1]?.message).toContain('no source.schema')
  })
})

describe('actions', () => {
  test('an unknown action name is an error, with a suggestion for a near miss', () => {
    const errors = findActionReferenceErrors({
      'actions.json': [{ name: 'Heavy Strike' }],
      'systems.json': [{ name: 'S', actions: ['Heavy Strike', 'heavy strike', 'Nothing'] }],
      'chassis.json': [{ name: 'C', chassisAbilities: ['Ghost'] }],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['heavy strike', 'Nothing', 'Ghost'])
    expect(errors[0]?.suggestion).toBe('Did you mean "Heavy Strike"?')
    expect(errors[2]?.field).toBe('chassisAbilities')
  })

  test('files outside the referencing set are not read', () => {
    expect(
      findActionReferenceErrors({ 'keywords.json': [{ name: 'K', actions: ['Nope'] }] })
    ).toEqual([])
  })
})

describe('schemas', () => {
  const map = { widgets: z.object({ name: z.string(), size: z.number() }) as z.ZodType<unknown> }

  test('each failing entry is reported with its name and issue path', () => {
    const report = validateFileAgainstSchema(
      'widgets.json',
      [
        { name: 'ok', size: 1 },
        { name: 'bad', size: 'big' },
      ],
      map
    )
    expect(report.status).toBe('fail')
    if (report.status !== 'fail') return
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]?.name).toBe('bad')
    expect(report.failures[0]?.errors[0]).toStartWith('size:')
  })

  test('a file with no schema is reported as such, not as a pass', () => {
    const reports = validateAllFilesAgainstSchemas({ 'widgets.json': [], 'mystery.json': [] }, map)
    expect(reports.map((r) => r.status)).toEqual(['no-schema', 'ok'])
  })
})

describe('validate.ts --only', () => {
  test('selects the named checks, all of them by default, and rejects an unknown id', () => {
    expect(selectChecks([]).length).toBe(11)
    expect(selectChecks(['--only=ids,slugs']).map((c) => c.id)).toEqual(['ids', 'slugs'])
    expect(() => selectChecks(['--only=nope'])).toThrow('unknown check(s): nope')
  })
})
