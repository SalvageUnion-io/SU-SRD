/**
 * DialConfig — the ⚙ overlay that shows/hides and reorders the rotary Dial's
 * entries, bound to the app's CockpitPrefs.
 *
 * It operates on stable dial KINDS (not per-instance keys), so the same prefs
 * apply regardless of which mech/pilot/crawler is loaded. It owns the prefs
 * logic — ordering, the locked-visible Actions dial, building the persisted
 * CockpitPrefs — and emits a new CockpitPrefs on every change so Dashboard can
 * persist it against the owning container.
 *
 * This was two files until the component-lib boundary audit (PK-03): a
 * presentational view in component-lib taking id-string rows, and this binding
 * translating DialKinds to and from those strings. The view had one consumer,
 * and its `string` callback signature forced a `findIndex` with a biome-ignore
 * here purely to re-narrow the id back to a DialKind. One file, typed on
 * DialKind throughout, needs neither.
 */

import { Button, Toggle } from 'component-lib'
import type { CockpitPrefs, DialKind } from '../../lib/schemas/cockpitPrefs'
import { DIAL_KIND_LABELS, LOCKED_DIAL_KIND, orderKinds } from './dialItems'

type DialConfigProps = {
  /** The dial kinds this Dashboard can show, in default order. */
  kinds: DialKind[]
  /** Current persisted prefs (undefined → defaults: all visible, default order). */
  prefs?: CockpitPrefs
  /** Emit updated prefs (Dashboard persists them per container). */
  onChange: (next: CockpitPrefs) => void
  onClose: () => void
}

function buildPrefs(order: DialKind[], hidden: Set<DialKind>): CockpitPrefs {
  return {
    order,
    // `actions` is locked visible — never persisted as hidden.
    hidden: order.filter((k) => k !== LOCKED_DIAL_KIND && hidden.has(k)),
  }
}

export function DialConfig({ kinds, prefs, onChange, onClose }: DialConfigProps) {
  const order = orderKinds(kinds, prefs)
  const hidden = new Set<DialKind>(prefs?.hidden ?? [])

  const onToggle = (kind: DialKind) => {
    if (kind === LOCKED_DIAL_KIND) return
    const next = new Set(hidden)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    onChange(buildPrefs(order, next))
  }

  const onMove = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    onChange(buildPrefs(next, hidden))
  }

  return (
    <div className="pc-dialcfg" role="dialog" aria-label="Configure dial">
      <div className="pc-dialcfg-head">
        <span className="pc-dialcfg-title">Configure Dial</span>
        <Button variant="ghost" size="compact" onClick={onClose}>
          Done
        </Button>
      </div>
      <ul className="pc-dialcfg-list">
        {order.map((kind, i) => {
          const label = DIAL_KIND_LABELS[kind]
          const locked = kind === LOCKED_DIAL_KIND
          const rowHidden = hidden.has(kind)
          return (
            <li key={kind} className="pc-dialcfg-row">
              <span className="pc-dialcfg-show">
                {/*
                 * `Toggle`, not `Checkbox`: this row is already a bordered
                 * instrument row carrying its own condensed-uppercase label, so
                 * the framed choice-row card would nest a card inside a card —
                 * the reason this had been holding an open-coded native `<input>`
                 * instead. Toggle is the bare rung that was missing, and adopting
                 * it retires the browser's default accent blue, the one colour
                 * with no place in a paper/ink/rust cockpit.
                 *
                 * The wrapper is no longer a `<label>`: Toggle brings its own, and
                 * nesting labels would give the switch two accessible names.
                 */}
                <Toggle
                  label={`Show ${label}`}
                  checked={locked || !rowHidden}
                  disabled={locked}
                  onChange={() => onToggle(kind)}
                />
                <span className={rowHidden ? 'pc-dialcfg-lab hidden' : 'pc-dialcfg-lab'}>
                  {label}
                  {locked ? ' (locked)' : ''}
                </span>
              </span>
              <span className="pc-dialcfg-move">
                <Button
                  size="compact"
                  className="min-w-0 flex-1 px-2"
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${label} up`}
                >
                  ▲
                </Button>
                <Button
                  size="compact"
                  className="min-w-0 flex-1 px-2"
                  onClick={() => onMove(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${label} down`}
                >
                  ▼
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
