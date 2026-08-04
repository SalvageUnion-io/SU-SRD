/**
 * EntityTooltip addressing — `entityId` vs `entityName`.
 *
 * The name→id lookup here was absorbed from `ContextualEntityDisplay`, a thin
 * wrapper whose only real content was this resolution plus a bare-children
 * fallback EntityTooltip already had.
 *
 * Its old ITUN test could not simply move: it verified the wrapper by MOCKING
 * component-lib's EntityTooltip and asserting on the id forwarded to the mock.
 * With the logic now inside EntityTooltip that strategy would mock the unit
 * under test. These tests assert on observable output instead — no mocking, and
 * a stronger guarantee, since they exercise the real resolution against real
 * SRD data.
 *
 * The discriminator: a RESOLVED entity renders its children inside Base UI's
 * tooltip trigger, marked `data-base-ui-tooltip-trigger`; an UNRESOLVED one
 * renders the children bare. So "did the address resolve" is directly
 * observable.
 *
 * Note it is NOT `role="button"`, even though the source passes that to the
 * trigger's `render` element — Base UI drops it and emits its own data
 * attribute. Asserting on the source's intent rather than the rendered output
 * would have made these tests fail against working code.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InsideTooltipContext } from '../../ui/insideTooltipContext'
import { EntityTooltip } from '../EntityTooltip'

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'systems', 'classes'])
})

const firstChassis = () => {
  const c = SalvageUnionReference.Chassis.all()[0]
  if (!c) throw new Error('no chassis fixture')
  return c
}

describe('EntityTooltip addressing', () => {
  test('resolves by entityId and wraps the children in a trigger', () => {
    const chassis = firstChassis()
    const { container } = render(
      <EntityTooltip schemaName="chassis" entityId={chassis.id}>
        <span>trigger</span>
      </EntityTooltip>
    )
    expect(screen.getByText('trigger')).toBeTruthy()
    expect(container.querySelector('[data-base-ui-tooltip-trigger]')).toBeTruthy()
  })

  test('resolves by entityName — the builders key chassis/systems by name', () => {
    const chassis = firstChassis()
    const { container } = render(
      <EntityTooltip schemaName="chassis" entityName={chassis.name}>
        <span>trigger</span>
      </EntityTooltip>
    )
    expect(screen.getByText('trigger')).toBeTruthy()
    // Resolved: the trigger wrapper is present.
    expect(container.querySelector('[data-base-ui-tooltip-trigger]')).toBeTruthy()
  })

  test('an unresolvable name renders the children bare, never swallowing them', () => {
    const { container } = render(
      <EntityTooltip schemaName="chassis" entityName="__nonexistent_chassis__">
        <span>trigger</span>
      </EntityTooltip>
    )
    // The caller's content survives...
    expect(screen.getByText('trigger')).toBeTruthy()
    // ...but there is no tooltip trigger, because nothing resolved.
    expect(container.querySelector('[data-base-ui-tooltip-trigger]')).toBeNull()
  })

  test('an unresolvable id renders the children bare too', () => {
    const { container } = render(
      <EntityTooltip schemaName="chassis" entityId="__nonexistent_id__">
        <span>trigger</span>
      </EntityTooltip>
    )
    expect(screen.getByText('trigger')).toBeTruthy()
    expect(container.querySelector('[data-base-ui-tooltip-trigger]')).toBeNull()
  })

  test('inside another tooltip popup it is TERMINAL — children bare, no nested trigger', () => {
    // Ruleset §1 Tooltip context law: no nested tooltips, ever. A resolvable
    // entity ref inside a hovercard must not arm a second hovercard.
    const chassis = firstChassis()
    const { container } = render(
      <InsideTooltipContext.Provider value={true}>
        <EntityTooltip schemaName="chassis" entityId={chassis.id}>
          <span>trigger</span>
        </EntityTooltip>
      </InsideTooltipContext.Provider>
    )
    expect(screen.getByText('trigger')).toBeTruthy()
    expect(container.querySelector('[data-base-ui-tooltip-trigger]')).toBeNull()
  })
})
