/**
 * DialConfig (ITUN binding) — adapts the app's CockpitPrefs to the presentational
 * DialConfig in component-lib. Owns the prefs logic (ordering, locked-visible
 * Actions, building the persisted CockpitPrefs); emits a new CockpitPrefs on
 * every change so Dashboard can persist it against the owning container.
 *
 * The overlay operates on stable dial KINDS (not per-instance keys), so the same
 * prefs apply regardless of which mech/pilot/crawler is loaded.
 */

import { DialConfig as DialConfigView } from 'component-lib'
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

  const rows = order.map((kind) => ({
    id: kind,
    label: DIAL_KIND_LABELS[kind],
    hidden: hidden.has(kind),
    locked: kind === LOCKED_DIAL_KIND,
  }))

  const onToggle = (id: string) => {
    const kind = order.find((k) => k === id)
    if (kind === undefined || kind === LOCKED_DIAL_KIND) return
    const next = new Set(hidden)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    onChange(buildPrefs(order, next))
  }

  const onMove = (id: string, delta: -1 | 1) => {
    const index = order.findIndex((k) => k === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= order.length) return
    const next = [...order]
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    onChange(buildPrefs(next, hidden))
  }

  return <DialConfigView rows={rows} onToggle={onToggle} onMove={onMove} onClose={onClose} />
}
