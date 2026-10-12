import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Stat } from './Stat'
import '../../stories/_stories.css'

export default {
  title: 'Atoms/Stat',
}

// Real SRD content drives every anatomy below (reference data is preloaded by
// catalog.tsx before this chunk imports).
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const cargo = chassis?.cargoCapacity ?? 16
const tl = chassis?.techLevel ?? 1

// A real weapon action supplies a real range + trait keyword for the horizontal split-stat.
const weaponAction = SalvageUnionReference.Actions.all()[0]
const rangeLabel = weaponAction?.range?.[0] ?? 'Close'
const traitLabel = weaponAction?.traits?.[0]?.type ?? 'ballistic'

const noop = () => {}

const CELL = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties
const CELL_STAGE = {
  alignItems: 'center',
  display: 'flex',
  minHeight: '52px',
} satisfies CSSProperties
const CELL_CAPTION = { color: color.wkMuted, fontSize: fontSize.badge } satisfies CSSProperties

const GALLERY = {
  backgroundColor: color.paper,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: font.body,
  gap: space[16],
  padding: space[20],
} satisfies CSSProperties
const GALLERY_RULE = {
  color: color.wkMuted,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  maxWidth: '42rem',
} satisfies CSSProperties
const GALLERY_ROW = {
  alignItems: 'flex-start',
  columnGap: space[24],
  display: 'flex',
  flexWrap: 'wrap',
  rowGap: space[20],
} satisfies CSSProperties

/** The ITUN sheet rail's vitals line, as the app styles it (its `<b>` reading
 * is weighted by `.su-story-stat-rail`). */
const RAIL = {
  backgroundColor: color.paper,
  borderInlineStart: `3px solid ${color.ink}`,
  color: `color-mix(in oklab, ${color.ink} 70%, transparent)`,
  fontFamily: font.cond,
  fontSize: '12px',
  fontWeight: weight.semibold,
  letterSpacing: tracking.caps,
  lineHeight: 1.375,
  maxWidth: '28rem',
  paddingBlock: space[8],
  paddingInline: space[10],
  textTransform: 'uppercase',
  width: '100%',
} satisfies CSSProperties

// Each option is captioned with the prop combo that selects it, so the story
// doubles as the prop reference. Every gallery leads with its governing rule.
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={CELL}>
      <div style={CELL_STAGE}>{children}</div>
      <code style={CELL_CAPTION}>{label}</code>
    </div>
  )
}

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div style={GALLERY}>
      <p style={GALLERY_RULE}>{rule}</p>
      <div style={GALLERY_ROW}>{children}</div>
    </div>
  )
}

/** Both anatomies at a glance — one component, picked by `orientation`. */
export const Anatomies: Story = () => (
  <Gallery rule="One component, TWO anatomies — the centred value box (default) and the horizontal [label | value] readout. No pip mode: use VitalGauge for a fill bar.">
    <Cell label="default → box">
      <Stat label="SP" value={sp} />
    </Cell>
    <Cell label='mode="edit" → box + steppers'>
      <Stat label="EP" value={Math.ceil(ep * 0.5)} max={ep} mode="edit" onChange={noop} />
    </Cell>
    <Cell label='orientation="horizontal"'>
      <Stat label="RANGE" value={rangeLabel} orientation="horizontal" />
    </Cell>
    <Cell label='horizontal + mode="edit"'>
      <Stat label="HP" value={7} max={10} orientation="horizontal" mode="edit" onChange={noop} />
    </Cell>
  </Gallery>
)

/** The centred value box (default). A `max` reads as `current /max`; mode="edit" adds steppers. */
export const ValueBox: Story = () => (
  <Gallery rule="The centred value box (default anatomy) — rounded, ink on paper. A max renders as current /max (current prominent, /max muted); a bare value centres. mode='edit' grows the +/- stepper column.">
    <Cell label="read">
      <Stat label="SP" value={sp} />
    </Cell>
    <Cell label="current / max">
      <Stat label="SP" value={Math.ceil(sp * 0.5)} max={sp} />
    </Cell>
    <Cell label='size="full"'>
      <Stat label="SP" value={sp} max={sp} size="full" />
    </Cell>
    <Cell label='size="mini"'>
      <Stat label="SP" value={sp} size="mini" />
    </Cell>
    <Cell label="disabled">
      <Stat label="SP" value={sp} disabled />
    </Cell>
    <Cell label="inverse">
      <Stat label="SP" value={sp} inverse />
    </Cell>
    <Cell label="onClick + bottomLabel">
      <Stat label="SP" value={sp} onClick={noop} bottomLabel="MAX" />
    </Cell>
    <Cell label="hoverText">
      <Stat label="SP" value={sp} hoverText="Structure Points: the mech's health" />
    </Cell>
    <Cell label='mode="edit"'>
      <Stat
        label="EP"
        value={Math.ceil(ep * 0.5)}
        max={ep}
        mode="edit"
        onChange={noop}
        bottomLabel="MAX"
      />
    </Cell>
  </Gallery>
)

