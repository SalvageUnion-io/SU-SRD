/**
 * DowntimeControl — the one-click Downtime runner on the crawler sheet
 * (design-review R-2; Core Book p.227-228).
 *
 * Wires the pure lib/rules/downtime.ts module (scope resolution + per-entity
 * patches) into a workspace-scoped checklist: restore mechs → repair → heal
 * pilots per Med Bay band → +1 TP → recharge Uses → clear once-per-Downtime
 * flags, then a prompt for Upkeep (the separate R-4 economy action behind
 * the UPKEEP lozenge on the hero).
 *
 * ADR-007 automation boundary: every step is deterministic bookkeeping the
 * player can individually skip via its checkbox before applying — nothing
 * random, no narrative calls. Bay gates apply per the book: a Damaged (or
 * missing) Mech Bay blocks restore + repair (p.221); a Damaged or missing
 * Med Bay blocks HP/injury healing while AP still rests back (p.223/p.228).
 * Destroyed mechs and Destroyed items are never resurrected.
 *
 * Scope = the crawler's crew over the SoftLink graph (pilot-to-crawler links
 * plus each crew pilot's mech). Writes go through the entity store one
 * entity at a time (ADR-008 sequential mutations), each patch computed from
 * the freshest record.
 */

import { useId, useState } from 'react'
import { Btn, ModalShell } from 'suref-react'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import {
  DOWNTIME_UPKEEP_SCRAP,
  allDowntimeSteps,
  downtimeMechPatch,
  downtimePilotPatch,
  mechBayStatus,
  medBayStatus,
  resolveDowntimeScope,
} from '../../lib/rules/downtime'
import type { DowntimeStepKey, DowntimeSteps } from '../../lib/rules/downtime'
import type { Crawler } from '../../lib/schemas/crawler'
import { useEntityStore } from '../../stores/entityStore'

type DowntimeControlProps = {
  crawler: Crawler
  /** Injectable store — defaults to useEntityStore. */
  store?: typeof useEntityStore
}

type StepCopy = {
  label: string
  detail: string
}

const STEP_COPY: Record<DowntimeStepKey, StepCopy> = {
  restoreMechs: {
    label: 'Restore Mechs',
    detail: 'SP & EP to full, Heat to 0 — in the Mech Bay (p.221)',
  },
  repairItems: {
    label: 'Repair Damaged items',
    detail: 'chassis, Systems & Modules at Tech ≤ the crawler (p.228)',
  },
  healPilots: {
    label: 'Rest Pilots',
    detail: 'AP restores; HP heals at an operational Med Bay (p.223)',
  },
  healInjuries: {
    label: 'Heal injuries',
    detail: 'Med Bay bands: Tech 3+ Minor, Tech 5+ Major (p.223)',
  },
  trainPilots: {
    label: 'Train Pilots',
    detail: '+1 Training Point each (p.228)',
  },
  rechargeUses: {
    label: 'Recharge Uses',
    detail: 'Uses (X) counters refill after Downtime',
  },
  clearUsed: {
    label: 'Clear once-per-Downtime flags',
    detail: 'used abilities + Background / Keepsake / Motto',
  },
}

