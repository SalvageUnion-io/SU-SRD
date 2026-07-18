/**
 * Legacy "before" capture — ITUN Dashboard `Dial` (the rotary selector column).
 *
 * Reproduces the PRESENTATIONAL SHELL of
 * apps/in-the-union-now/src/components/dashboard/Dial.tsx VERBATIM — the
 * `.pc-wheel-col` / `.pc-wheel-stage` / `.pc-wheel-seat` / `.pc-cell*` /
 * `.pc-wheel-ctl` markup and the real seat-layout math (base/frac → per-seat
 * top/width/height), styled by the co-located CSS slice (NOT Tailwind). The
 * momentum-wheel PHYSICS (pointer drag, inertia coast, RAF snap) produce no
 * distinct DOM, so they are collapsed here to a static `pos = wheel` local
 * state driven by ▲▼ / click-to-jump — the visual stack (active card in the
 * viewfinder, cards shrinking + tiling away from it) is verbatim. Statful cells
 * embed the reproduced DashboardGauge. Items are built from real reference
 * entities. L1 reconciliation: freeze the "before", do not refactor.
 */

import type { Story } from '@ladle/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../_harness'
import './LegacyDial.css'

// --- App-only types mirrored locally (cannot import from apps/) ---
type DialKind = 'actions' | 'mech' | 'pilot' | 'crawler' | 'tables' | 'srd'
type GaugeTone = 'mech' | 'pilot' | 'crawler'
type DialGauge = { label: string; value: number; max: number; tone: GaugeTone; danger?: number }
type DialItem =
  | { key: string; kind: DialKind; statless: true; label: string; sublabel: string }
  | {
      key: string
      kind: DialKind
      statless: false
      label: string
      tone: GaugeTone
      gauges: DialGauge[]
    }

// --- Card geometry (verbatim from Dial.tsx) ---
const ACTIVE_H = 168
const ACTIVE_W = 380
const TRACK_H = 98
const TRACK_W = Math.round((ACTIVE_W * 2) / 3)
const GAP = 8
const VIEW_TOP = 0

// --- Reproduced DashboardGauge (statful cells embed it) ---
const TONES: Record<GaugeTone, [string, string]> = {
  mech: ['var(--pc-mech)', 'var(--pc-mech-deep)'],
  pilot: ['var(--pc-pilot)', 'var(--pc-pilot-deep)'],
  crawler: ['var(--pc-crawler)', 'var(--pc-crawler-deep)'],
}
function DashboardGauge({ label, value, max, tone = 'mech', danger }: DialGauge) {
  const total = Math.max(max, value, 0)
  const [t, td] = TONES[tone]
  const segs = []
  for (let i = 0; i < total; i++) {
    const filled = i < value
    const isDanger = danger !== undefined && i >= danger
    let cls = 'pc-seg'
    if (filled) cls += isDanger ? ' danger' : ' on'
    segs.push(<span key={i} className={cls} />)
  }
  const style = { '--pc-gtone': t, '--pc-gtone-deep': td } as CSSProperties
  return (
    <div className="pc-gauge" style={style} role="img" aria-label={`${label} ${value} of ${max}`}>
      <span className="pc-gauge-lab">{label}</span>
      <div className="pc-gauge-track">{segs}</div>
      <span className="pc-gauge-num">
        {value}/{max}
      </span>
    </div>
  )
}

