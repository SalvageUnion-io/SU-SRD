/**
 * Dial — the rotary selector column. The active item sits in a wide slot (it
 * overhangs the column and, in Phase 4, drives the main display); the rest ride
 * a track below, right-aligned and smaller. Advance with ▲▼, click a track item
 * to jump, or drag the column; each step plays a short directional roll.
 *
 * Statful cells (entities) show a stamp + compact gauges; statless cells
 * (Actions / Tables / SRD) show a big centered title — no stats.
 *
 * Phase 3: selection + focus. The store's `wheel` index is the single source of
 * truth; PlayCockpit reads it to drive the display (focus→display sync).
 */

import { useRef, useState, type PointerEvent } from 'react'

import type { CockpitPrefs, DialKind } from '../../lib/schemas/cockpitPrefs'
import { usePlayStateStore } from '../../stores/playStateStore'
import { CockpitGauge } from './CockpitGauge'
import { DialConfig } from './DialConfig'
import type { DialItem } from './dialItems'

const DRAG_STEP = 30

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
          <CockpitGauge
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

type DialProps = {
  items: DialItem[]
  /** Dial-config universe (kinds this cockpit can show); omit to hide the ⚙. */
  configKinds?: DialKind[]
  /** Current persisted dial prefs. */
  prefs?: CockpitPrefs
  /** Persist updated prefs; when omitted the ⚙ config control is not shown. */
  onPrefsChange?: (next: CockpitPrefs) => void
}

export function Dial({ items, configKinds, prefs, onPrefsChange }: DialProps) {
  const wheel = usePlayStateStore((s) => s.wheel)
  const setWheel = usePlayStateStore((s) => s.setWheel)
  const [anim, setAnim] = useState<{ dir: 'fwd' | 'back'; key: number }>({ dir: 'fwd', key: 0 })
  const [configOpen, setConfigOpen] = useState(false)

  const n = items.length
  const active = n > 0 ? ((wheel % n) + n) % n : 0

  const go = (next: number, dir: 'fwd' | 'back') => {
    setWheel(next)
    setAnim((a) => ({ dir, key: a.key + 1 }))
  }
  const step = (d: number) => {
    if (n === 0) return
    // Read the live wheel so multiple steps within one drag event accumulate.
    go(usePlayStateStore.getState().wheel + d, d > 0 ? 'fwd' : 'back')
  }
  const jump = (idx: number) => {
    if (idx === active || n === 0) return
    const forward = (((idx - active) % n) + n) % n
    go(idx, forward <= n / 2 ? 'fwd' : 'back')
  }

  const drag = useRef<{ last: number; acc: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    drag.current = { last: e.clientY, acc: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.acc += e.clientY - d.last
    d.last = e.clientY
    while (d.acc >= DRAG_STEP) {
      d.acc -= DRAG_STEP
      step(-1)
    }
    while (d.acc <= -DRAG_STEP) {
      d.acc += DRAG_STEP
      step(1)
    }
  }
  const endDrag = (e: PointerEvent) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const activeItem = items[active]
  if (!activeItem) return <div className="pc-wheel-col" />

  const trackIdx: number[] = []
  for (let k = 1; k < n; k++) trackIdx.push((active + k) % n)

  const canConfigure = onPrefsChange !== undefined && configKinds !== undefined

  return (
    <div
      className="pc-wheel-col"
      role="listbox"
      aria-label="Dial"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={`pc-wheel-slot anim-${anim.dir}`} key={anim.key}>
        <DialCell item={activeItem} active />
      </div>
      <div className="pc-wheel-track">
        {trackIdx.map((idx) => {
          const it = items[idx]
          return it ? <DialCell key={it.key} item={it} onClick={() => jump(idx)} /> : null
        })}
      </div>
      <div className="pc-wheel-ctl">
        <button
          type="button"
          className="pc-wheel-btn"
          onClick={() => step(-1)}
          aria-label="Dial up"
        >
          ▲
        </button>
        <button
          type="button"
          className="pc-wheel-btn"
          onClick={() => step(1)}
          aria-label="Dial down"
        >
          ▼
        </button>
        {canConfigure && (
          <button
            type="button"
            className="pc-wheel-btn pc-wheel-cfg"
            onClick={() => setConfigOpen((o) => !o)}
            aria-label="Configure dial"
            aria-expanded={configOpen}
            title="Show / hide and reorder dial items"
          >
            ⚙
          </button>
        )}
      </div>
      {canConfigure && configOpen && (
        <DialConfig
          kinds={configKinds}
          prefs={prefs}
          onChange={onPrefsChange}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  )
}
