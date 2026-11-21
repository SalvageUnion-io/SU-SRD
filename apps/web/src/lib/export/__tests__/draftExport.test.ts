/** A signed-out build kept as a file is a bundle Import reads back (r2 D3). */

import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EMPTY_MECH_FORM_STATE, mechFormToCreateInput } from '../../wizard/mechFormState'
import { EMPTY_PILOT_FORM_STATE, pilotFormToCreateInput } from '../../wizard/pilotFormState'
import { draftExportBundle } from '../draftExport'
import { parseImportBundle } from '../parseImportBundle'

describe('draftExportBundle', () => {
  test('a wizard pilot round-trips through the import parser', () => {
    const hacker = SalvageUnionReference.Classes.getByName('Hacker')
    const input = pilotFormToCreateInput({
      ...EMPTY_PILOT_FORM_STATE,
      name: 'Ada Test',
      callsign: 'Ghost',
      classId: hacker?.id ?? '',
    })
    const bundle = draftExportBundle('pilot', input, '2026-11-21T00:00:00.000Z', 'draft-1')
    const read = parseImportBundle(JSON.stringify(bundle))
    expect(read.entities.pilots).toHaveLength(1)
    expect(read.entities.pilots[0]).toMatchObject({ id: 'draft-1', name: 'Ada Test' })
    expect(read.entities.mechs).toEqual([])
  })

  test('a wizard mech lands under mechs', () => {
    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Bullseye',
      chassisName: 'mule',
    })
    const read = parseImportBundle(
      JSON.stringify(draftExportBundle('mech', input, '2026-11-21T00:00:00.000Z', 'draft-2'))
    )
    expect(read.entities.mechs[0]).toMatchObject({ id: 'draft-2', chassisRef: 'mule' })
    expect(read.entities.pilots).toEqual([])
  })
})
