import { describe, expect, test } from 'bun:test'

describe('suref-react exports', () => {
  test('exports theme system', async () => {
    const { system, suColors, techLevelColors } = await import('../index')
    expect(system).toBeDefined()
    expect(suColors).toBeDefined()
    expect(techLevelColors).toBeDefined()
  })

  test('exports entity display components', async () => {
    const { EntityDisplay, EntityDisplayModal, EntitySelectionModal } = await import('../index')
    expect(EntityDisplay).toBeDefined()
    expect(EntityDisplayModal).toBeDefined()
    expect(EntitySelectionModal).toBeDefined()
  })

  test('exports shared components', async () => {
    const { Card, ValueDisplay, SheetDisplay, RollTable, Modal, StatDisplay } =
      await import('../index')
    expect(Card).toBeDefined()
    expect(ValueDisplay).toBeDefined()
    expect(SheetDisplay).toBeDefined()
    expect(RollTable).toBeDefined()
    expect(Modal).toBeDefined()
    expect(StatDisplay).toBeDefined()
  })

  test('exports utilities', async () => {
    const { nameToSlug, findEntityBySlug, logger } = await import('../index')
    expect(nameToSlug).toBeDefined()
    expect(findEntityBySlug).toBeDefined()
    expect(logger).toBeDefined()
  })

  test('exports constants', async () => {
    const { TECH_LEVELS, DEBOUNCE_TIMINGS, MODAL_SIZES } = await import('../index')
    expect(TECH_LEVELS).toBeDefined()
    expect(DEBOUNCE_TIMINGS).toBeDefined()
    expect(MODAL_SIZES).toBeDefined()
  })
})
