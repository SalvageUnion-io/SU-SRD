/**
 * MinorFrame — the presentational half of a Minor slot: only what needs
 * watching (docs/architecture/dashboard-redesign.md D3). A gauge or two, a line
 * of text, and — only when something is wrong — the problem in red with a red
 * outline. `PilotMinor`, `MechMinor` and `CrawlerMinor` build the model.
 *
 * ⤢ opens the entity's Major controls as an overlay (`SlotOverlay`) without
 * moving the slots. The caller is handed the ⤢ button itself, so the overlay
 * can give focus back to it when it closes.
 *
 * Style objects only, no new `.pc-*` class (tailwind-removal.md §4): nothing
 * here has a hover or focus state of its own; ⤢ is the shared `Button`.
 */

import { Button } from 'component-lib'
import type { CSSProperties } from 'react'
import { DashboardGauge } from './DashboardGauge'
import type { BandGauge } from './MajorFrame'

export type MinorModel = {
  fam: 'mech' | 'pilot' | 'crawler'
  /** The entity's name, the Minor's heading. */
  name: string
  /** A short qualifier beside the name: "boarded", "parked", "TL2". */
  aside?: string
  gauges: BandGauge[]
  /** One-line readouts that don't earn a gauge (Heat and EP while parked). */
  lines: string[]
  /** What needs attention: an injury, a damaged system, a damaged bay. */
  problems: string[]
  /** A muted status line at the foot ("In Scrapper · no injuries"). */
  status?: string
}

const FAM: Record<MinorModel['fam'], { edge: string; ink: string }> = {
  mech: { edge: 'var(--color-mech)', ink: 'var(--color-sheet-mech-deep)' },
  pilot: { edge: 'var(--color-pilot)', ink: 'var(--color-sheet-pilot-deep)' },
  crawler: { edge: 'var(--color-crawler)', ink: 'var(--color-sheet-crawler-deep)' },
}

const FRAME: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  height: '100%',
  minWidth: 0,
  overflow: 'hidden',
  padding: '7px 9px 8px 10px',
  background: 'var(--color-band-cream)',
  border: 'var(--bw-chrome) solid color-mix(in srgb, var(--color-ink) 16%, transparent)',
  borderRadius: 'var(--radius-panel)',
}

const HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }

const NAME: CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-cond)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-caps-tight)',
  fontSize: 'var(--text-caption)',
}

const ASIDE: CSSProperties = {
  flex: '1 0 auto',
  fontFamily: 'var(--font-cond)',
  fontWeight: 600,
  fontSize: 'var(--text-note)',
  color: 'var(--color-ink-50)',
}

const TEXT: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-note)',
  lineHeight: 1.3,
  color: 'var(--color-ink)',
  fontVariantNumeric: 'tabular-nums',
}

const PROBLEM: CSSProperties = { ...TEXT, color: 'var(--color-status-bad)', fontWeight: 600 }

const STATUS: CSSProperties = { ...TEXT, marginTop: 'auto', color: 'var(--color-ink-50)' }

const EXPAND: CSSProperties = { flex: '0 0 auto', marginLeft: 'auto' }

/**
 * A Minor slot. `slot` names the entity kind for the ⤢ label ("Open the Mech
 * controls"); `onExpand` receives the ⤢ button, which the overlay refocuses on
 * close.
 */
export function MinorFrame({
  view,
  slot,
  onExpand,
}: {
  view: MinorModel
  slot: string
  onExpand: (trigger: HTMLButtonElement) => void
}) {
  const fam = FAM[view.fam]
  const troubled = view.problems.length > 0
  const frame: CSSProperties = {
    ...FRAME,
    borderLeft: `4px solid ${fam.edge}`,
    // The red outline is the "look here" signal (D3). An inset ring, so the
    // slot never changes size when it appears.
    boxShadow: troubled ? 'inset 0 0 0 2px var(--color-status-bad)' : undefined,
  }
  return (
    <section aria-label={`${slot} · ${view.name}`} data-fam={view.fam} style={frame}>
      <div style={HEAD}>
        <h3 style={{ ...NAME, color: fam.ink }}>{view.name}</h3>
        {view.aside ? <span style={ASIDE}>{view.aside}</span> : null}
        <Button
          variant="ghost"
          size="mini"
          style={EXPAND}
          aria-haspopup="dialog"
          aria-label={`Open the ${slot} controls`}
          title={`Open the ${slot} controls`}
          onClick={(e) => onExpand(e.currentTarget)}
        >
          ⤢
        </Button>
      </div>
      {view.gauges.length > 0 && (
        <div className="pc-bay-gauges">
          {view.gauges.map((g) => (
            <DashboardGauge
              key={g.label}
              label={g.label}
              value={g.value}
              max={g.max}
              tone={g.tone}
              danger={g.danger}
              provenance={g.provenance}
              breakdown={g.breakdown}
            />
          ))}
        </div>
      )}
      {view.lines.map((line) => (
        <p key={line} style={TEXT}>
          {line}
        </p>
      ))}
      {view.problems.map((p) => (
        <p key={p} style={PROBLEM}>
          {p}
        </p>
      ))}
      {view.status ? <p style={STATUS}>{view.status}</p> : null}
    </section>
  )
}
