import type { Story } from '@ladle/react'

import { LiveSheetPoster, type PosterCollectionItem, type PosterField } from './LiveSheetPoster'
import { abilityPicks, equipmentPicks, pilotContent } from './pilotFixture'

/**
 * Compositions/Live Sheet — the pilot live sheet ("Union Poster"), assembled from
 * existing primitives and driven by the shared `pilotFixture`. This is the
 * committed direction (the legacy "before" capture has been removed). Mech +
 * Crawler reuse the same parts. See `docs/design/livesheet-reconciliation.md`.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Live Sheet',
}

/** Self-contained duotone portrait placeholder (data URI — CSP-safe, no network). */
const PORTRAIT = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 192'><rect width='150' height='192' fill='#f2d6c4'/><circle cx='75' cy='76' r='33' fill='#a85222'/><path d='M18 192c0-37 26-56 57-56s57 19 57 56z' fill='#a85222'/></svg>"
)}`

const fields: PosterField[] = [
  // Callsign is a normal grid field beside the image, clamped to one line.
  { label: 'Callsign', value: pilotContent.callsign, clampLines: 1 },
  { label: 'Name', value: pilotContent.name },
  { label: 'Class', value: pilotContent.className },
  // Background / Keepsake / Motto are once-per-downtime pilot resources — a
  // UsedPip sits beside the label (Motto shown already spent).
  { label: 'Background', value: pilotContent.background, usable: true },
  { label: 'Keepsake', value: pilotContent.keepsake, usable: true },
  { label: 'Motto', value: pilotContent.motto, usable: true, used: true },
  // Appearance + Bio span full-width beneath, clamped to 2 lines; Bio expands.
  { label: 'Appearance', value: pilotContent.appearance, fullWidth: true, clampLines: 2 },
  { label: 'Bio', value: pilotContent.bio, fullWidth: true, clampLines: 2, expandable: true },
]

const abilities: PosterCollectionItem[] = abilityPicks.map((a) => ({ entity: a.entity }))
const inventory: PosterCollectionItem[] = equipmentPicks.map((e) => ({ entity: e.entity }))

const pilot = {
  name: pilotContent.callsign,
  kind: 'Pilot',
  imageLabel: 'Portrait',
  fields,
  hp: pilotContent.hp,
  ap: pilotContent.ap,
  tp: pilotContent.tp,
  injuries: pilotContent.injuries,
  abilities,
  inventory,
  linked: pilotContent.linked,
}

/** Read-only (published snapshot) — image seat FILLED. */
export const Pilot: Story = () => <LiveSheetPoster {...pilot} imageSrc={PORTRAIT} readOnly />

/** Editable (live play) — image seat EMPTY (the EmptyState dropzone). */
export const Editable: Story = () => <LiveSheetPoster {...pilot} />

/** Phone width (~390px) — single-column poster order. */
export const Mobile: Story = () => (
  <div className="mx-auto w-[390px] overflow-hidden rounded-panel border-2 border-ink/30 shadow-lg">
    <LiveSheetPoster {...pilot} imageSrc={PORTRAIT} readOnly />
  </div>
)
