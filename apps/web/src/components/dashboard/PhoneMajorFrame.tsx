/**
 * PhoneMajorFrame — a `MajorModel` drawn as the phone form's one column
 * (ADR-045, board D4). `MajorFrame` hands the model here when the Dashboard is
 * in its phone form (`dashboardForm.model.ts`); the model, its handlers and its
 * rules are the canvas's own.
 *
 * Top to bottom: the main bays in model order, then what the phone puts
 * between (the deck on the Major's tab, Downtime's guide on the Crawler's),
 * then the side bays (Effects and Egress, Upkeep, Upgrade, Scrap), which are
 * the rarely used column (ADR-038 §3). In a bay:
 *
 *  - a gauge with a redline (`danger`, the mech's Heat) is the `track`
 *    gauge, with a line saying where the redline starts;
 *  - every other gauge is a `numeral` cell, two to a row;
 *  - a bay of nothing but numeral cells draws no frame (the SP | EP pair);
 *  - a card bay (`card`, the Mech's Chassis Ability) is the card alone;
 *  - buttons sit two to a row, each at least 44px tall; a `wide` one spans
 *    both.
 *
 * A Major's prompt (Take Damage, the cargo hold, the Board menu, a meltdown)
 * covers the whole column, keeping the gauges it pins (`BandOverlay.gauges`).
 * The bays stay mounted under it, hidden and inert, so the button that opened
 * it is still there to take focus back when it closes (`MajorFrame`).
 *
 * Materials (ruleset §1): the column is the chassis (`--color-band-cream`,
 * drawn by the tab body around it) and every cell and bay is paper.
 * Style objects only; the 44px floor and the focus rings come from
 * `.su-dash-phone` (`styles/dashboard/DashboardPhone.css`).
 */

import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useEffect, useRef } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { Badge, Button, Entity, StatusBadge } from '../index'
import { BandStats } from './BandStats'
import { DashboardGauge } from './DashboardGauge'
import { DAMAGED } from './damaged.model'
import type { BandBay, BandButton, BandGauge, BandOverlay, MajorModel } from './MajorFrame'

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  minWidth: 0,
} satisfies CSSProperties

const STAMP_ROW = { display: 'flex', justifyContent: 'flex-end' } satisfies CSSProperties

const STAMP = { fontSize: fontSize.badge } satisfies CSSProperties

const BAY = {
  display: 'flex',
  minInlineSize: 0,
  margin: 0,
  flexDirection: 'column',
  gap: space[10],
  minWidth: 0,
  padding: space[12],
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.badge,
} satisfies CSSProperties

const LABEL = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink75,
} satisfies CSSProperties

const CELLS = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space[8],
} satisfies CSSProperties

const LINE = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.4,
  color: color.ink,
} satisfies CSSProperties

const WARN = {
  ...LINE,
  color: color.statusBad,
  fontWeight: weight.semibold,
} satisfies CSSProperties

const CHIPS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[6],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const CHIP = {
  padding: `${space[2]} ${space[10]}`,
  border: `${borderWidth.chrome} solid ${color.ink30}`,
  borderRadius: radius.full,
  background: color.paper,
  fontFamily: font.cond,
  fontWeight: weight.semibold,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const BUTTONS = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space[8],
} satisfies CSSProperties

const BUTTON = { width: '100%', minHeight: '44px' } satisfies CSSProperties

const OVERLAY = {
  ...BAY,
  gap: space[12],
  scrollMarginTop: '120px',
} satisfies CSSProperties

const OVERLAY_HEAD = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
} satisfies CSSProperties

const OVERLAY_TITLE = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const ACTIONS = { display: 'flex', flexDirection: 'column', gap: space[8] } satisfies CSSProperties

/** The bays while a prompt covers them. */
const COVERED = { display: 'none' } satisfies CSSProperties

function variantOf(btn: BandButton): 'danger' | 'primary' | 'default' {
  return btn.variant === 'danger' ? 'danger' : btn.variant === 'go' ? 'primary' : 'default'
}

function PhoneButton({ btn }: { btn: BandButton }) {
  return (
    <Button
      variant={variantOf(btn)}
      size="full"
      style={btn.wide ? { ...BUTTON, gridColumn: 'span 2' } : BUTTON}
      onClick={btn.onClick}
      disabled={btn.disabled}
      title={btn.title}
    >
      {btn.label}
    </Button>
  )
}

/** The pools as numeral cells, two to a row. */
function Cells({ gauges }: { gauges: BandGauge[] }) {
  return (
    <div style={CELLS}>
      {gauges.map((g) => (
        <DashboardGauge
          key={g.label}
          variant="numeral"
          label={g.label}
          value={g.value}
          max={g.max}
          tone={g.tone}
        />
      ))}
    </div>
  )
}