export function DowntimeControl({ crawler, store = useEntityStore }: DowntimeControlProps) {
  const storeState = store()
  const checklistId = useId()
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<DowntimeSteps>(allDowntimeSteps)
  const [pending, setPending] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const medBay = medBayStatus(crawler)
  const mechBay = mechBayStatus(crawler)
  // Scope over the live store lists (lazily hydrated before the dialog opens).
  const scope = resolveDowntimeScope({
    crawler,
    pilots: storeState.list('pilot'),
    mechs: storeState.list('mech'),
    links: storeState.softLinks,
  })
  const emptyScope = scope.pilots.length === 0 && scope.mechs.length === 0

  /** Open: hydrate the full scope first so the crew lists are complete. */
  async function handleOpen() {
    await Promise.all([
      storeState.hydrate('pilot'),
      storeState.hydrate('mech'),
      storeState.hydrate('softLink'),
    ])
    setSteps(allDowntimeSteps())
    setSummary(null)
    setOpen(true)
  }

  /**
   * Apply every enabled step to the crew: one write per entity whose patch
   * is non-empty, each computed from the freshest record (ADR-008).
   */
  async function handleApply() {
    if (pending) return
    setPending(true)
    try {
      const freshCrawler = storeState.get('crawler', crawler.id) ?? crawler
      const tlNow = parseCrawlerTechLevel(freshCrawler.techLevel) ?? 1
      const medBayNow = medBayStatus(freshCrawler)
      const mechBayNow = mechBayStatus(freshCrawler)
      const scopeNow = resolveDowntimeScope({
        crawler: freshCrawler,
        pilots: storeState.list('pilot'),
        mechs: storeState.list('mech'),
        links: storeState.softLinks,
      })

      let mechWrites = 0
      for (const mech of scopeNow.mechs) {
        const fresh = storeState.get('mech', mech.id) ?? mech
        const patch = downtimeMechPatch(fresh, tlNow, steps, mechBayNow)
        if (Object.keys(patch).length > 0) {
          await storeState.update('mech', mech.id, patch)
          mechWrites += 1
        }
      }
      let pilotWrites = 0
      for (const pilot of scopeNow.pilots) {
        const fresh = storeState.get('pilot', pilot.id) ?? pilot
        const patch = downtimePilotPatch(fresh, medBayNow, steps)
        if (Object.keys(patch).length > 0) {
          await storeState.update('pilot', pilot.id, patch)
          pilotWrites += 1
        }
      }
      setSummary(
        `Downtime applied — ${pilotWrites} of ${scopeNow.pilots.length} ` +
          `${scopeNow.pilots.length === 1 ? 'pilot' : 'pilots'} and ${mechWrites} of ` +
          `${scopeNow.mechs.length} ${scopeNow.mechs.length === 1 ? 'mech' : 'mechs'} updated.`
      )
    } finally {
      setPending(false)
    }
  }

  function toggleStep(key: DowntimeStepKey, next: boolean) {
    setSteps((prev) => ({ ...prev, [key]: next }))
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Btn
        size="sm"
        variant="primary"
        title="Run the p.227-228 Downtime checklist for this crawler's crew."
        onClick={() => {
          void handleOpen()
        }}
      >
        Run Downtime
      </Btn>
      <p className="m-0 font-body text-xs text-wk-muted">
        One week at the crawler: restore &amp; repair mechs, heal and train the crew, recharge Uses
        — then pay Upkeep.
      </p>

      {open && (
        <ModalShell
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false)
          }}
          title="Downtime"
          subtitle={`${crawler.name} · Tech ${tl} · ${scope.pilots.length} crew / ${scope.mechs.length} ${scope.mechs.length === 1 ? 'mech' : 'mechs'}`}
          maxWidth="max-w-md"
          align="center"
        >
          <div className="flex flex-col gap-4 bg-paper p-5">
            {emptyScope ? (
              <p className="m-0 font-body text-sm text-wk-muted">
                No crew is linked to this crawler yet — link pilots (and their mechs) to run their
                Downtime from here.
              </p>
            ) : (
              <>
                <p className="m-0 font-body text-sm text-wk-muted">
                  Every step is deterministic bookkeeping — untick anything the table rules
                  differently, then apply.
                </p>

                {!mechBay.operational && (
                  <p
                    role="alert"
                    className="m-0 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2 font-body text-sm text-rust"
                  >
                    {mechBay.present
                      ? 'The Mech Bay is Damaged — mechs cannot restore SP/EP or be repaired until it is repaired (p.221).'
                      : 'No Mech Bay is installed — mechs cannot restore SP/EP or be repaired this Downtime.'}
                  </p>
                )}
                {!medBay.operational && (
                  <p
                    role="alert"
                    className="m-0 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2 font-body text-sm text-rust"
                  >
                    {medBay.present
                      ? 'The Med Bay is Damaged — pilot HP and injuries cannot heal until it is repaired (p.223). AP still rests back.'
                      : 'No Med Bay is installed — pilot HP and injuries cannot heal this Downtime. AP still rests back.'}
                  </p>
                )}

                <fieldset
                  aria-labelledby={checklistId}
                  className="m-0 flex flex-col gap-2 border-0 p-0"
                  disabled={summary !== null}
                >
                  <legend id={checklistId} className="sr-only">
                    Downtime steps
                  </legend>
                  {(Object.keys(STEP_COPY) as DowntimeStepKey[]).map((key) => (
                    <label
                      key={key}
                      className="flex items-start gap-2 font-cond text-xs font-bold uppercase text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={steps[key]}
                        onChange={(e) => toggleStep(key, e.target.checked)}
                        className="mt-0.5 accent-rust"
                      />
                      <span className="flex flex-col gap-0.5">
                        {STEP_COPY[key].label}
                        <span className="font-body text-xs font-normal normal-case text-wk-muted">
                          {STEP_COPY[key].detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}

            {summary && (
              <div className="flex flex-col gap-2">
                <p role="status" className="m-0 font-body text-sm text-ink">
                  {summary}
                </p>
                <p className="m-0 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2 font-body text-sm text-rust">
                  Downtime ends with Upkeep: {DOWNTIME_UPKEEP_SCRAP}× Tech {tl} Scrap — pay it from
                  the UPKEEP lozenge on the crawler hero (or roll Deterioration).
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {summary ? 'Done' : 'Cancel'}
              </Btn>
              {!summary && !emptyScope && (
                <Btn
                  variant="primary"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    void handleApply()
                  }}
                >
                  {pending ? 'Applying…' : 'Apply Downtime'}
                </Btn>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
