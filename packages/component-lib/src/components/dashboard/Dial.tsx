/**
 * Dial — the rotary selector column on the right of the Dashboard. It behaves
 * like a physical wheel: a single continuous scroll position (`pos`, in item
 * units) drives everything. Drag the column and it tracks your pointer 1:1;
 * release and it coasts with mild inertia, then snaps to the nearest item. ▲▼
 * ease it one step; clicking a cell eases it to that cell.
 *
 * The item nearest the viewfinder (the fixed active slot at the top, the
 * intersection with the primary row) is the largest and drives the display; as
 * a cell scrolls away it shrinks and fades, wrapping seamlessly around the loop.
 * The logical `activeIndex` (owned by the caller — the app persists it) is kept
 * in sync with the nearest item so the display stays live and the selection
 * survives remounts.
 *
 * Presentational: the caller owns the active index + persistence; the config
 * overlay content is injected via `renderConfig` (the app binds its prefs).
 * Statful cells (entities) show a stamp + compact gauges; statless cells
 * (Actions / Tables / SRD) show a centered title — no stats.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

import { Button } from '../chrome/Button'
import { DashboardGauge, type GaugeTone } from './DashboardGauge'

export type DialGauge = {
  label: string
  value: number
  max: number
  tone: GaugeTone
  /** First 0-based segment index that reads as danger (redline) when filled. */
  danger?: number
}

/** A presentational dial entry. Statless entries are a centered title (Actions /
 *  Tables / SRD); statful entries carry a tone stamp + compact gauges. */
export type DialItem =
  | { key: string; statless: true; label: string; sublabel: string }
  | { key: string; statless: false; label: string; tone: GaugeTone; gauges: DialGauge[] }

/** Active card size in the viewfinder. Height matches the Active row (168px
 * primary grid row) so labels line up; width is wider than the track cards. */
const ACTIVE_H = 168
const ACTIVE_W = 380
/** Size a card shrinks to away from the viewfinder — tall enough for a stamp +
 * two gauges (the mech's SP/Heat) without clipping; 2/3 the active width. */
const TRACK_H = 98
const TRACK_W = Math.round((ACTIVE_W * 2) / 3)
/** Gap between adjacent cards, px. */
const GAP = 8
/** Top of the active slot within the stage (0 = aligned with the primary row). */
const VIEW_TOP = 0
/** Pixels of drag that advance the wheel by one item. */
const DRAG_UNIT = 74
/** Constant deceleration for the inertia coast (items/ms²) — a linear slow-down,
 * not a springy exponential one. */
const DECEL = 0.00018
/** Below this speed (items/ms) a release snaps instead of coasting. */
const MIN_VEL = 0.0012
/** Cap the launch velocity so a hard flick can't spin forever. */
const MAX_VEL = 0.03
/** Duration of the linear ease for a step / jump / snap, ms. */
const EASE_MS = 200
/** Pointer travel (px) past which a press is a drag, not a click. */
const DRAG_SLOP = 5

/** §10.2: reduced-motion users get instant snaps — no ease, no inertia coast.
 * Read live (not cached) so an OS-level toggle applies without a remount. */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

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
  const selected = active === true
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
  // §10.2: the dial container is a listbox, so every cell is an option carrying
  // its selection state.
  if (onClick) {
    return (
      <button
        type="button"
        role="option"
        aria-selected={selected}
        className={cls}
        onClick={onClick}
        aria-label={item.label}
      >
        {inner}
      </button>
    )
  }
  // A cell with no onClick is still an OPTION — it belongs to the listbox and
  // carries selection state — it just isn't independently activatable. It needs
  // `tabIndex={-1}` all the same: an element with role="option" must be able to
  // receive focus programmatically, since the listbox moves focus onto its
  // options rather than each one owning a tab stop. Without it the role is a
  // lie (an option nothing can reach), which is the half-fix version of the very
  // a11y defect this branch was added to close.
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={item.label}
      className={cls}
      tabIndex={-1}
    >
      {inner}
    </div>
  )
}

export type DialProps = {
  items: DialItem[]
  /** The logical selection index (unbounded; wraps over items). Caller-owned. */
  activeIndex: number
  /** Persist the logical selection when the wheel settles on a new item. */
  onActiveIndexChange: (index: number) => void
  /** Render the ⚙ config overlay content; omit to hide the ⚙ control. `close`
   *  dismisses the overlay. */
  renderConfig?: (close: () => void) => ReactNode
}

