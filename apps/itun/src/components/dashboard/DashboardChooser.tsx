/**
 * DashboardChooser — the launch chooser wizard for the Dashboard (plan §8, §9.8).
 *
 * A small three-step wizard (pilot → mech → crawler) rendered in a ModalShell.
 * On confirm it ensures the SoftLinks the Dashboard composition needs exist —
 * `mech-to-pilot` (chosen mech → chosen pilot) and, when a crawler is picked,
 * `pilot-to-crawler` (chosen pilot → chosen crawler) — then launches
 * `/dashboard/$id` for the chosen mech.
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
import { Button, ModalShell, FieldError } from 'component-lib'

import { useCrawlers, useMechs, usePilots, useSoftLinkList } from '../../hooks/queries'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { MechPattern } from '../../lib/schemas/pattern'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { cn } from '../../lib/utils'
import type { LinkWriteStore } from './dashboardLinks'
import { ensureDashboardLinks } from './dashboardLinks'
import {
  createBaseCrawler,
  DEFAULT_CRAWLER_TLS,
  instantiateMechFromPattern,
  parseSelToken,
  patternToken,
  tlCrawlerToken,
  type LaunchStore,
} from './dashboardLaunch'

type DashboardChooserProps = {
  /** Inject to avoid the Zustand global in tests. Needs SoftLink writes (links)
   *  plus mech/crawler create (stand-in mech / default crawler). */
  store?: LinkWriteStore & LaunchStore
  /** Inject to avoid the router in tests; receives the (possibly new) mech id. */
  onLaunch?: (mechId: string) => void
  /**
   * Pre-seed the crew picker from a launching pilot/mech sheet (P4.4): the
   * seeded entity is pre-selected and the picker opens on the first still-empty
   * step. Omit on the Roster chooser (start empty at the pilot step).
   *
   * A pilot sheet seeds its whole linked crew — the pilot plus, when present,
   * its assigned mech and home crawler — so launching from a pilot with a mech
   * and crawler lands on the ready-to-launch crawler step with all three
   * pre-selected.
   */
  initialPilotId?: string
  initialMechId?: string
  initialCrawlerId?: string
  /**
   * Scope the pilot/mech/crawler pickers to the current workspace: a workspace
   * id shows only that workspace's entities. Unset = unscoped (all saved
   * entities) — the tests' default and a safe fallback for an entity with no
   * workspace. Stand-in mech patterns and default-TL crawler tokens carry no
   * workspace, so they are always offered.
   */
  activeWorkspaceId?: string
  /** Button label — defaults to "Launch Dashboard". */
  label?: string
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

