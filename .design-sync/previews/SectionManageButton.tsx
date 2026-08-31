/*
 * No story file — `SectionManageButton` is demonstrated through the sheet
 * sections it sits in. Composed from its props contract and that call site.
 */
import { SectionManageButton, SheetSectionSlab } from 'component-lib'
import type { CSSProperties } from 'react'
import { Caption, Row } from '../preview-lib/harness'

const MECH_TONE = {
  '--tone': 'var(--color-mech)',
  '--tone-deep': 'var(--color-mech-dark)',
} as CSSProperties

/**
 * The section's add affordance. `label` names what gets added and exists for the
 * accessible label — "ability", "system" — so the control announces its target
 * rather than just "add".
 */
export function Labels() {
  return (
    <div className="bg-paper p-4">
      <Caption>one per manageable section</Caption>
      <Row>
        <SectionManageButton label="ability" onClick={() => {}} />
        <SectionManageButton label="system" onClick={() => {}} />
        <SectionManageButton label="equipment" onClick={() => {}} />
      </Row>
    </div>
  )
}

/** In its real slot — a sheet section's controls. */
export function InSection() {
  return (
    <div className="flex flex-col gap-3 bg-paper p-4" style={MECH_TONE}>
      <Caption>a section leader's control</Caption>
      <SheetSectionSlab
        title="Systems"
        count="2/6 slots"
        controls={<SectionManageButton label="system" onClick={() => {}} />}
      >
        <p className="font-body text-caption text-wk-muted">
          The section body — cards would render here.
        </p>
      </SheetSectionSlab>
    </div>
  )
}