export function Dial({ items, activeIndex, onActiveIndexChange, renderConfig }: DialProps) {
  const wheel = activeIndex
  const [configOpen, setConfigOpen] = useState(false)

  const n = items.length
  const active = n > 0 ? ((wheel % n) + n) % n : 0

  // Synchronous mirror of the caller's index so gesture handlers can read the
  // latest value between renders (and write through in one place).
  const wheelRef = useRef(activeIndex)
  useEffect(() => {
    wheelRef.current = activeIndex
  }, [activeIndex])
  const setWheel = useCallback(
    (idx: number) => {
      wheelRef.current = idx
      onActiveIndexChange(idx)
    },
    [onActiveIndexChange]
  )

  // Continuous scroll position (item units, same space as `wheel`). `pos` state
  // mirrors `posRef` so the render follows every animation frame.
  const [pos, setPos] = useState(wheel)
  const posRef = useRef(wheel)
  const velRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const interactingRef = useRef(false)
  const drag = useRef<{ y: number; t: number; moved: number; id: number; active: boolean } | null>(
    null
  )
  // True for the click that immediately follows a drag, so it doesn't also jump.
  const clickGuard = useRef(false)

  const commit = useCallback((p: number) => {
    posRef.current = p
    setPos(p)
  }, [])
  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])
  // Keep the logical index on the item nearest the viewfinder.
  const syncWheel = useCallback(
    (p: number) => {
      const idx = Math.round(p)
      if (idx !== wheelRef.current) setWheel(idx)
    },
    [setWheel]
  )

  // Ease `pos` to a target over ~260ms (the visual catch-up to `wheel`, and the
  // snap that ends a gesture). Purely visual — it never writes `wheel`.
  const easeTo = useCallback(
    (target: number) => {
      cancelRaf()
      const from = posRef.current
      const dist = target - from
      if (Math.abs(dist) < 0.001 || prefersReducedMotion()) {
        commit(target)
        interactingRef.current = false
        return
      }
      interactingRef.current = true
      let start: number | null = null
      const tick = (ts: number) => {
        if (start === null) start = ts
        const t = Math.min(1, (ts - start) / EASE_MS)
        commit(from + dist * t) // linear — no springy ease
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          rafRef.current = null
          commit(target)
          interactingRef.current = false
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [cancelRaf, commit]
  )

  // Coast with the release velocity under CONSTANT deceleration (a linear
  // slow-down, not a springy exponential decay); when it reaches rest, snap to
  // the nearest item with a short linear ease.
  const coast = useCallback(() => {
    cancelRaf()
    interactingRef.current = true
    let prev: number | null = null
    const tick = (ts: number) => {
      const dt = prev === null ? 16 : Math.min(48, ts - prev)
      prev = ts
      const v = velRef.current
      const drop = DECEL * dt
      velRef.current = Math.abs(v) <= drop ? 0 : v - Math.sign(v) * drop
      const p = posRef.current + velRef.current * dt
      commit(p)
      syncWheel(Math.round(p))
      if (velRef.current === 0) {
        rafRef.current = null
        syncWheel(Math.round(p))
        easeTo(Math.round(p))
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [cancelRaf, commit, syncWheel, easeTo])

  // Buttons / click-to-jump move the LOGICAL selection immediately (synchronous
  // via wheelRef); the effect eases `pos` to catch up.
  const stepBy = (d: number) => {
    if (n === 0) return
    setWheel(wheelRef.current + d)
  }
  const jumpTo = (idx: number) => {
    if (n === 0) return
    const w = wheelRef.current
    const cur = ((w % n) + n) % n
    // Shortest signed path so the wheel rolls the natural way.
    let delta = (((idx - cur) % n) + n) % n
    if (delta > n / 2) delta -= n
    if (delta === 0) return
    setWheel(w + delta)
  }

  const onPointerDown = (e: PointerEvent) => {
    cancelRaf()
    velRef.current = 0
    clickGuard.current = false
    // Don't capture or claim the gesture yet — a press that never moves must
    // stay a plain click so the cell's onClick can jump the wheel to it.
    drag.current = { y: e.clientY, t: e.timeStamp, moved: 0, id: e.pointerId, active: false }
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    const dt = Math.max(1, e.timeStamp - d.t)
    d.y = e.clientY
    d.t = e.timeStamp
    d.moved += Math.abs(dy)
    if (!d.active) {
      if (d.moved <= DRAG_SLOP) return
      // Promote to a drag: now capture the pointer and own the animation.
      d.active = true
      interactingRef.current = true
      e.currentTarget.setPointerCapture(d.id)
    }
    // Drag up (dy<0) advances the wheel (pos increases).
    const dPos = -dy / DRAG_UNIT
    commit(posRef.current + dPos)
    syncWheel(Math.round(posRef.current))
    velRef.current = Math.max(-MAX_VEL, Math.min(MAX_VEL, dPos / dt))
  }
  const endDrag = (e: PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.active) return // a tap — the cell's onClick handles the jump
    clickGuard.current = true
    if (e.currentTarget.hasPointerCapture?.(d.id)) {
      e.currentTarget.releasePointerCapture(d.id)
    }
    // Reduced motion: never coast — snap straight to the nearest item.
    if (Math.abs(velRef.current) > MIN_VEL && !prefersReducedMotion()) {
      coast()
    } else {
      const target = Math.round(posRef.current)
      syncWheel(target)
      easeTo(target)
    }
  }
  // Clicking a cell jumps to it — unless the click is the tail of a drag.
  const guardedJump = (idx: number) => {
    if (clickGuard.current) {
      clickGuard.current = false
      return
    }
    jumpTo(idx)
  }

  // Follow external `activeIndex` changes (e.g. store reset) when not mid-gesture.
  useEffect(() => {
    if (interactingRef.current) return
    if (Math.abs(posRef.current - wheel) > 0.001) easeTo(wheel)
  }, [wheel, easeTo])
  // Cancel any in-flight animation on unmount.
  useEffect(() => cancelRaf, [cancelRaf])

  const activeItem = items[active]
  if (!activeItem) return <div className="pc-wheel-col" />

  const canConfigure = renderConfig !== undefined

  // Lay the cards out at REAL heights (no scale, so labels keep their size): the
  // card at the viewfinder is ACTIVE_H tall, shrinking to TRACK_H away from it.
  // `base`/`frac` split `pos`; cards are placed by walking out from the front
  // card and accumulating real heights so they tile without gaps as pos scrolls.
  const base = Math.floor(pos)
  const frac = pos - base
  // Linear grow/shrink: only the card(s) within one step of the viewfinder
  // transition; every card at |phase| >= 1 stays the uniform track size.
  const lerpIn = (phase: number) => Math.max(0, 1 - Math.abs(phase))
  const heightAt = (phase: number) => TRACK_H + (ACTIVE_H - TRACK_H) * lerpIn(phase)
  const widthAt = (phase: number) => TRACK_W + (ACTIVE_W - TRACK_W) * lerpIn(phase)

  // Offsets 0..n-1: the active card sits at the top and every other card stacks
  // BENEATH it, in dial order. The card leaving the top on a scroll wraps to the
  // bottom (hidden above the stage's top clip during the hand-off).
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
      <div
        className="pc-wheel-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {seats.map(({ it, i, o, phase, h, w }) => {
          const isActive = i === active
          // No dimming — every card is fully visible. The active card sits on top
          // (higher z) so its overhang reads over the cards stacked beneath it.
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
                onClick={isActive ? undefined : () => guardedJump(i)}
              />
            </div>
          )
        })}
      </div>
      <div className="pc-wheel-ctl">
        <Button
          size="compact"
          className="min-w-0 flex-1 px-2"
          onClick={() => stepBy(-1)}
          aria-label="Dial up"
        >
          ▲
        </Button>
        <Button
          size="compact"
          className="min-w-0 flex-1 px-2"
          onClick={() => stepBy(1)}
          aria-label="Dial down"
        >
          ▼
        </Button>
        {canConfigure && (
          <Button
            size="compact"
            className="min-w-0 shrink-0 px-2"
            onClick={() => setConfigOpen((o) => !o)}
            aria-label="Configure dial"
            aria-expanded={configOpen}
            title="Show / hide and reorder dial items"
          >
            ⚙
          </Button>
        )}
      </div>
      {canConfigure && configOpen && renderConfig(() => setConfigOpen(false))}
    </div>
  )
}