// --- DialCell (verbatim from Dial.tsx) ---
function DialCell({
  item,
  active,
  onClick,
}: {
  item: DialItem
  active?: boolean
  onClick?: () => void
}) {
  const cls = `pc-cell${active ? ' pc-cell-active' : ''}${item.statless ? ' statless' : ''}`
  const inner = item.statless ? (
    <>
      <span className="pc-cell-title">{item.label}</span>
      <span className="pc-cell-sub">{item.sublabel}</span>
    </>
  ) : (
    <>
      <span className={`pc-cell-lab ${item.tone}`}>{item.label}</span>
      <div className="pc-cell-gauges">
        {item.gauges.map((g) => (
          <DashboardGauge
            key={g.label}
            label={g.label}
            value={g.value}
            max={g.max}
            tone={g.tone}
            danger={g.danger}
          />
        ))}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={item.label}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}

/**
 * Dial shell — the seat-layout math is verbatim; the wheel physics are collapsed
 * to a static `pos = wheel` driven by ▲▼ / click-to-jump (store plumbing removed).
 */
function Dial({ items }: { items: DialItem[] }) {
  const [wheel, setWheel] = useState(0)
  const n = items.length
  const active = n > 0 ? ((wheel % n) + n) % n : 0
  const pos = wheel

  const stepBy = (d: number) => {
    if (n === 0) return
    setWheel((w) => w + d)
  }
  const jumpTo = (idx: number) => {
    if (n === 0) return
    const cur = ((wheel % n) + n) % n
    let delta = (((idx - cur) % n) + n) % n
    if (delta > n / 2) delta -= n
    if (delta === 0) return
    setWheel(wheel + delta)
  }

  const activeItem = items[active]
  if (!activeItem) return <div className="pc-wheel-col" />

  // Seat layout — verbatim from Dial.tsx (real heights, no scale).
  const base = Math.floor(pos)
  const frac = pos - base
  const lerpIn = (phase: number) => Math.max(0, 1 - Math.abs(phase))
  const heightAt = (phase: number) => TRACK_H + (ACTIVE_H - TRACK_H) * lerpIn(phase)
  const widthAt = (phase: number) => TRACK_W + (ACTIVE_W - TRACK_W) * lerpIn(phase)

  const seats = items.map((it, i) => {
    let o = ((i - base) % n) + (i - base < 0 ? n : 0)
    o %= n
    const phase = o - frac
    return { it, i, o, phase, h: heightAt(phase), w: widthAt(phase) }
  })
  const hByO = new Map(seats.map((s) => [s.o, s.h]))
  const topByO = new Map<number, number>([[0, VIEW_TOP - frac * (TRACK_H + GAP)]])
  const maxO = Math.max(...seats.map((s) => s.o))
  const minO = Math.min(...seats.map((s) => s.o))
  for (let o = 1, t = topByO.get(0) as number; o <= maxO; o++) {
    t += (hByO.get(o - 1) as number) + GAP
    topByO.set(o, t)
  }
  for (let o = -1, t = topByO.get(0) as number; o >= minO; o--) {
    t -= (hByO.get(o) as number) + GAP
    topByO.set(o, t)
  }

  return (
    <div className="pc-wheel-col" role="listbox" aria-label="Dial">
      <div className="pc-wheel-stage">
        {seats.map(({ it, i, o, phase, h, w }) => {
          const isActive = i === active
          const style = {
            top: `${topByO.get(o)}px`,
            height: `${h}px`,
            width: `${w}px`,
            zIndex: Math.round(100 - Math.abs(phase) * 10),
          }
          return (
            <div key={it.key} className="pc-wheel-seat" style={style}>
              <DialCell
                item={it}
                active={isActive}
                onClick={isActive ? undefined : () => jumpTo(i)}
              />
            </div>
          )
        })}
      </div>
      <div className="pc-wheel-ctl">
        <button
          type="button"
          className="pc-wheel-btn"
          onClick={() => stepBy(-1)}
          aria-label="Dial up"
        >
          ▲
        </button>
        <button
          type="button"
          className="pc-wheel-btn"
          onClick={() => stepBy(1)}
          aria-label="Dial down"
        >
          ▼
        </button>
        <button
          type="button"
          className="pc-wheel-btn pc-wheel-cfg"
          aria-label="Configure dial"
          title="Show / hide and reorder dial items"
        >
          ⚙
        </button>
      </div>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Dial' }

export const Default: Story = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const cls = SalvageUnionReference.Classes.all()[0]
  const crawler = SalvageUnionReference.Crawlers.all()[0]
  if (!chassis || !cls || !crawler)
    return <Caption>Chassis / Class / Crawler fixture missing</Caption>

  // Build the real dial item set (mirrors dialItems.ts): the statless views plus
  // the counterpart entities, each carrying the real SU vital gauges.
  const items: DialItem[] = [
    {
      key: 'actions',
      kind: 'actions',
      statless: true,
      label: 'Actions',
      sublabel: 'full action deck',
    },
    {
      key: `mech:${chassis.id}`,
      kind: 'mech',
      statless: false,
      label: `Mech · ${chassis.name}`,
      tone: 'mech',
      gauges: [
        { label: 'SP', value: 12, max: 15, tone: 'mech' },
        { label: 'Heat', value: 5, max: 6, tone: 'mech', danger: 4 },
      ],
    },
    {
      key: `pilot:${cls.id}`,
      kind: 'pilot',
      statless: false,
      label: `Pilot · ${cls.name}`,
      tone: 'pilot',
      gauges: [
        { label: 'HP', value: 8, max: 10, tone: 'pilot' },
        { label: 'AP', value: 3, max: 5, tone: 'pilot' },
      ],
    },
    {
      key: `crawler:${crawler.id}`,
      kind: 'crawler',
      statless: false,
      label: `Crawler · ${crawler.name}`,
      tone: 'crawler',
      gauges: [{ label: 'SP', value: 20, max: 20, tone: 'crawler' }],
    },
    {
      key: 'tables',
      kind: 'tables',
      statless: true,
      label: 'Tables',
      sublabel: 'roll on any table',
    },
    {
      key: 'srd',
      kind: 'srd',
      statless: true,
      label: 'SRD Explorer',
      sublabel: 'reference browser',
    },
  ]

  return (
    <div style={{ maxWidth: 420 }}>
      <Caption>
        ITUN Dashboard rotary Dial (Dial) — the bespoke momentum wheel. Active card in the
        viewfinder (top) drives the display; cards shrink + tile away from it. Physics collapsed to
        ▲▼ / click-to-jump for this capture; the seat-layout math and `.pc-cell` shell are verbatim,
        driven by real reference entities.
      </Caption>
      {/* Dark stage sized like the Dashboard's 260px wheel column. */}
      <div
        className="pc-root"
        style={{
          background: 'var(--pc-ground)',
          height: 560,
          width: 260,
          padding: 6,
          borderRadius: 5,
        }}
      >
        <Dial items={items} />
      </div>
    </div>
  )
}
