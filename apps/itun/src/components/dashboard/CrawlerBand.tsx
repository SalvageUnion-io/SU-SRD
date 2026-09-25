/**
 * CrawlerBand — the Active Item while in Downtime (Phase 6): the crawler's
 * Structure, the Downtime economy verbs (Area Salvage, Craft, Scrap Mech) and
 * the Leave control. Rules run through `dashboardEconomy.ts`; the destructive
 * Scrap Mech commits through `transfer` as one all-or-nothing write (ADR-007).
 */

import type { StepRule } from 'component-lib'
import { RuleBrief } from 'component-lib'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolvePool } from 'salvageunion-reference/rules'
import { crawlerMaxSPParts } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { PlayStore } from './ActiveItemBand'
import type { ActiveItemBandModel } from './ActiveItemBandFrame'
import { ActiveItemBandFrame } from './ActiveItemBandFrame'
import {
  areaSalvageOutcome,
  craftOutcome,
  crawlerTechLevelOf,
  scrapMechOutcome,
} from './dashboardEconomy'

/** Cited when an action needs a numeric crawler Tech Level and the slug has none. */
const NO_TECH_LEVEL_RULE: StepRule = {
  rule: "This Crawler's Tech Level cannot be read, so the Tech Level of the Scrap it would find is undefined. Set a numeric Tech Level on the Crawler sheet first.",
  cite: 'Core Book · p.245',
}

/**
 * The craft picker: every System or Module craftable at the crawler's Tech
 * Level, with its Scrap cost, and the reason when one is out of reach.
 *
 * Guided Play enforces (ADR-021) and teaches while doing it, so an unaffordable
 * item is listed with its shortfall rather than hidden — a player can see what
 * to save for.
 */
function CraftBody({ crawler, store }: { crawler: Crawler; store: PlayStore }) {
  const crawlerTl = crawlerTechLevelOf(crawler) ?? 0
  const [note, setNote] = useState<string | null>(null)

  const items = [...SalvageUnionReference.Systems.all(), ...SalvageUnionReference.Modules.all()]
    .filter(
      (i): i is typeof i & { name: string; techLevel: number; salvageValue: number } =>
        typeof i.name === 'string' &&
        typeof i.techLevel === 'number' &&
        typeof i.salvageValue === 'number' &&
        i.techLevel <= crawlerTl
    )
    .sort((a, b) => a.techLevel - b.techLevel || a.name.localeCompare(b.name))

  function craft(item: { name: string; techLevel: number; salvageValue: number }) {
    const c = store.get('crawler', crawler.id) ?? crawler
    const { patch, quote, blocked } = craftOutcome(c, item)
    if (!patch) {
      setNote(
        blocked === 'tech-level'
          ? `${item.name} is Tech ${item.techLevel} — above this Crawler's Tech ${crawlerTl}.`
          : `${item.name} costs ${quote.cost} Scrap at Tech ${item.techLevel}+; the pool is ${quote.shortfall} short.`
      )
      return
    }
    runWrite(() => store.update('crawler', crawler.id, patch, DASHBOARD_TXN))
    setNote(`Crafted ${item.name} for ${quote.cost} Scrap — it is in the Hold.`)
  }

  if (items.length === 0) {
    return <p className="pc-resolve-log">Nothing is craftable at Tech {crawlerTl}.</p>
  }

  return (
    <div className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
      {note ? <p className="pc-resolve-log">{note}</p> : null}
      {items.slice(0, 40).map((item) => (
        <button
          key={`${item.techLevel}-${item.name}`}
          type="button"
          onClick={() => craft(item)}
          className="flex items-center justify-between gap-3 rounded-card border border-ink/20 px-2 py-1 text-left text-caption hover:bg-ink-8"
        >
          <span>{item.name}</span>
          <span className="shrink-0 tabular-nums opacity-70">
            T{item.techLevel} · {item.salvageValue} Scrap
          </span>
        </button>
      ))}
    </div>
  )
}

/** Downtime economy prompts the crawler band can raise. */
type EconPrompt =
  | { kind: 'salvage'; log: string }
  | { kind: 'craft' }
  | { kind: 'scrap'; total: number; skipped: number }
  | { kind: 'blocked'; rule: StepRule }
  | null

