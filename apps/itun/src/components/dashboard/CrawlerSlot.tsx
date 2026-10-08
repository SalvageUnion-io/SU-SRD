/**
 * CrawlerSlot — the crawler in the slot row, in its two forms
 * (docs/architecture/dashboard-redesign.md D2, D3):
 *
 *  - `CrawlerMajor`, in Downtime: Hull (SP, Tech Level), Stores (the scrap
 *    pool, Salvage, Craft) and Bays (each one's condition), with Upkeep,
 *    Upgrade and Scrap a mech in a narrow side column.
 *  - `CrawlerMinor`, the rest of the time: SP, Tech Level and the scrap pool,
 *    with a damaged bay in red.
 *
 * A Game's crawler is the Mediator's (D11). Only the Mediator gets the verbs;
 * a player sees the numbers and the bays and asks at the table. Until the
 * server enforces it (plan layer 8) this only hides the controls.
 *
 * Rules run through `dashboardEconomy.ts`; the destructive Scrap Mech commits
 * through `transfer` as one all-or-nothing write (ADR-007).
 */

import type { StepRule } from 'component-lib'
import { RuleBrief } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { rollDie } from 'salvageunion-reference/rules'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { crawlerUpgradeQuote, UPKEEP_SCRAP } from '../../lib/rules/crawlerEconomy'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import {
  areaSalvageOutcome,
  craftOutcome,
  crawlerTechLevelOf,
  scrapMechOutcome,
} from './dashboardEconomy'
import type { BandBay, MajorModel } from './MajorFrame'
import { MajorFrame } from './MajorFrame'
import { MinorFrame } from './MinorFrame'
import type { PlayStore } from './SlotRow'
import { bayConditions, crawlerMinorModel, hullGauge, scrapLine } from './slotModels'

export function CrawlerMinor({
  crawler,
  onExpand,
}: {
  crawler: Crawler
  onExpand: (trigger: HTMLButtonElement) => void
}) {
  return <MinorFrame view={crawlerMinorModel(crawler)} slot="Crawler" onExpand={onExpand} />
}

const CRAFT_LIST: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  maxHeight: '40vh',
  overflowY: 'auto',
}

const CRAFT_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
}

const CRAFT_COST: CSSProperties = {
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.7,
}

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
    <div style={CRAFT_LIST}>
      {note ? <p className="pc-resolve-log">{note}</p> : null}
      {items.slice(0, 40).map((item) => (
        <button
          key={`${item.techLevel}-${item.name}`}
          type="button"
          onClick={() => craft(item)}
          className="pc-srd-row"
          style={CRAFT_ROW}
        >
          <span>{item.name}</span>
          <span style={CRAFT_COST}>
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

export function CrawlerMajor({
  crawler,
  mech,
  store,
  mediator,
  stampLabel,
}: {
  crawler: Crawler
  /** The mech Scrap Mech breaks down: the pilot's own, or null with none. */
  mech: Mech | null
  store: PlayStore
  /** The viewer is the Game's Mediator, who alone runs the crawler (D11). */
  mediator: boolean
  /** "Downtime" in the slot row; what the crawler is doing, through ⤢. */
  stampLabel: string
}) {
  const [prompt, setPrompt] = useState<EconPrompt>(null)
  const crawlerTl = crawlerTechLevelOf(crawler)

  const fresh = () => store.get('crawler', crawler.id) ?? crawler

  /** Area Salvage (p.245) — roll, report, and deposit any scrap found. */
  function doSalvage() {
    const c = fresh()
    const { result, patch } = areaSalvageOutcome(c, {
      areaTl: crawlerTl ?? 1,
      roll: rollDie,
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
  function doScrap(target: Mech) {
    const c = fresh()
    const m = store.get('mech', target.id) ?? target
    const { breakdown, crawlerPatch, mechPatch } = scrapMechOutcome(m, c)
    runWrite(() =>
      store.transfer(
        {
          updates: [
            { type: 'crawler', id: crawler.id, patch: crawlerPatch },
            { type: 'mech', id: target.id, patch: mechPatch },
          ],
        },
        DASHBOARD_TXN
      )
    )
    setPrompt({ kind: 'scrap', total: breakdown.total, skipped: breakdown.skipped.length })
  }

  const overlay = ((): MajorModel['overlay'] => {
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

  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  const upgrade =
    crawlerTl === undefined ? null : crawlerUpgradeQuote(crawlerTl, crawler.upgradePool ?? 0)

  const hull: BandBay = {
    label: 'Hull',
    gauges: [hullGauge(crawler)],
    lines: [
      {
        text: [type?.name, crawlerTl === undefined ? 'Tech Level ?' : `Tech Level ${crawlerTl}`]
          .filter(Boolean)
          .join(' · '),
      },
    ],
    buttons: [],
  }
  const stores: BandBay = {
    label: 'Stores',
    lines: [
      { text: scrapLine(crawler) },
      ...(mediator ? [] : [{ text: 'The Mediator runs the crawler. Ask at the table.' }]),
    ],
    buttons: mediator
      ? [
          {
            label: 'Salvage',
            onClick: () =>
              crawlerTl === undefined
                ? setPrompt({ kind: 'blocked', rule: NO_TECH_LEVEL_RULE })
                : doSalvage(),
            title: 'Roll Area Salvage and deposit what you find',
          },
          { label: 'Craft', onClick: () => setPrompt({ kind: 'craft' }), title: 'Craft an item' },
        ]
      : [],
  }
  const bays = bayConditions(crawler)
  const bayBay: BandBay = {
    label: 'Bays',
    chips: bays.map((b) => ({ text: b.damaged ? `${b.name} damaged` : b.name, warn: b.damaged })),
    lines: bays.length === 0 ? [{ text: 'No bays installed.' }] : undefined,
    buttons: [],
  }
  // The side column: what this Downtime costs, how close the next Tech Level
  // is, and the one destructive verb.
  const upkeep: BandBay = {
    label: 'Upkeep',
    side: true,
    lines: [
      {
        text:
          crawlerTl === undefined
            ? `${UPKEEP_SCRAP} Scrap per Downtime`
            : `${UPKEEP_SCRAP} Tech ${crawlerTl} Scrap per Downtime`,
      },
    ],
    buttons: [],
  }
  const upgradeBay: BandBay = {
    label: 'Upgrade',
    side: true,
    lines: [
      {
        text:
          upgrade === null
            ? 'No further Tech Level'
            : `Pool ${crawler.upgradePool ?? 0}/${upgrade.cost} to Tech ${upgrade.toTl}`,
      },
    ],
    buttons: [],
  }
  // Scrap needs a mech to break down; a pilot with none has nothing to offer.
  const scrap: BandBay[] =
    mediator && mech !== null
      ? [
          {
            label: 'Scrap a mech',
            side: true,
            columns: 1,
            buttons: [
              {
                label: 'Scrap Mech',
                onClick: () => doScrap(mech),
                variant: 'danger',
                title: `Break ${mech.name} down into Scrap — destructive`,
              },
            ],
          },
        ]
      : []

  const view: MajorModel = {
    fam: 'crawler',
    stampLabel,
    overlay,
    bays: [hull, stores, bayBay, upkeep, upgradeBay, ...scrap],
  }
  return <MajorFrame view={view} />
}
