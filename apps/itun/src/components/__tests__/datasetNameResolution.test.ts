import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { TABLE_CATEGORY_LABEL, TABLE_CATEGORY_ORDER } from '../dashboard/tableCategories'
import { MECH_ROLL_TABLE_NAMES } from '../wizard/mechRollTables'
import { PILOT_ROLL_TABLE_NAMES } from '../wizard/rollTableHelpers'

/**
 * Registries in this package bind code to a dataset entity's `name` — the most
 * editable field in the data, and the one the repo's own convention says links
 * should never use ("entity links must use slugs, never UUIDs" exists for the
 * same reason).
 *
 * Nothing checked that any of them resolved. A rename in `data/roll-tables.json`
 * passes every existing validator — ids stay unique, references still resolve,
 * schemas still match — and then silently empties a wizard's Roll button. No
 * error is thrown anywhere: the lookup returns `undefined` and the surface
 * renders without the control.
 *
 * These tests assert the one property that matters: every name a registry
 * hard-codes still resolves to a real entity. They are deliberately NOT
 * assertions about the literal strings — comparing a map to its own literal
 * (which is what the Mediator table test used to do on its own) passes for any
 * pair of strings and never touches the dataset.
 */
describe('hard-coded dataset names resolve', () => {
  test('the dataset is actually loaded (guards a vacuous pass)', () => {
    // Without this, every case below would "pass" against an empty ORM.
    expect(SalvageUnionReference.RollTables.all().length).toBeGreaterThan(0)
  })

  test('pilot wizard roll tables', () => {
    for (const [field, name] of Object.entries(PILOT_ROLL_TABLE_NAMES)) {
      expect(
        SalvageUnionReference.RollTables.getByName(name),
        `PILOT_ROLL_TABLE_NAMES.${field} = "${name}" resolves no roll table — the ` +
          "pilot wizard's Roll button for this field would render dead"
      ).toBeDefined()
    }
  })

  test('mech wizard roll tables', () => {
    for (const [field, name] of Object.entries(MECH_ROLL_TABLE_NAMES)) {
      expect(
        SalvageUnionReference.RollTables.getByName(name),
        `MECH_ROLL_TABLE_NAMES.${field} = "${name}" resolves no roll table — the ` +
          "mech wizard's Roll button for this field would render dead"
      ).toBeDefined()
    }
  })

  test('every table category has a label', () => {
    // Not a dataset lookup, but the same class of silent gap: a category in the
    // order list with no label renders an unnamed section.
    for (const category of TABLE_CATEGORY_ORDER) {
      expect(TABLE_CATEGORY_LABEL[category], `no label for category "${category}"`).toBeTruthy()
    }
  })
})
