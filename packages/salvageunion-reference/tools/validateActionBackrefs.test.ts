import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  findMissingActionBackrefs,
  type ActionLike,
  type EntityLike,
} from './validateActionBackrefsLogic.js'

describe('findMissingActionBackrefs', () => {
  it('passes when the namesake entity references its action', () => {
    const actions: ActionLike[] = [
      { name: 'Bionic Arms', actionType: 'Passive', actionSource: 'abilities' },
    ]
    const entitiesBySource: Record<string, EntityLike[]> = {
      abilities: [{ name: 'Bionic Arms', actions: ['Bionic Arms Attack', 'Bionic Arms'] }],
    }
    expect(findMissingActionBackrefs(actions, entitiesBySource)).toEqual([])
  })

  it('flags a namesake action the source entity does not reference', () => {
    const actions: ActionLike[] = [
      { name: 'Bionic Arms', actionType: 'Passive', actionSource: 'abilities' },
    ]
    const entitiesBySource: Record<string, EntityLike[]> = {
      // The ability grants only the attack, missing its own passive (the bug).
      abilities: [{ name: 'Bionic Arms', actions: ['Bionic Arms Attack'] }],
    }
    expect(findMissingActionBackrefs(actions, entitiesBySource)).toEqual([
      { source: 'abilities', actionName: 'Bionic Arms', actionType: 'Passive' },
    ])
  })

  it('does not apply when no same-source entity shares the action name', () => {
    const actions: ActionLike[] = [
      // Granted by the "Bionic Arms" ability under a different name — out of scope.
      { name: 'Bionic Arms Attack', actionType: 'Turn', actionSource: 'abilities' },
    ]
    const entitiesBySource: Record<string, EntityLike[]> = {
      abilities: [{ name: 'Bionic Arms', actions: ['Bionic Arms Attack'] }],
    }
    expect(findMissingActionBackrefs(actions, entitiesBySource)).toEqual([])
  })

  it('accepts a reference made via displayName', () => {
    const actions: ActionLike[] = [
      { name: 'Bite', displayName: 'Bite (Bio-Maw)', actionSource: 'systems' },
    ]
    const entitiesBySource: Record<string, EntityLike[]> = {
      systems: [{ name: 'Bite', actions: ['Bite (Bio-Maw)'] }],
    }
    expect(findMissingActionBackrefs(actions, entitiesBySource)).toEqual([])
  })

  it('reports each unreferenced (source, name) pair once even with duplicate-named actions', () => {
    const actions: ActionLike[] = [
      { name: 'Overload', actionType: 'Turn', actionSource: 'systems' },
      { name: 'Overload', actionType: 'Passive', actionSource: 'systems' },
    ]
    const entitiesBySource: Record<string, EntityLike[]> = {
      systems: [{ name: 'Overload', actions: [] }],
    }
    expect(findMissingActionBackrefs(actions, entitiesBySource)).toEqual([
      { source: 'systems', actionName: 'Overload', actionType: 'Turn' },
    ])
  })

  it('ignores actions whose actionSource file was not supplied', () => {
    const actions: ActionLike[] = [{ name: 'Ghost', actionSource: 'unknown-source' }]
    expect(findMissingActionBackrefs(actions, {})).toEqual([])
  })
})

describe('real dataset invariant', () => {
  // The convention must hold 100% in the committed data — the same guarantee the
  // validate:action-backrefs CLI enforces at merge time, asserted here so a bad
  // edit fails `bun test` too.
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
  const load = (f: string) => JSON.parse(readFileSync(join(dataDir, `${f}.json`), 'utf-8'))
  const SOURCES = [
    'abilities',
    'systems',
    'modules',
    'equipment',
    'chassis',
    'bio-titans',
    'crawlers',
    'creatures',
    'meld',
    'npcs',
    'squads',
    'vehicles',
    'drones',
  ]

  it('every namesake action is referenced by its source entity', () => {
    const actions = load('actions') as ActionLike[]
    const entitiesBySource: Record<string, EntityLike[]> = {}
    for (const s of SOURCES) entitiesBySource[s] = load(s) as EntityLike[]
    expect(findMissingActionBackrefs(actions, entitiesBySource)).toEqual([])
  })
})