export function CrawlerBand({
  crawler,
  mech,
  store,
  onLeave,
}: {
  crawler: Crawler
  mech: Mech
  store: PlayStore
  onLeave: () => void
}) {
  const spParts = crawlerMaxSPParts(crawler)
  const maxSP = spParts.total
  const sp = resolvePool(crawler.currentSP, maxSP)
  const [prompt, setPrompt] = useState<EconPrompt>(null)
  const crawlerTl = crawlerTechLevelOf(crawler)

  const fresh = () => store.get('crawler', crawler.id) ?? crawler

  /** Area Salvage (p.245) — roll, report, and deposit any scrap found. */
  function doSalvage() {
    const c = fresh()
    const { result, patch } = areaSalvageOutcome(c, {
      areaTl: crawlerTl ?? 1,
      roll: defaultRoll,
    })
    if (patch)
      runWrite(
        () => store.update('crawler', crawler.id, patch, DASHBOARD_TXN),
        () =>
          setPrompt({
            kind: 'salvage',
            log: result.requiresPlayerChoice
              ? `${result.roll}: ${result.label} — pick a Damaged Chassis, System or Module at Tech ${result.areaTl}.`
              : result.scrapQty > 0
                ? `${result.roll}: ${result.label} — ${result.scrapQty} Tech ${result.areaTl} Scrap into the pool.`
                : `${result.roll}: ${result.label}.`,
          })
      )
  }

  /**
   * Scrap the mech into the crawler's pool. Cross-entity and destructive, so it
   * commits through `transfer` (all-or-nothing) and only after the player has
   * confirmed — ADR-007 keeps the destructive half an explicit call.
   */
  function doScrap() {
    const c = fresh()
    const m = store.get('mech', mech.id) ?? mech
    const { breakdown, crawlerPatch, mechPatch } = scrapMechOutcome(m, c)
    runWrite(() =>
      store.transfer(
        {
          updates: [
            { type: 'crawler', id: crawler.id, patch: crawlerPatch },
            { type: 'mech', id: mech.id, patch: mechPatch },
          ],
        },
        DASHBOARD_TXN
      )
    )
    setPrompt({ kind: 'scrap', total: breakdown.total, skipped: breakdown.skipped.length })
  }

  const overlay = ((): ActiveItemBandModel['overlay'] => {
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'blocked') {
      return {
        title: 'Blocked by a rule',
        onClose,
        body: <RuleBrief rule={prompt.rule.rule} cite={prompt.rule.cite} />,
        actions: [{ label: 'Got it', onClick: onClose, variant: 'go' }],
      }
    }
    if (prompt.kind === 'salvage') {
      return {
        title: 'Area Salvage',
        onClose,
        body: <p className="pc-resolve-log">{prompt.log}</p>,
      }
    }
    if (prompt.kind === 'scrap') {
      return {
        title: 'Mech Scrapped',
        onClose,
        body: (
          <p className="pc-resolve-log">
            {prompt.total} Scrap into the pool
            {prompt.skipped > 0 ? `; ${prompt.skipped} component(s) yielded nothing.` : '.'}
          </p>
        ),
      }
    }
    return { title: 'Craft', onClose, body: <CraftBody crawler={crawler} store={store} /> }
  })()

  const view: ActiveItemBandModel = {
    fam: 'crawler',
    stampLabel: 'Downtime',
    overlay,
    bays: [
      {
        label: 'Crawler',
        gauges: [{ label: 'SP', value: sp, max: maxSP, tone: 'crawler' }],
        buttons: [
          {
            label: 'Salvage',
            onClick: () =>
              crawlerTl === undefined
                ? setPrompt({ kind: 'blocked', rule: NO_TECH_LEVEL_RULE })
                : doSalvage(),
            title: 'Roll Area Salvage and deposit what you find',
          },
          { label: 'Craft', onClick: () => setPrompt({ kind: 'craft' }), title: 'Craft an item' },
        ],
      },
      {
        label: 'Downtime',
        buttons: [
          {
            label: 'Scrap Mech',
            onClick: doScrap,
            variant: 'danger',
            title: 'Break the mech down into Scrap — destructive',
          },
          {
            label: '◄ Leave Downtime',
            onClick: onLeave,
            wide: true,
            title: 'Return to the previous mount',
          },
        ],
      },
    ],
  }
  return <ActiveItemBandFrame view={view} />
}
