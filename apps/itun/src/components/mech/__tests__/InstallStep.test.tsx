/**
 * Unit tests for InstallStep's tech-tier filter-chip row (Badge `shape="chip"`).
 *
 * Focus: the Bio (B) and Nanite (N) chips are reachable and actually filter the
 * catalog down to their non-numeric tier — the behaviour added alongside the
 * numeric TL1–6 chips. Renders against real SalvageUnionReference data; the
 * step reads the ORM directly (no entityStore), so no DB scaffolding is needed.
 *
 * SalvageUnionReference is preloaded via bunfig.toml.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { TechLevel } from '../../../lib/rules/types'
import { InstallStep } from '../InstallStep'

afterEach(() => {
  cleanup()
})

/** First entity of `kind` at exactly the given tech level, from real data. */
function firstAtTL(kind: 'systems' | 'modules', tl: TechLevel): { id: string; name: string } {
  const accessor =
    kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules
  const found = accessor.all().find((s) => s.techLevel === tl)
  if (!found) throw new Error(`No ${kind} at tech level ${String(tl)} in reference data`)
  return found
}

function renderStep(kind: 'systems' | 'modules') {
  return render(<InstallStep kind={kind} selected={[]} onAdd={() => {}} />)
}

// Each catalog cell is an InstallCard whose add affordance is a Button with
// aria-label `Add {name}` — so an item is present iff its Add button renders.
const addBtn = (name: string) => ({ name: `Add ${name}` })

describe('InstallStep — Bio/Nanite tech-tier filter', () => {
  it('renders the Bio and Nanite chips alongside the numeric tiers', () => {
    renderStep('systems')
    expect(screen.getByRole('button', { name: 'Bio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nanite' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'TL1' })).toBeTruthy()
  })

  it('the Bio chip narrows the systems catalog to Bio-tier systems', () => {
    const bio = firstAtTL('systems', 'B')
    const numeric = firstAtTL('systems', 1)
    renderStep('systems')

    // Unfiltered: both a Bio system and a numeric-TL system are reachable.
    expect(screen.getByRole('button', addBtn(bio.name))).toBeTruthy()
    expect(screen.getByRole('button', addBtn(numeric.name))).toBeTruthy()

    // Activate the Bio filter — only Bio-tier systems remain.
    fireEvent.click(screen.getByRole('button', { name: 'Bio' }))
    expect(screen.getByRole('button', addBtn(bio.name))).toBeTruthy()
    expect(screen.queryByRole('button', addBtn(numeric.name))).toBeNull()
  })

  it('the Nanite chip narrows the modules catalog to Nanite-tier modules', () => {
    const nanite = firstAtTL('modules', 'N')
    const numeric = firstAtTL('modules', 1)
    renderStep('modules')

    fireEvent.click(screen.getByRole('button', { name: 'Nanite' }))
    expect(screen.getByRole('button', addBtn(nanite.name))).toBeTruthy()
    expect(screen.queryByRole('button', addBtn(numeric.name))).toBeNull()
  })
})
