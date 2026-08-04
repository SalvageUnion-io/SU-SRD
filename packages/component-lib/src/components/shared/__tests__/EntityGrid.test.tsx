/**
 * EntityGridRow — the shared entity-card cell + action-economy injector
 * (ported from ITUN's Erow tests when the sheets migrated onto the shared
 * primitive): it folds footMeta into the wrapped card's foot, and card actions
 * ride the card's own controls overlay.
 */

import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EntityGridRow } from '../EntityGrid'

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

describe('EntityGridRow', () => {
  test('injects footMeta into the wrapped card', () => {
    render(
      <EntityGridRow footMeta={[{ label: 'AP Cost', value: 1 }]}>
        <StubCard />
      </EntityGridRow>
    )
    expect(screen.getByText('AP Cost: 1')).toBeTruthy()
  })

  test('renders the card untouched when there is no footMeta', () => {
    render(
      <EntityGridRow>
        <StubCard />
      </EntityGridRow>
    )
    expect(screen.getByText('Card body')).toBeTruthy()
  })
})
