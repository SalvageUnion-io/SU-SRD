/**
 * Legacy "before" capture — ITUN Dashboard `DialConfig` (⚙ overlay, Phase 7).
 *
 * Reproduces the bespoke dialog/overlay from
 * apps/in-the-union-now/src/components/dashboard/DialConfig.tsx VERBATIM — same
 * `.pc-dialcfg*` markup (header bar + Done close + show/hide + reorder rows),
 * styled by the co-located CSS slice (NOT Tailwind). The dial KINDS and their
 * labels are the real Dashboard set (Actions locked, Mech / Pilot / Crawler /
 * Tables / SRD Explorer); the prefs/onChange plumbing is collapsed to local
 * state so the overlay is live and self-contained. L1 reconciliation: freeze
 * the "before", do not refactor onto ModalShell.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../_harness'
import './LegacyDialConfig.css'

// Real Dashboard dial kinds + labels (from the app's dialItems.ts).
type DialKind = 'actions' | 'mech' | 'pilot' | 'crawler' | 'tables' | 'srd'
const DIAL_KIND_LABELS: Record<DialKind, string> = {
  actions: 'Actions',
  mech: 'Mech',
  pilot: 'Pilot',
  crawler: 'Crawler',
  tables: 'Tables',
  srd: 'SRD Explorer',
}
const LOCKED_DIAL_KIND: DialKind = 'actions'

// Verbatim reproduction of DialConfig.tsx's overlay, with the prefs/onChange
// contract collapsed to local order + hidden state so it is self-contained.
function DialConfig({ onClose }: { onClose: () => void }) {
  const [order, setOrder] = useState<DialKind[]>([
    'actions',
    'mech',
    'pilot',
    'crawler',
    'tables',
    'srd',
  ])
  const [hidden, setHidden] = useState<Set<DialKind>>(new Set(['srd']))

  const toggleHidden = (kind: DialKind) => {
    if (kind === LOCKED_DIAL_KIND) return
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      const a = next[index]
      const b = next[target]
      if (!a || !b) return prev
      next[index] = b
      next[target] = a
      return next
    })
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

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Dial Config' }

export const Default: Story = () => {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ maxWidth: 300 }}>
      <Caption>
        ITUN Dashboard dial-config ⚙ overlay (DialConfig) — a bespoke role="dialog" that duplicates
        the shared ModalShell. Prefs/onChange plumbing is collapsed to local state for this capture;
        the visual shell (dark overlay, header bar, Done close, show/hide + reorder rows) is
        verbatim.
      </Caption>
      {/* Sized dark wheel column that stands in for the Dashboard dial column. */}
      <div
        className="pc-root pc-wheel-col"
        style={{ background: 'var(--pc-ground)', height: 360, width: 260, padding: 6 }}
      >
        {open ? (
          <DialConfig onClose={() => setOpen(false)} />
        ) : (
          <button type="button" className="pc-wheel-btn" onClick={() => setOpen(true)}>
            ⚙ Re-open config
          </button>
        )}
      </div>
    </div>
  )
}
