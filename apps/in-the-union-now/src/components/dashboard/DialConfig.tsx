/**
 * DialConfig — the ⚙ overlay that configures the rotary Dial (Dashboard
 * Phase 7, plan §9.7). Show/hide and reorder the dial kinds; "Actions" is
 * locked visible. Emits a new CockpitPrefs on every change — Dashboard
 * persists it to the owning Workspace record (local-first), so the layout
 * survives reloads.
 *
 * The overlay operates on stable dial KINDS (not per-instance keys), so the
 * same prefs apply regardless of which mech/pilot/crawler is loaded.
 */

import type { CockpitPrefs, DialKind } from '../../lib/schemas/cockpitPrefs'
import { DIAL_KIND_LABELS, LOCKED_DIAL_KIND, orderKinds } from './dialItems'

type DialConfigProps = {
  /** The dial kinds this Dashboard can show, in default order. */
  kinds: DialKind[]
  /** Current persisted prefs (undefined → defaults: all visible, default order). */
  prefs?: CockpitPrefs
  /** Emit updated prefs (Dashboard persists to the workspace). */
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

  const toggleHidden = (kind: DialKind) => {
    if (kind === LOCKED_DIAL_KIND) return
    const next = new Set(hidden)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    onChange(buildPrefs(order, next))
  }

  const move = (index: number, delta: number) => {
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
        <button type="button" className="pc-railbtn" onClick={onClose}>
          Done
        </button>
      </div>
      <ul className="pc-dialcfg-list">
        {order.map((kind, i) => {
          const locked = kind === LOCKED_DIAL_KIND
          const isHidden = hidden.has(kind)
          return (
            <li key={kind} className="pc-dialcfg-row">
              <label className="pc-dialcfg-show">
                <input
                  type="checkbox"
                  checked={locked || !isHidden}
                  disabled={locked}
                  onChange={() => toggleHidden(kind)}
                  aria-label={`Show ${DIAL_KIND_LABELS[kind]}`}
                />
                <span className={isHidden ? 'pc-dialcfg-lab hidden' : 'pc-dialcfg-lab'}>
                  {DIAL_KIND_LABELS[kind]}
                  {locked ? ' (locked)' : ''}
                </span>
              </label>
              <span className="pc-dialcfg-move">
                <button
                  type="button"
                  className="pc-wheel-btn"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${DIAL_KIND_LABELS[kind]} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="pc-wheel-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${DIAL_KIND_LABELS[kind]} down`}
                >
                  ▼
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