/** State lives in the border — the ONLY thing that changes between states. */
export const States: Story = () => (
  <Gallery rule="State is carried entirely by the border via the `state` prop; fill, value and stamp stay constant. Default = ink · good (full/at-cap) = mech · modified = heavier solid ink frame (border plus a 1px ink ring) · caution = status-warn · critical = status-bad. Which value maps to which state is the consumer's call.">
    <Cell label="default">
      <Stat label="SP" value={Math.ceil(sp * 0.5)} max={sp} />
    </Cell>
    <Cell label='state="good"'>
      <Stat label="SP" value={sp} max={sp} state="good" />
    </Cell>
    <Cell label='state="modified"'>
      <Stat label="TL" value={2} state="modified" />
    </Cell>
    <Cell label='state="caution"'>
      <Stat label="Heat" value={heat - 1} max={heat} state="caution" />
    </Cell>
    <Cell label='state="critical"'>
      <Stat label="Heat" value={heat} max={heat} state="critical" />
    </Cell>
    <Cell label="compact · critical">
      <Stat label="Heat" value={heat} max={heat} orientation="horizontal" state="critical" />
    </Cell>
  </Gallery>
)

/** The [label | value] readout — a Stat, never a badge (Tech level, Range, traits). */
export const Horizontal: Story = () => (
  <Gallery rule="orientation='horizontal' → the rounded [label | value] cell. Ink on paper, a max reads as value /max, state rides the border. With mode='edit' it grows a compact +/- stepper column.">
    <Cell label="range">
      <Stat label="RANGE" value={rangeLabel} orientation="horizontal" />
    </Cell>
    <Cell label="tech level">
      <Stat label="TL" value={tl} orientation="horizontal" />
    </Cell>
    <Cell label="value / max">
      <Stat label="Heat" value={heat} max={heat} orientation="horizontal" />
    </Cell>
    <Cell label="inverse">
      <Stat label="TRAIT" value={traitLabel} orientation="horizontal" inverse />
    </Cell>
    <Cell label='size="compact"'>
      <Stat label="TL" value={tl} orientation="horizontal" size="compact" />
    </Cell>
    <Cell label='size="mini"'>
      <Stat label="TL" value={tl} orientation="horizontal" size="mini" />
    </Cell>
    <Cell label='mode="edit" → + steppers'>
      <Stat label="HP" value={7} max={10} orientation="horizontal" mode="edit" onChange={noop} />
    </Cell>
    <Cell label='surface="plain" → running text'>
      <Stat
        label="Heat"
        value={Math.ceil(heat * 0.5)}
        max={heat}
        orientation="horizontal"
        surface="plain"
      />
    </Cell>
  </Gallery>
)

/**
 * The horizontal cell's PLAIN material — running text, for stats printed inside
 * a sentence rather than on a plate. This is the ITUN sheet rail's vitals body,
 * rendered exactly as the app renders it: the ` · ` join and any trailing word
 * ("Intact") belong to the LINE and stay at the call site, because neither is a
 * property of a stat.
 */
export const PlainMaterial: Story = () => (
  <Gallery rule="surface='plain' → the same [label | value] geometry with no plate, no border and no radius. The label inherits the line's colour; the reading (value AND /max) is one bold <b>, so a text container can weight it. It absorbed StatLine, which argued running text was a different job — it is the same cell in a different material.">
    <div className="su-story-stat-rail" style={RAIL}>
      <Stat
        orientation="horizontal"
        surface="plain"
        label="SP"
        value={Math.ceil(sp * 0.7)}
        max={sp}
      />
      {' · '}
      <Stat
        orientation="horizontal"
        surface="plain"
        label="EP"
        value={Math.ceil(ep * 0.5)}
        max={ep}
      />
      {' · '}
      <Stat
        orientation="horizontal"
        surface="plain"
        label="Heat"
        value={Math.ceil(heat * 0.4)}
        max={heat}
      />
    </div>
    <div className="su-story-stat-rail" style={RAIL}>
      <Stat
        orientation="horizontal"
        surface="plain"
        label="SP"
        value={Math.ceil(sp * 0.7)}
        max={sp}
      />
      {' · '}
      <Stat orientation="horizontal" surface="plain" label="Bays" value={4} max={5} /> Intact
    </div>
  </Gallery>
)

/** How a full mech's stats read as a compact header cluster — always TWO rows,
 *  columns = ceil(count/2). Eight stats → 2 rows of 4 (the top-right axis on a
 *  compact/nested card). Driven by the real chassis fixture. */
export const CompactHeaderCluster: Story = () => (
  <Gallery rule="A full mech's stats as the compact header cluster — always TWO rows, columns = ceil(count/2). Eight stats → 2 rows of 4 (the top-right axis on a compact/nested card).">
    <div
      style={{
        display: 'grid',
        gap: space[4],
        gridTemplateColumns: 'repeat(4, max-content)',
        justifyItems: 'end',
        width: 'fit-content',
      }}
    >
      <Stat orientation="horizontal" label="TL" value={tl} size="compact" />
      <Stat orientation="horizontal" label="SP" value={sp} size="compact" />
      <Stat orientation="horizontal" label="EP" value={ep} size="compact" />
      <Stat orientation="horizontal" label="SV" value={chassis?.salvageValue ?? 2} size="compact" />
      <Stat orientation="horizontal" label="Sys" value={chassis?.systemSlots ?? 7} size="compact" />
      <Stat orientation="horizontal" label="Mod" value={chassis?.moduleSlots ?? 2} size="compact" />
      <Stat orientation="horizontal" label="Cargo" value={cargo} size="compact" />
      <Stat orientation="horizontal" label="Heat" value={heat} size="compact" />
    </div>
  </Gallery>
)
