import { describe, expect, test } from 'bun:test'
import { checkAllFiles, checkFile, validateUUID } from './checkUniqueIdsLogic.js'
import { CHECK_IDS, selectChecks } from './selectChecks.js'
import { findActionReferenceErrors } from './validateActionReferencesLogic.js'
import { findReferenceErrors } from './validateReferencesLogic.js'
import { findSlugCollisions } from './validateSlugsLogic.js'

/**
 * Fixture tests for the four data validators that gate merges through
 * `tools/validate.ts` and had no test of their own: ids, slugs, references
 * and actions. Each runs against a tiny hand-built data bag, so a
 * detector that silently stops detecting fails here — the real dataset is
 * clean, which means a broken validator and a working one look identical on it.
 */

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

/** The reference check with no known-unresolved allowlist, so a fixture sees every error. */
const refs = (bag: Record<string, unknown[]>) => findReferenceErrors(bag, [])

describe('ids', () => {
  test('accepts a v4 UUID and rejects anything else', () => {
    expect(validateUUID(A)).toBe(true)
    expect(validateUUID('11111111-1111-1111-1111-111111111111')).toBe(false) // not v4
    expect(validateUUID('pilot')).toBe(false)
  })

  test('finds invalid and in-file duplicate ids, including nested action ids', () => {
    const r = checkFile('systems.json', [{ id: A, actions: [{ id: 'bad', name: 'x' }] }, { id: A }])
    expect(r.invalidUUIDs).toEqual([{ id: 'bad', index: 0, context: 'root.actions[0]' }])
    expect(r.duplicatesInFile).toEqual([{ id: A, indices: [0, 1], contexts: ['root', 'root'] }])
  })

  test('an id at any depth is checked, guide steps included, with the path of each copy', () => {
    const guide = { id: B, steps: [{ id: A }, { id: 'bad' }], blocks: [{ deep: [{ id: A }] }] }
    const r = checkFile('guides.json', [guide])
    expect(r.invalidUUIDs).toEqual([{ id: 'bad', index: 0, context: 'root.steps[1]' }])
    expect(r.duplicatesInFile).toEqual([
      { id: A, indices: [0, 0], contexts: ['root.steps[0]', 'root.blocks[0].deep[0]'] },
    ])
  })

  test('a non-string id is visited, so the format check rejects it', () => {
    const r = checkFile('systems.json', [{ id: A, actions: [{ id: 12345 }] }])
    expect(r.invalidUUIDs).toEqual([{ id: '12345', index: 0, context: 'root.actions[0]' }])
  })

  test('a nested id that repeats an entity id in another file is a global duplicate', () => {
    const r = checkAllFiles({
      'chassis.json': [{ id: A }],
      'guides.json': [{ id: B, steps: [{ id: A }] }],
    })
    expect(r.globalDuplicates).toEqual([
      {
        id: A,
        files: [
          { file: 'chassis.json', indices: [0] },
          { file: 'guides.json', indices: [0] },
        ],
      },
    ])
  })

  test('an id repeated within one file is not also reported as a cross-file duplicate', () => {
    const r = checkAllFiles({ 'a.json': [{ id: A }, { id: A }] })
    expect(r.globalDuplicates).toEqual([])
    expect(r.files[0]?.duplicatesInFile).toHaveLength(1)
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
    const errors = refs({
      ...base,
      'chassis.json': [
        { name: 'Mule', patterns: [{ name: 'P', systems: ['Laser', 'Ghost'], modules: ['Nope'] }] },
      ],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Ghost', 'Nope'])
  })

  test('a drone may list a module in systems, but not an unknown name', () => {
    const errors = refs({
      ...base,
      'drones.json': [{ name: 'D', systems: ['Laser', 'Scanner', 'Missing'] }],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Missing'])
  })

  test('a tableName anywhere in an entity must name a real roll table', () => {
    const errors = refs({
      ...base,
      'systems.json': [{ name: 'Laser', actions: [{ effect: { tableName: 'Nowhere' } }] }],
      'modules.json': [{ name: 'Scanner', tableName: 'Salvage' }],
    })
    expect(errors.map((e) => e.referencedName)).toEqual(['Nowhere'])
  })

  test('a catalog shortlist must name entities of the schema it cites', () => {
    const errors = refs({
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

  test('a drone inside a chassis pattern must name real systems and modules', () => {
    const errors = refs({
      ...base,
      'chassis.json': [
        {
          name: 'Mule',
          patterns: [
            {
              name: 'P',
              drones: [{ name: 'Bee', systems: ['Laser', 'Ghost'], modules: ['Nope'] }],
            },
          ],
        },
      ],
    })
    expect(errors.map((e) => e.field)).toEqual([
      'patterns.P.drones.Bee.systems',
      'patterns.P.drones.Bee.modules',
    ])
  })

  test('nested choices and equipment action choices are checked too', () => {
    const catalog = (entities: string[]) => ({
      kind: 'catalog',
      entities,
      schema: ['systems'],
    })
    const errors = refs({
      ...base,
      'actions.json': [
        {
          name: 'Pick',
          choices: [{ id: 'c1', choices: [{ id: 'c2', source: catalog(['Ghost']) }] }],
        },
      ],
      'equipment.json': [
        {
          name: 'Kit',
          actions: [{ name: 'Use', choices: [{ id: 'c3', source: catalog(['Nope']) }] }],
        },
      ],
    })
    expect(errors.map((e) => [e.file, e.referencedName])).toEqual([
      ['actions.json', 'Ghost'],
      ['equipment.json', 'Nope'],
    ])
  })

  test('a catalog choice must name a schema wherever it sits, entity-level equipment choices included', () => {
    const errors = refs({
      ...base,
      'equipment.json': [
        {
          name: 'Rifle',
          choices: [{ id: 'c1', source: { kind: 'catalog', entities: ['Laser'] } }],
        },
      ],
    })
    expect(errors.map((e) => e.field)).toEqual(['choices[0].source.schema'])
  })

  test('a trait shortlist resolves trait names without case', () => {
    const traits = { 'traits.json': [{ name: 'ballistic' }] }
    const choice = (entities: string[]) => ({
      id: 'c',
      source: { kind: 'catalog', schema: ['traits'], entities },
    })
    expect(
      refs({
        ...base,
        ...traits,
        'equipment.json': [{ name: 'R', choices: [choice(['Ballistic'])] }],
      })
    ).toEqual([])
    expect(
      refs({
        ...base,
        ...traits,
        'equipment.json': [{ name: 'R', choices: [choice(['Energy'])] }],
      }).map((e) => e.referencedName)
    ).toEqual(['Energy'])
  })

  test('a rollTable at any depth of any file must name a real roll table', () => {
    const errors = refs({
      ...base,
      'crawlers.json': [
        {
          name: 'C',
          npc: { choices: [{ id: 'c', source: { kind: 'table', rollTable: 'Ghost' } }] },
        },
      ],
      'guides.json': [{ id: A, name: 'G', steps: [{ id: B, name: 'S', rollTable: 'Salvage' }] }],
    })
    expect(errors.map((e) => [e.file, e.field, e.referencedName])).toEqual([
      ['crawlers.json', 'npc.choices[0].source.rollTable', 'Ghost'],
    ])
  })

  test('a guideRef must name a guide id, and step schemaEntities must exist in the step schema', () => {
    const errors = refs({
      ...base,
      'guides.json': [
        {
          id: A,
          name: 'G',
          steps: [
            { id: 's1', name: 'Sub', guideRef: A },
            { id: 's2', name: 'Sub2', guideRef: B },
            {
              id: 's3',
              name: 'Pick',
              schema: ['systems', 'modules'],
              schemaEntities: ['Laser', 'Scanner', 'Ghost'],
            },
          ],
        },
      ],
    })
    expect(errors.map((e) => [e.field, e.referencedName])).toEqual([
      ['steps[1].guideRef', B],
      ['steps[2].schemaEntities', 'Ghost'],
    ])
  })

  test('a faction formation member must name a real chassis and pattern, or an entity of its schema', () => {
    const errors = refs({
      ...base,
      'chassis.json': [{ name: 'Mule', patterns: [{ name: 'Crusher' }] }],
      'squads.json': [{ name: 'Waster Mob' }],
      'factions.json': [
        {
          name: 'F',
          formation: [
            { chassis: 'Mule', pattern: 'Crusher' },
            { chassis: 'Mule', pattern: 'Nope' },
            { chassis: 'Ghost', pattern: 'Crusher' },
            { chassis: 'Waster Mob', schema: 'squads' },
            { chassis: 'Waster Mob', schema: 'npcs' },
          ],
        },
      ],
    })
    expect(errors.map((e) => [e.field, e.referencedName])).toEqual([
      ['formation[1]', 'Nope'],
      ['formation[2]', 'Ghost'],
      ['formation[4]', 'Waster Mob'],
    ])
  })

  test('a grant must name an entity of its schema, or a choice on the same entity', () => {
    const errors = refs({
      ...base,
      'equipment.json': [{ name: 'Kit' }],
      'abilities.json': [
        {
          name: 'A',
          choices: [{ id: 'c', name: 'Pick One' }],
          grants: [
            { schema: 'equipment', name: 'Kit' },
            { schema: 'equipment', name: 'Ghost' },
            { schema: 'choice', name: 'Pick One' },
            { schema: 'choice', name: 'Pick Two' },
          ],
        },
      ],
    })
    expect(errors.map((e) => [e.field, e.referencedName])).toEqual([
      ['grants[1]', 'Ghost'],
      ['grants[3]', 'Pick Two'],
    ])
  })

  test('a pattern drone ref must name a drone, and a drone module must be a real module', () => {
    const errors = refs({
      ...base,
      'drones.json': [{ name: 'Big Brother Drone', modules: ['Scanner', 'Nope'] }],
      'chassis.json': [
        {
          name: 'C',
          patterns: [
            {
              name: 'P',
              drones: [
                { name: 'Shield Drone', ref: 'Big Brother Drone', systems: [], modules: [] },
                { name: 'Odd Drone', ref: 'Ghost Drone', systems: [], modules: [] },
              ],
            },
          ],
        },
      ],
    })
    expect(errors.map((e) => [e.field, e.referencedName])).toEqual([
      ['patterns.P.drones.Odd Drone.ref', 'Ghost Drone'],
      ['modules', 'Nope'],
    ])
  })

  test('a known-unresolved ref is tolerated, and a stale one fails', () => {
    const known = [
      {
        file: 'factions.json',
        entityName: 'F',
        field: 'formation[0]',
        referencedName: 'Mutant Mob',
        reason: 'owner call',
      },
    ]
    const factions = (name: string) => ({
      'factions.json': [{ name: 'F', formation: [{ chassis: name, schema: 'npcs' }] }],
    })
    expect(findReferenceErrors({ ...base, ...factions('Mutant Mob') }, known)).toEqual([])
    expect(
      findReferenceErrors(
        { ...base, 'npcs.json': [{ name: 'Mutant Mob' }], ...factions('Mutant Mob') },
        known
      ).map((e) => e.message)
    ).toEqual(['stale entry — the ref now resolves or is gone; remove it'])
    // The same name unresolved in another faction is not covered by the entry.
    const elsewhere = {
      'factions.json': [
        { name: 'F', formation: [{ chassis: 'Mutant Mob', schema: 'npcs' }] },
        { name: 'G', formation: [{ chassis: 'Mutant Mob', schema: 'npcs' }] },
      ],
    }
    expect(findReferenceErrors({ ...base, ...elsewhere }, known).map((e) => e.entityName)).toEqual([
      'G',
    ])
  })

  test('a ref on the row itself reports a path with no leading dot', () => {
    const errors = refs({
      ...base,
      'actions.json': [{ name: 'A', source: { kind: 'catalog' }, guideRef: 'nope' }],
    })
    expect(errors.map((e) => e.field).sort()).toEqual(['guideRef', 'source.schema'])
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

describe('validate.ts --only', () => {
  const checks = CHECK_IDS.map((id) => ({ id }))

  test('selects the named checks, all of them by default, and rejects an unknown id', () => {
    expect(selectChecks(checks, []).length).toBe(9)
    expect(selectChecks(checks, ['--only=ids,slugs']).map((c) => c.id)).toEqual(['ids', 'slugs'])
    expect(() => selectChecks(checks, ['--only=nope'])).toThrow('unknown check(s): nope')
  })
})
