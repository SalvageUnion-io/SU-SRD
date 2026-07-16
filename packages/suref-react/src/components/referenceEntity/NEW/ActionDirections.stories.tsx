import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { NEWReferenceEntityCard } from './NEWReferenceEntityCard'
import { ACTION_DIRECTIONS, DRAMATIC_DIRECTIONS } from './ActionDirectionsSpec'
import type { ActionDirection } from './ActionDirectionsSpec'
import { ActionDirectionCard } from './ActionDirectionsVariants'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'NEW/Action Directions',
}

/**
 * Real SRD entity lookup with a first-entry fallback (data drift safety) —
 * throws instead of silently rendering `undefined` if a schema is ever empty.
 */
function pick<T>(list: T[], predicate: (item: T) => boolean, what: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`NEW/Action Directions story: no ${what} loaded`)
  return found
}

// The ONE real action rendered in every direction: the Salvaging Drill's
// "Drill" (Turn Action, 1 EP, Close range, 1 SP damage, Melee) — plus its
// HOST system, which lends the variants its tone family and doubles as the
// reference entity card the treatments must read as siblings of.
const hostSystem = pick(
  SalvageUnionReference.Systems.all(),
  (s) => s.name === 'Salvaging Drill',
  'system'
)
const drillAction = pick(
  SalvageUnionReference.Actions.all(),
  (a) => a.name === 'Drill' && a.actionSource === 'systems',
  'action'
)

function DirectionCell({
  label,
  tell,
  children,
}: {
  label: string
  tell: string
  children: ReactNode
}) {
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <code className="font-mono text-xs text-ink-2">{label}</code>
      <p className="m-0 min-h-12 font-body text-xs italic leading-snug text-ink-2">{tell}</p>
      {/* pt clears the seam stamp, which rides half-above the card frame. */}
      <div className="mt-auto pt-3.5">{children}</div>
    </div>
  )
}

function DirectionCard({ direction }: { direction: ActionDirection }) {
  return (
    <ActionDirectionCard
      action={drillAction}
      host={hostSystem as SURefMetaEntity}
      hostSchema="systems"
      direction={direction}
    />
  )
}

/**
 * All ten action treatments side by side — the SUBTLE set (D1–D6) and the
 * DRAMATIC set (D7–D10) — each labelled with the tell it uses, next to the
 * unchanged ENTITY card (the host Salvaging Drill system, nested-compact) — so
 * "distinct from an entity, but clearly the same card family" is judged in one
 * view. No direction uses the rejected rust band split.
 */
function SectionBand({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full border-ink border-y-2 py-1">
      <code className="font-mono text-ink text-xs">{children}</code>
    </div>
  )
}

export const Directions: Story = () => {
  const subtle = ACTION_DIRECTIONS.filter((s) => !DRAMATIC_DIRECTIONS.has(s.direction))
  const dramatic = ACTION_DIRECTIONS.filter((s) => DRAMATIC_DIRECTIONS.has(s.direction))
  return (
    <div className="grid grid-cols-1 items-stretch gap-x-6 gap-y-8 bg-paper p-4 md:grid-cols-2 xl:grid-cols-3">
      <DirectionCell
        label="REFERENCE · ENTITY CARD"
        tell="Salvaging Drill as a plain nested entity card — the baseline every treatment must sit beside as a sibling."
      >
        <NEWReferenceEntityCard data={hostSystem} size="compact" depth={1} />
      </DirectionCell>
      <SectionBand>SUBTLE · D1–D6 — host tone kept, one small tell added</SectionBand>
      {subtle.map((spec) => (
        <DirectionCell key={spec.direction} label={spec.label} tell={spec.tell}>
          <DirectionCard direction={spec.direction} />
        </DirectionCell>
      ))}
      <SectionBand>DRAMATIC · D7–D10 — bigger colour departure, same four-band shape</SectionBand>
      {dramatic.map((spec) => (
        <DirectionCell key={spec.direction} label={spec.label} tell={spec.tell}>
          <DirectionCard direction={spec.direction} />
        </DirectionCell>
      ))}
    </div>
  )
}

/** One direction isolated beside the reference entity card. */
function SingleDirection({ direction }: { direction: ActionDirection }) {
  const spec = ACTION_DIRECTIONS.find((s) => s.direction === direction)
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 bg-paper p-4 md:grid-cols-2">
      <DirectionCell
        label="REFERENCE · ENTITY CARD"
        tell="Salvaging Drill as a plain nested entity card — the family baseline."
      >
        <NEWReferenceEntityCard data={hostSystem} size="compact" depth={1} />
      </DirectionCell>
      <DirectionCell label={spec?.label ?? direction} tell={spec?.tell ?? ''}>
        <DirectionCard direction={direction} />
      </DirectionCell>
    </div>
  )
}

export const D1GlyphBadge: Story = () => <SingleDirection direction="glyph-badge" />
export const D2CostLed: Story = () => <SingleDirection direction="cost-led" />
export const D3CornerBrackets: Story = () => <SingleDirection direction="corner-bracket" />
export const D4HairlineRule: Story = () => <SingleDirection direction="hairline-rule" />
export const D5SeamStamp: Story = () => <SingleDirection direction="seam-stamp" />
export const D6TexturedBand: Story = () => <SingleDirection direction="textured-band" />

// --- DRAMATIC set (D7–D10) — a bigger colour departure, same four-band shape. ---
export const D7UniqueActionHue: Story = () => <SingleDirection direction="action-colour" />
export const D8GhostedTone: Story = () => <SingleDirection direction="ghosted" />
export const D9LightWash: Story = () => <SingleDirection direction="light-wash" />
export const D10ActionSpine: Story = () => <SingleDirection direction="action-spine" />
