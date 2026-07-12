/**
 * CockpitChooser — the launch chooser wizard for the Play Cockpit (plan §8, §9.8).
 *
 * A small three-step wizard (pilot → mech → crawler) rendered in a ModalShell.
 * On confirm it ensures the SoftLinks the cockpit composition needs exist —
 * `mech-to-pilot` (chosen mech → chosen pilot) and, when a crawler is picked,
 * `pilot-to-crawler` (chosen pilot → chosen crawler) — then launches
 * `/play/$id` for the chosen mech.
 *
 * SoftLink writes go through the Zustand entityStore (write-through to
 * IndexedDB), reusing the same `softLink` create/delete the wiring components
 * (`useSoftLinks` / AssignPilotToMech) use. Creating/repairing links is
 * reversible bookkeeping and auto-applies (ADR-007); nothing destructive to a
 * pilot/mech/crawler record happens here.
 *
 * Deferred (noted in plan §8, §10.5 "Stand-in mech / default crawler
 * persistence"): instantiating an ephemeral stand-in mech from a `mechPattern`,
 * and building a default base crawler from a chosen Tech Level. The chooser
 * lists only already-saved entities; the crawler step is optional (launch a
 * mech + pilot without a crawler).
 *
 * `store` / `onLaunch` are injectable for tests (dep-injection, no router or
 * global Zustand mock needed). In production both fall back to the real store
 * and the TanStack router.
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn, ModalShell } from 'suref-react'

import { useCrawlers, useMechs, usePilots, useSoftLinkList } from '../../hooks/queries'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import { useEntityStore } from '../../stores/entityStore'
import { cn } from '../../lib/utils'
import type { LinkWriteStore } from './cockpitLinks'
import { ensureCockpitLinks } from './cockpitLinks'

type CockpitChooserProps = {
  /** Inject to avoid the Zustand global in tests. */
  store?: LinkWriteStore
  /** Inject to avoid the router in tests; receives the chosen mech id. */
  onLaunch?: (mechId: string) => void
  className?: string
}

type Step = 'pilot' | 'mech' | 'crawler'
const STEP_ORDER: readonly Step[] = ['pilot', 'mech', 'crawler']

/** Chassis "TL n" annotation for a mech row, best-effort. */
function chassisMeta(chassisRef: string): string | undefined {
  try {
    const all = SalvageUnionReference.Chassis.all() as ReadonlyArray<{
      name: string
      techLevel?: number
    }>
    const c = all.find((x) => x.name === chassisRef)
    if (!c) return chassisRef || undefined
    return c.techLevel != null ? `${c.name} · TL ${c.techLevel}` : c.name
  } catch {
    return chassisRef || undefined
  }
}

