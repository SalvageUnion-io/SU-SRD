/**
 * QuickRollFab — the Core Mechanic d20 quick-roll (design review R-6/U-3).
 *
 * A persistent thumb-zone FAB pinned bottom-right on live sheets (safe-area
 * aware, under the modal layer, clear of the sticky top bar). Tapping it
 * rolls a d20 and opens a small anchored panel showing the band readout —
 * 20 Nailed It / 11–19 Success / 6–10 Tough Choice / 2–5 Failure / 1 Cascade
 * Failure — colored by the roll-tier theme tokens, plus a short recent-rolls
 * list. Rolls are COMPONENT STATE ONLY: never persisted, never snapshotted.
 *
 * On mech sheets the latest un-pushed roll carries a "Push" affordance
 * (Core Book p.233: re-roll at the cost of +2 Heat). Per ADR-007 the caller's
 * `onPush` auto-applies the heat + Heat Check bookkeeping through the store
 * (the HeatCheckControl path) and returns a one-line outcome that is surfaced
 * next to the re-rolled die; any destroyed System/Module stays a player call.
 *
 * The d20 is dep-injectable via `roll` so tests are deterministic.
 */

import { useRef, useState } from 'react'
import { Dices, X } from 'lucide-react'
import { Btn } from 'suref-react'

import { CORE_ROLL_BANDS, performCoreRoll } from '../../lib/rules/coreMechanic'
import type { CoreRollBand } from '../../lib/rules/coreMechanic'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { Roll } from '../../lib/rules/heatCheck'
import { cn } from '../../lib/utils'
import { useDismiss } from '../shared/useDismiss'

type QuickRollFabProps = {
  /** Injectable d20 roller — defaults to a randsum-backed roll. */
  roll?: Roll
  /**
   * Mech sheets only: applies +2 Heat + a Heat Check through the store (the
   * HeatCheckControl path) and resolves to a one-line outcome readout. When
   * omitted, no Push affordance renders.
   */
  onPush?: () => Promise<string>
  className?: string
}

type RollEntry = {
  id: number
  roll: number
  band: CoreRollBand
  /** True when this entry is the re-roll produced by a Push (no re-Push). */
  pushed: boolean
  /** The Push's Heat Check outcome line, shown under the re-rolled die. */
  pushNote?: string
}

/** Recent-rolls kept in memory (latest + a short history). */
const MAX_ENTRIES = 5

/** Band chip fill — the roll-tier theme tokens (theme.css "Roll result tiers"). */
const BAND_BG: Record<CoreRollBand, string> = {
  nailed: 'bg-roll-nailed',
  success: 'bg-roll-success',
  tough: 'bg-roll-tough',
  failure: 'bg-roll-failure',
  cascade: 'bg-roll-cascade',
}

export function QuickRollFab({ roll = defaultRoll, onPush, className }: QuickRollFabProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<RollEntry[]>([])
  const [pushing, setPushing] = useState(false)
  const nextId = useRef(0)

  useDismiss(rootRef, open, () => setOpen(false))

  function addRoll(pushed: boolean, pushNote?: string) {
    const result = performCoreRoll(roll)
    const entry: RollEntry = {
      id: nextId.current++,
      roll: result.roll,
      band: result.band,
      pushed,
      pushNote,
    }
    setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES))
  }

  /** FAB tap: roll (and open the panel when closed). */
  function handleFabClick() {
    addRoll(false)
    setOpen(true)
  }

  /** Push: +2 Heat + Heat Check via the store, then the re-roll. */
  async function handlePush() {
    if (!onPush || pushing) return
    setPushing(true)
    try {
      const note = await onPush()
      addRoll(true, note)
    } finally {
      setPushing(false)
    }
  }

  const latest = entries[0]
  const history = entries.slice(1)

  return (
    <div
      ref={rootRef}
      className={cn('fixed z-30 print:hidden', className)}
      style={{
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
    >
      {open && latest && (
        <section
          aria-label="d20 quick-roll results"
          className="absolute bottom-full right-0 mb-2.5 w-[272px] rounded-[6px] border-2 border-ink bg-paper p-3 shadow-[0_14px_28px_-14px_rgba(40,32,25,0.55)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-cond text-xs font-bold uppercase tracking-caps text-wk-muted">
              Core Mechanic · d20
            </span>
            <button
              type="button"
              aria-label="Close roll results"
              onClick={() => setOpen(false)}
              className="flex size-6 min-h-0 min-w-0 cursor-pointer items-center justify-center rounded-[3px] text-wk-muted transition-colors hover:bg-wk-bg-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Latest roll — announced politely so screen readers hear each result. */}
          <div role="status" aria-live="polite">
            <div className="flex items-center gap-2.5">
              <span className="font-cond text-3xl font-bold leading-none text-ink">
                {latest.roll}
              </span>
              <span
                data-band={latest.band}
                className={cn(
                  'rounded-[2px] border-chrome border-ink px-1.5 py-0.5 font-cond text-xs font-bold uppercase leading-none text-ink',
                  BAND_BG[latest.band]
                )}
              >
                {CORE_ROLL_BANDS[latest.band].label}
              </span>
              <span className="ml-auto font-cond text-label font-bold uppercase text-wk-muted">
                {CORE_ROLL_BANDS[latest.band].range}
              </span>
            </div>
            <p className="mt-1.5 font-body text-xs leading-snug text-ink-2">
              {CORE_ROLL_BANDS[latest.band].summary}
            </p>
            {latest.pushNote && (
              <p className="mt-1.5 rounded-[3px] border-chrome border-status-warn bg-paper px-2 py-1.5 font-body text-xs leading-snug text-rust">
                {latest.pushNote}
              </p>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <Btn size="sm" variant="primary" onClick={handleFabClick}>
              Roll again
            </Btn>
            {onPush && !latest.pushed && (
              <Btn
                size="sm"
                variant="danger"
                title="Re-roll at the cost of +2 Heat, then a Heat Check"
                disabled={pushing}
                onClick={() => {
                  void handlePush()
                }}
              >
                {pushing ? 'Pushing…' : 'Push (+2 Heat)'}
              </Btn>
            )}
          </div>

          {history.length > 0 && (
            <ol aria-label="Recent rolls" className="mt-2.5 border-t-chrome border-wk-faint pt-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-2 py-0.5 font-body text-xs text-wk-muted"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full border border-ink',
                      BAND_BG[entry.band]
                    )}
                  />
                  <span className="w-5 text-right font-bold text-ink">{entry.roll}</span>
                  <span>{CORE_ROLL_BANDS[entry.band].label}</span>
                  {entry.pushed && (
                    <span className="ml-auto font-cond text-label font-bold uppercase">Pushed</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <button
        type="button"
        aria-label="Roll d20"
        title="Roll the Core Mechanic d20"
        onClick={handleFabClick}
        className="flex size-14 cursor-pointer items-center justify-center rounded-full border-rail border-ink bg-rust text-su-white shadow-[0_10px_22px_-10px_rgba(40,32,25,0.65)] transition-colors duration-[120ms] hover:bg-rust-hi focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25"
      >
        <Dices className="size-6" aria-hidden="true" />
      </button>
    </div>
  )
}
