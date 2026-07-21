/**
 * EntityGrid / EntityGridRow — the shared entity-card grid + action-economy
 * injector (ported from ITUN's Ecflow/Erow tests when the sheets migrated
 * onto the shared primitive):
 * - EntityGridRow mode 'card' folds footMeta into the wrapped card's foot
 *   (card actions ride the card's own controls overlay)
 * - EntityGrid caps the grid at 2 columns on desktop, 1 on mobile
 * - EntityGridRow mode 'rail' renders the 152px side callout with meta + actions
 */

import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EntityGrid, EntityGridRow } from '../EntityGrid'

type StubCardProps = {
  footMeta?: Array<{ label: string; value: ReactNode }>
}

// biome-ignore lint/style/useComponentExportOnlyModules: test-local stub component; Fast Refresh does not apply to test files
function StubCard({ footMeta }: StubCardProps) {
  return (
    <div>
      <span>Card body</span>
      {footMeta?.map((m) => (
        <span key={m.label}>
          {m.label}: {m.value}
        </span>
      ))}
    </div>
  )
}

describe('EntityGridRow — mode card (default)', () => {
  afterEach(cleanup)

  test('injects footMeta into the wrapped card', () => {
    render(
      <EntityGrid>
        <EntityGridRow footMeta={[{ label: 'AP Cost', value: 1 }]}>
          <StubCard />
        </EntityGridRow>
      </EntityGrid>
    )
    expect(screen.getByText('AP Cost: 1')).toBeTruthy()
  })

  test('EntityGrid caps the entity-card grid at 2 columns on desktop, 1 on mobile', () => {
    // Poster rule: max 2 columns for any entity-card grid.
    const { container } = render(
      <EntityGrid>
        <EntityGridRow>
          <StubCard />
        </EntityGridRow>
      </EntityGrid>
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('md:grid-cols-2')
  })
})

describe('EntityGridRow — mode rail', () => {
  afterEach(cleanup)

  test('renders the side callout with meta and actions beside the card', () => {
    render(
      <EntityGridRow
        mode="rail"
        actions={<button type="button">Repair</button>}
        footMeta={[{ label: 'Slots', value: 2 }]}
      >
        <StubCard />
      </EntityGridRow>
    )
    expect(screen.getByText('Card body')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Repair' })).toBeTruthy()
    expect(screen.getByText('Slots')).toBeTruthy()
  })
})
