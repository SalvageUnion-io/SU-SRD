import type { SheetKind } from 'game-domain/entityKinds'
import type { LucideIcon } from 'lucide-react'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import { Badge } from '../index'

/**
 * EmptyUnitSlot — a dashed placeholder for an unfilled assignment (a pilot
 * with no assigned mech, a crawler's next crew place): its role stamp on the
 * slot kind's tone band, a helper message, and the create / assign CTAs
 * across a dashed foot. It is a slot, not an entity, so it is no Row: a
 * filled slot is the library Row (`UnitRow`).
 */

type SlotKind = SheetKind

type EmptyUnitSlotProps = {
  kind: SlotKind
  /** The role stamp, e.g. 'Assigned Mech'. */
  roleLabel: string
  /** Helper message, e.g. 'No mech in the bay — dock one to track it here.' */
  message: ReactNode
  /** Optional inline control (a hand-set Crawler Level stepper). */
  mock?: ReactNode
  /** Optional create/link CTAs, stretched across the dashed foot. */
  actions?: ReactNode
  className?: string
}

/**
 * Per-kind tone (the `--color-sheet-*` tokens): `band` is the stamp band's
 * fill, `ink` the text legible on it. Crawler pink carries neither ink nor
 * paper at 4.5 : 1, so its band is the deeper `--color-crawler-band` (§3.8).
 */
const TONE: Record<SlotKind, { band: string; ink: string }> = {
  pilot: { band: 'var(--color-sheet-pilot)', ink: 'var(--color-ink)' },
  mech: { band: 'var(--color-sheet-mech)', ink: 'var(--color-ink)' },
  crawler: { band: 'var(--color-crawler-band)', ink: 'var(--color-paper)' },
}

/** Per-kind "missing entity" glyph (decorative). */
const EMPTY_GLYPH: Record<SlotKind, LucideIcon> = {
  pilot: UserRound,
  mech: Bot,
  crawler: Warehouse,
}

const EMPTY_ROW = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'dashed',
  borderWidth: borderWidth.entity,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
} satisfies CSSProperties

const EMPTY_BAND = {
  alignItems: 'center',
  display: 'flex',
  paddingBlock: space[6],
  paddingInline: space[10],
} satisfies CSSProperties

const EMPTY_BODY = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[12],
  paddingBlock: space[8],
  paddingInline: space[10],
} satisfies CSSProperties

const EMPTY_GLYPH_BOX = {
  flexShrink: 0,
  height: space[24],
  width: space[24],
} satisfies CSSProperties

const EMPTY_MESSAGE = {
  color: color.ink,
  flex: 1,
  fontFamily: font.body,
  fontSize: fontSize.note,
  // The snug leading.
  lineHeight: 1.375,
  margin: 0,
  minWidth: '140px',
} satisfies CSSProperties

/** The dashed foot: only its top edge is drawn, so the other three widths are 0. */
const EMPTY_FOOT = {
  alignItems: 'stretch',
  borderColor: color.ink,
  borderStyle: 'dashed',
  borderWidth: `${borderWidth.pill} 0 0`,
  display: 'flex',
  gap: space[8],
  marginTop: 'auto',
  paddingBlock: space[6],
  paddingInline: space[10],
} satisfies CSSProperties

export function EmptyUnitSlot({
  kind,
  roleLabel,
  message,
  mock,
  actions,
  className,
}: EmptyUnitSlotProps) {
  const tone = TONE[kind]
  const EmptyGlyph = EMPTY_GLYPH[kind]
  return (
    <div className={className} style={EMPTY_ROW}>
      {/* The role stamp rides the kind's tone band: an empty slot is still a
          slot for a KIND of thing. The dashed frame is what marks it empty. */}
      <div style={{ ...EMPTY_BAND, background: tone.band, color: tone.ink }}>
        <Badge shape="stamp" size="compact">
          {roleLabel}
        </Badge>
      </div>
      <div style={EMPTY_BODY}>
        <EmptyGlyph aria-hidden="true" style={{ ...EMPTY_GLYPH_BOX, color: tone.band }} />
        {mock}
        <p style={EMPTY_MESSAGE}>{message}</p>
      </div>
      {actions && (
        <div className="su-empty-unit-slot__actions" style={EMPTY_FOOT}>
          {actions}
        </div>
      )}
    </div>
  )
}
