import type { Story } from '@ladle/react'

import { abilityPicks, equipmentPicks, pilotContent } from '../livesheet/pilotFixture'
import { type LegacyPilotContent, LiveSheetLegacyPilot } from './LiveSheetLegacyPilot'

/**
 * Legacy/Live Sheet — the "before" capture for the live-sheet reconciliation:
 * a faithful, presentational reproduction of ITUN's CURRENT Pilot live sheet,
 * rebuilt inside component-lib (which cannot import the ITUN app) from the
 * shared `pilotFixture`. The SAME fixture drives `Compositions/Live Sheet`, so
 * the two read as a true before/after. See `docs/design/livesheet-reconciliation.md`.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Live Sheet',
}

/** Shared fixture → the legacy component's content shape. */
const legacyPilot: LegacyPilotContent = {
  callsign: pilotContent.callsign,
  name: pilotContent.name,
  className: pilotContent.className,
  background: pilotContent.background,
  appearance: pilotContent.appearance,
  keepsake: pilotContent.keepsake,
  motto: pilotContent.motto,
  bio: pilotContent.bio,
  hp: pilotContent.hp,
  ap: pilotContent.ap,
  tp: pilotContent.tp,
  // Legacy conditions render an amber (warn) or ink chip; map the shared
  // `state` onto the legacy warn flag so the same conditions show in both.
  conditions: pilotContent.conditions.map((c) => ({ label: c.label, warn: c.state === 'damaged' })),
  linked: pilotContent.linked,
}

const abilities = abilityPicks
const equipment = equipmentPicks.map((e) => ({ entity: e.entity, slots: e.slots }))

/** Desktop poster (wide `@container` → 12-col region grid). */
export const Pilot: Story = () => (
  <LiveSheetLegacyPilot pilot={legacyPilot} abilities={abilities} equipment={equipment} />
)

/** Phone width (~390px) — the `@container` grid collapses to a single column. */
export const PilotMobile: Story = () => (
  <div className="mx-auto w-[390px] overflow-hidden rounded-[6px] border-2 border-ink/30 shadow-lg">
    <LiveSheetLegacyPilot pilot={legacyPilot} abilities={abilities} equipment={equipment} />
  </div>
)
