/**
 * createBlank — the Blank escape hatch.
 *
 * Contract per kind: yields a COMMITTED, schema-valid entity (the store's
 * strict Zod parse is the only gate), with and without the optional
 * escape-valve pick.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { CrawlerSchema } from 'itun-domain/schemas/crawler'
import { MechSchema } from 'itun-domain/schemas/mech'
import { PilotSchema } from 'itun-domain/schemas/pilot'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resetStores } from '../../../stores/__tests__/resetStores'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { createBlank } from '../blankCreate'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

beforeEach(resetStores)
afterEach(resetStores)

describe('createBlank — pilot', () => {
  test('without a class pick: persists a schema-valid pilot with empty classRef', async () => {
    const id = await createBlank('pilot', { name: 'Rook Halden', callsign: 'Static' })

    const pilot = useEntityStore.getState().get('pilot', id)
    expect(pilot).toBeTruthy()
    expect(() => PilotSchema.parse(pilot)).not.toThrow()
    expect(pilot?.name).toBe('Rook Halden')
    expect(pilot?.callsign).toBe('Static')
    expect(pilot?.classRef).toBe('')
    expect(pilot?.abilities).toEqual([])
    expect(pilot?.equipment).toEqual([])
    // Seeded at the base HP/AP rule constants, like the wizard path.
    expect(pilot?.currentHP).toBe(10)
    expect(pilot?.currentAP).toBe(5)
  })

  test('with a class pick (unfiltered): persists the chosen classRef', async () => {
    const anyClass = SalvageUnionReference.Classes.all()[0] as { id: string }
    const id = await createBlank('pilot', {
      name: 'Vex Marlo',
      callsign: 'Redline',
      classRef: anyClass.id,
    })

    const pilot = useEntityStore.getState().get('pilot', id)
    expect(() => PilotSchema.parse(pilot)).not.toThrow()
    expect(pilot?.classRef).toBe(anyClass.id)
  })
})

describe('createBlank — mech', () => {
  test('without a chassis pick: persists a schema-valid mech with empty chassisRef', async () => {
    const id = await createBlank('mech', { name: 'Unnamed Hulk' })

    const mech = useEntityStore.getState().get('mech', id)
    expect(mech).toBeTruthy()
    expect(() => MechSchema.parse(mech)).not.toThrow()
    expect(mech?.name).toBe('Unnamed Hulk')
    expect(mech?.chassisRef).toBe('')
    expect(mech?.systems).toEqual([])
    expect(mech?.modules).toEqual([])
    // No chassis → no seeded SP/EP; Heat still starts at 0.
    expect(mech?.currentSP).toBeUndefined()
    expect(mech?.currentEP).toBeUndefined()
    expect(mech?.currentHeat).toBe(0)
  })

  test('with a chassis pick (any TL, no scrap cost): seeds full SP/EP from the chassis', async () => {
    const id = await createBlank('mech', { name: 'Dust Mule', chassisRef: 'mule' })

    const mech = useEntityStore.getState().get('mech', id)
    expect(() => MechSchema.parse(mech)).not.toThrow()
    expect(mech?.chassisRef).toBe('mule')

    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    expect(mech?.currentSP).toBe(mule?.structurePoints)
    expect(mech?.currentEP).toBe(mule?.energyPoints)
    expect(mech?.currentHeat).toBe(0)
  })
})

describe('createBlank — crawler', () => {
  test('defaults to Tech Level 1 with bare stats and the seeded SRD bay set', async () => {
    const id = await createBlank('crawler', { name: 'The Long Haul' })

    const crawler = useEntityStore.getState().get('crawler', id)
    expect(crawler).toBeTruthy()
    expect(() => CrawlerSchema.parse(crawler)).not.toThrow()
    expect(crawler?.name).toBe('The Long Haul')
    expect(crawler?.techLevel).toBe('tech-1')
    // No crawler type is picked in a Blank create.
    expect(crawler?.type).toBeUndefined()
    // Bare SP from crawler-tech-levels.json (TL1 Hamlet = 20).
    expect(crawler?.currentSP).toBe(20)
    // Default (non-expansion) SRD bays are seeded, like the wizard path.
    const baseBays = SalvageUnionReference.CrawlerBays.all().filter(
      (b) => !(b as { expansion?: boolean }).expansion
    )
    expect(crawler?.crawlerBays?.length).toBe(baseBays.length)
  })

  test('honours a Tech Level pick 1–6 and derives that level’s stats', async () => {
    const id = await createBlank('crawler', { name: 'Towertown', techLevel: 3 })

    const crawler = useEntityStore.getState().get('crawler', id)
    expect(() => CrawlerSchema.parse(crawler)).not.toThrow()
    expect(crawler?.techLevel).toBe('tech-3')
    // TL3 Town Crawler = 30 SP per crawler-tech-levels.json.
    expect(crawler?.currentSP).toBe(30)
  })
})