export function DashboardChooser({
  store,
  onLaunch,
  initialPilotId,
  initialMechId,
  initialCrawlerId,
  activeWorkspaceId,
  label = 'Launch Dashboard',
  className,
}: DashboardChooserProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('pilot')
  const [pilotId, setPilotId] = useState('')
  const [mechId, setMechId] = useState('')
  const [crawlerId, setCrawlerId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allPilots: Pilot[] = usePilots()
  const allMechs: Mech[] = useMechs()
  const allCrawlers: Crawler[] = useCrawlers()
  const links: SoftLink[] = useSoftLinkList()

  // Scope the pickers to the chosen workspace so the chooser can only launch
  // entities that workspace holds. Prop omitted = unscoped (tests / no-workspace
  // fallback); an id = that workspace only.
  const inScope = <T extends { workspaceId?: string }>(list: T[]): T[] => {
    if (activeWorkspaceId === undefined) return list
    return list.filter((e) => e.workspaceId === activeWorkspaceId)
  }
  const pilots = inScope(allPilots)
  const mechs = inScope(allMechs)
  const crawlers = inScope(allCrawlers)
  // Saved patterns → stand-in mechs (list() lazily hydrates, mirroring PatternList).
  const patterns: MechPattern[] = usePatternStore((s) => s.mechPatterns)
  usePatternStore.getState().list()
  // useRouter can be probed without a mounted router (warn:false) so tests that
  // omit onLaunch don't throw; production always has the router.
  const router = useRouter({ warn: false })

  function openDialog() {
    // Pre-seed from a launching sheet (P4.4); open on the first empty step.
    // The crawler is optional, so it never advances the opening step past the
    // (still-required) pilot/mech — a fully-seeded crew lands on the crawler
    // step ready to launch.
    const seedPilot = initialPilotId ?? ''
    const seedMech = initialMechId ?? ''
    setPilotId(seedPilot)
    setMechId(seedMech)
    setCrawlerId(initialCrawlerId ?? '')
    setStep(seedPilot === '' ? 'pilot' : seedMech === '' ? 'mech' : 'crawler')
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
      // Cast mirrors Sheet.tsx's EntityLookup: the store's generic create/delete
      // satisfy this narrowed surface at runtime; TS can't align the generics.
      const writeStore: LinkWriteStore & LaunchStore =
        store ?? (useEntityStore.getState() as unknown as LinkWriteStore & LaunchStore)

      // Resolve the mech choice: a pattern token instantiates a stand-in mech
      // first; a plain id is an existing mech.
      const mechSel = parseSelToken(mechId)
      let launchMechId = mechSel.value
      if (mechSel.kind === 'pattern') {
        const pattern = patterns.find((p) => p.id === mechSel.value)
        if (!pattern) throw new Error('That pattern is no longer available.')
        launchMechId = await instantiateMechFromPattern(writeStore, pattern)
      }

      // Resolve the crawler choice: a "tl:" token creates a default base crawler;
      // a plain id is an existing crawler; empty = none.
      const crawlerSel = crawlerId ? parseSelToken(crawlerId) : null
      let launchCrawlerId: string | undefined
      if (crawlerSel) {
        launchCrawlerId =
          crawlerSel.kind === 'tl'
            ? await createBaseCrawler(writeStore, Number(crawlerSel.value))
            : crawlerSel.value
      }

      await ensureDashboardLinks({
        store: writeStore,
        links,
        pilotId,
        mechId: launchMechId,
        crawlerId: launchCrawlerId,
      })
      setOpen(false)
      if (onLaunch) {
        onLaunch(launchMechId)
      } else if (router) {
        void router.navigate({ to: '/dashboard/$id', params: { id: launchMechId } })
      } else {
        window.location.assign(`/dashboard/${launchMechId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch the Dashboard.')
    } finally {
      setPending(false)
    }
  }

  const stepTitle =
    step === 'pilot' ? 'Choose a pilot' : step === 'mech' ? 'Choose a mech' : 'Choose a crawler'

  return (
    <>
      <Button
        size="sm"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Launch the Dashboard"
      >
        {label}
      </Button>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title="Launch Dashboard"
        subtitle={`Step ${stepIndex + 1} of 3 · ${stepTitle}`}
        headerBg="bg-su-orange"
        maxWidth="max-w-md"
        align="center"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          {step === 'pilot' && (
            <ChooserList
              name="dashboard-pilot"
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
              name="dashboard-mech"
              emptyMessage="No mechs or patterns yet. Create a mech or save a pattern first."
              selectedId={mechId}
              onSelect={setMechId}
              options={[
                ...mechs.map((m) => ({
                  id: m.id,
                  label: m.name,
                  sublabel: chassisMeta(m.chassisRef),
                })),
                ...patterns.map((p) => ({
                  id: patternToken(p.id),
                  label: p.name,
                  sublabel: `Pattern · stand-in${p.chassisRef ? ` · ${chassisMeta(p.chassisRef) ?? ''}` : ''}`,
                })),
              ]}
            />
          )}

          {step === 'crawler' && (
            <>
              <p className="font-body text-xs text-wk-muted">
                Optional — launch on foot / in the mech without a crawler, or anchor to one.
              </p>
              <ChooserList
                name="dashboard-crawler"
                emptyMessage="No crawlers yet — pick a default base crawler or launch without one."
                selectedId={crawlerId}
                onSelect={setCrawlerId}
                includeNone
                options={[
                  ...crawlers.map((c) => ({
                    id: c.id,
                    label: c.name,
                    sublabel: c.techLevel ? `TL ${c.techLevel.replace(/[^0-9]/g, '')}` : undefined,
                  })),
                  ...DEFAULT_CRAWLER_TLS.map((tl) => ({
                    id: tlCrawlerToken(tl),
                    label: `Default base crawler`,
                    sublabel: `New · TL ${tl}`,
                  })),
                ]}
              />
            </>
          )}

          {error && <FieldError>{error}</FieldError>}

          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={stepIndex === 0 ? closeDialog : goBack}
              disabled={pending}
            >
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step === 'crawler' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleLaunch()}
                disabled={pending}
                aria-label="Launch the Dashboard for the chosen crew"
              >
                {pending ? 'Launching…' : 'Launch'}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={goNext} disabled={pending}>
                Next
              </Button>
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