export function CockpitChooser({ store, onLaunch, className }: CockpitChooserProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('pilot')
  const [pilotId, setPilotId] = useState('')
  const [mechId, setMechId] = useState('')
  const [crawlerId, setCrawlerId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pilots: Pilot[] = usePilots()
  const mechs: Mech[] = useMechs()
  const crawlers: Crawler[] = useCrawlers()
  const links: SoftLink[] = useSoftLinkList()
  // useRouter can be probed without a mounted router (warn:false) so tests that
  // omit onLaunch don't throw; production always has the router.
  const router = useRouter({ warn: false })

  function openDialog() {
    setStep('pilot')
    setPilotId('')
    setMechId('')
    setCrawlerId('')
    setError(null)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setError(null)
  }

  const stepIndex = STEP_ORDER.indexOf(step)

  function goBack() {
    setError(null)
    const prev = STEP_ORDER[stepIndex - 1]
    if (prev) setStep(prev)
  }

  function goNext() {
    if (step === 'pilot' && !pilotId) {
      setError('Select a pilot to continue.')
      return
    }
    if (step === 'mech' && !mechId) {
      setError('Select a mech to continue.')
      return
    }
    setError(null)
    const next = STEP_ORDER[stepIndex + 1]
    if (next) setStep(next)
  }

  async function handleLaunch() {
    if (!pilotId || !mechId) {
      setError('Pick a pilot and a mech before launching.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const writeStore: LinkWriteStore = store ?? useEntityStore.getState()
      await ensureCockpitLinks({
        store: writeStore,
        links,
        pilotId,
        mechId,
        crawlerId: crawlerId || undefined,
      })
      setOpen(false)
      if (onLaunch) {
        onLaunch(mechId)
      } else if (router) {
        void router.navigate({ to: '/play/$id', params: { id: mechId } })
      } else {
        window.location.assign(`/play/${mechId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch the cockpit.')
    } finally {
      setPending(false)
    }
  }

  const stepTitle =
    step === 'pilot' ? 'Choose a pilot' : step === 'mech' ? 'Choose a mech' : 'Choose a crawler'

  return (
    <>
      <Btn
        size="sm"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Launch the Play Cockpit"
      >
        Launch Cockpit
      </Btn>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title="Launch Cockpit"
        subtitle={`Step ${stepIndex + 1} of 3 · ${stepTitle}`}
        headerBg="bg-su-orange"
        maxWidth="max-w-md"
        align="center"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          {step === 'pilot' && (
            <ChooserList
              name="cockpit-pilot"
              emptyMessage="No pilots yet. Create a pilot first."
              selectedId={pilotId}
              onSelect={setPilotId}
              options={pilots.map((p) => ({
                id: p.id,
                label: p.name,
                sublabel: p.callsign ? `“${p.callsign}”` : undefined,
              }))}
            />
          )}

          {step === 'mech' && (
            <ChooserList
              name="cockpit-mech"
              emptyMessage="No mechs yet. Create a mech first."
              selectedId={mechId}
              onSelect={setMechId}
              options={mechs.map((m) => ({
                id: m.id,
                label: m.name,
                sublabel: chassisMeta(m.chassisRef),
              }))}
            />
          )}

          {step === 'crawler' && (
            <>
              <p className="font-body text-xs text-wk-muted">
                Optional — launch on foot / in the mech without a crawler, or anchor to one.
              </p>
              <ChooserList
                name="cockpit-crawler"
                emptyMessage="No crawlers yet — you can still launch without one."
                selectedId={crawlerId}
                onSelect={setCrawlerId}
                includeNone
                options={crawlers.map((c) => ({
                  id: c.id,
                  label: c.name,
                  sublabel: c.techLevel ? `TL ${c.techLevel.replace(/[^0-9]/g, '')}` : undefined,
                }))}
              />
            </>
          )}

          {error && (
            <p className="font-body text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-2">
            <Btn
              variant="ghost"
              size="sm"
              onClick={stepIndex === 0 ? closeDialog : goBack}
              disabled={pending}
            >
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </Btn>
            {step === 'crawler' ? (
              <Btn
                variant="primary"
                size="sm"
                onClick={() => void handleLaunch()}
                disabled={pending}
                aria-label="Launch the cockpit for the chosen crew"
              >
                {pending ? 'Launching…' : 'Launch'}
              </Btn>
            ) : (
              <Btn variant="primary" size="sm" onClick={goNext} disabled={pending}>
                Next
              </Btn>
            )}
          </div>
        </div>
      </ModalShell>
    </>
  )
}

// ---------------------------------------------------------------------------
// Radio list (shares the SelectorDialog visual grammar; inlined so the wizard
// keeps one modal across steps rather than stacking three dialogs).
// ---------------------------------------------------------------------------

type ChooserOption = { id: string; label: string; sublabel?: string }

function ChooserList({
  name,
  options,
  emptyMessage,
  selectedId,
  onSelect,
  includeNone = false,
}: {
  name: string
  options: ChooserOption[]
  emptyMessage: string
  selectedId: string
  onSelect: (id: string) => void
  /** Add a leading "None" radio (crawler step). */
  includeNone?: boolean
}) {
  if (options.length === 0 && !includeNone) {
    return <p className="font-body text-sm text-wk-muted">{emptyMessage}</p>
  }
  const rows: ChooserOption[] = includeNone ? [{ id: '', label: 'None' }, ...options] : options
  return (
    <div className="space-y-2">
      {options.length === 0 && <p className="font-body text-sm text-wk-muted">{emptyMessage}</p>}
      {rows.map((option) => (
        <label
          key={option.id || '__none__'}
          className="flex cursor-pointer items-center gap-2 rounded-[3px] border-chrome border-ink bg-paper p-2 hover:bg-wk-bg-2"
        >
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={selectedId === option.id}
            onChange={() => onSelect(option.id)}
            className="accent-rust"
          />
          <span className="font-body text-sm font-medium text-ink">{option.label}</span>
          {option.sublabel && (
            <span className="font-body text-xs text-wk-muted">{option.sublabel}</span>
          )}
        </label>
      ))}
    </div>
  )
}