/** A redlined gauge: the full track, and where its redline starts. */
function Track({ gauge }: { gauge: BandGauge }) {
  return (
    <>
      <DashboardGauge
        variant="track"
        label={gauge.label}
        value={gauge.value}
        max={gauge.max}
        tone={gauge.tone}
        danger={gauge.danger}
        provenance={gauge.provenance}
        breakdown={gauge.breakdown}
      />
      {gauge.danger !== undefined && (
        <p style={LINE}>Redline from {Math.min(gauge.danger + 1, gauge.max)}.</p>
      )}
    </>
  )
}

/** A bay with nothing but pools to read: drawn as bare cells, no frame. */
function cellsOnly(bay: BandBay): boolean {
  return (
    bay.buttons.length === 0 &&
    !bay.stats?.length &&
    !bay.lines?.length &&
    !bay.chips?.length &&
    bay.control === undefined &&
    (bay.gauges ?? []).every((g) => g.danger === undefined)
  )
}

function PhoneBay({ bay }: { bay: BandBay }) {
  // A card bay is the card alone: it carries its own frame (board D4).
  if (bay.card !== undefined) return bay.card
  const gauges = bay.gauges ?? []
  if (gauges.length > 0 && cellsOnly(bay)) return <Cells gauges={gauges} />
  const cells = gauges.filter((g) => g.danger === undefined)
  const tracks = gauges.filter((g) => g.danger !== undefined)
  return (
    <fieldset aria-label={bay.label} style={BAY}>
      {/* A bay that leads with a gauge is named by it (HEAT, HP). */}
      {gauges.length === 0 && <p style={LABEL}>{bay.label}</p>}
      {cells.length > 0 && <Cells gauges={cells} />}
      {tracks.map((g) => (
        <Track key={g.label} gauge={g} />
      ))}
      {bay.stats && <BandStats stats={bay.stats} />}
      {bay.lines?.map((l) => (
        <p key={l.text} style={l.warn ? WARN : LINE}>
          {l.text}
        </p>
      ))}
      {bay.chips && bay.chips.length > 0 && (
        <ul style={CHIPS}>
          {bay.chips.map((c) =>
            c.entity ? (
              <li key={c.text}>
                <Entity
                  form="token"
                  entity={c.entity}
                  instance={c.warn ? DAMAGED : undefined}
                  trailing={c.warn ? <StatusBadge status={DAMAGED.condition} /> : undefined}
                />
              </li>
            ) : (
              <li key={c.text} style={c.warn ? { ...CHIP, ...WARN } : CHIP}>
                {c.text}
              </li>
            )
          )}
        </ul>
      )}
      {bay.control}
      {bay.buttons.length > 0 && (
        <div style={BUTTONS}>
          {bay.buttons.map((btn) => (
            <PhoneButton key={btn.label} btn={btn} />
          ))}
        </div>
      )}
    </fieldset>
  )
}

/** A Major's prompt, over the whole column, its pinned gauges kept on screen. */
function PhoneOverlay({
  overlay,
  titleRef,
}: {
  overlay: BandOverlay
  titleRef: RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The prompt may open below the fold (a deck hand-off, Storage at the
  // bottom of the Reactor bay): bring it up, as the canvas's covers its band.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start' })
  }, [])
  return (
    <div ref={ref} role="dialog" aria-label={overlay.title} style={OVERLAY}>
      <div style={OVERLAY_HEAD}>
        <h3
          ref={(el) => {
            titleRef.current = el
          }}
          tabIndex={-1}
          style={OVERLAY_TITLE}
        >
          {overlay.title}
        </h3>
        <Button variant="ghost" size="compact" style={BUTTON} onClick={overlay.onClose}>
          Close
        </Button>
      </div>
      {overlay.gauges && overlay.gauges.length > 0 && <Cells gauges={overlay.gauges} />}
      {overlay.body}
      {overlay.actions && overlay.actions.length > 0 && (
        <div style={ACTIONS}>
          {overlay.actions.map((btn) => (
            <PhoneButton key={btn.label} btn={btn} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PhoneMajorFrame({
  view,
  between,
  titleRef,
  live,
}: {
  view: MajorModel
  between: ReactNode
  /** Where focus goes when a prompt opens. */
  titleRef: RefObject<HTMLElement | null>
  /** The slot's live region, mounted whether or not a prompt is up. */
  live: ReactNode
}) {
  const main = view.bays.filter((b) => !b.side)
  const side = view.bays.filter((b) => b.side)
  const covered = view.overlay != null
  return (
    <div style={COLUMN} data-fam={view.fam}>
      {live}
      {view.overlay && <PhoneOverlay overlay={view.overlay} titleRef={titleRef} />}
      <div style={covered ? COVERED : COLUMN} inert={covered}>
        <div style={STAMP_ROW}>
          <Badge shape="stamp" size="mini" style={STAMP}>
            {view.stampLabel}
          </Badge>
        </div>
        {main.map((bay) => (
          <PhoneBay key={bay.label} bay={bay} />
        ))}
        {between}
        {side.map((bay) => (
          <PhoneBay key={bay.label} bay={bay} />
        ))}
      </div>
    </div>
  )
}
