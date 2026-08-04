/**
 * ActiveItemBand (ITUN binding) — the Active Item (primary row) rules + store
 * logic, per band (mech / pilot / crawler). Dispatches by mount state
 * (playStateStore), runs the reactor / damage / egress verbs through the pure
 * rules engine (`dashboardRules.ts` → `lib/rules/*`) and the entity store under
 * the ADR-007 automation boundary, then hands a pure view-model to the
 * presentational ActiveItemBand in component-lib.
 *
 *   - Auto-apply (single click): Push, Heat Check, Vent, Shutdown toggle, the
 *     SP/HP value of a self-declared hit.
 *   - Player-confirmed (explicit extra step): the Critical Damage / Critical
 *     Injury *roll* when a hit hits 0, marking the mech Destroyed, and Eject.
 */

import type {
  ActiveItemBandView as ActiveItemBandViewModel,
  BandButton,
  StepRule,
} from 'component-lib'
import {
  ActiveItemBand as ActiveItemBandView,
  CountStepper,
  RuleBrief,
  StorageBay,
} from 'component-lib'
import { useEffect, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { describePushOutcome } from '../../lib/rules/coreMechanic'
import {
  crawlerMaxSPParts,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import type { CriticalDamageEffect, CriticalInjuryEffect } from '../../lib/rules/takeDamage'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityState } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import {
  areaSalvageOutcome,
  craftOutcome,
  crawlerTechLevelOf,
  scrapMechOutcome,
} from './dashboardEconomy'
import { activatableEffects } from './dashboardEffects'
import {
  critDamagePatch,
  critInjuryPatch,
  describeCritDamage,
  describeCritInjury,
  describeHeatCheck,
  heatCheckOncePatch,
  mechDamagePatch,
  pilotDamagePatch,
  pushPatch,
  shutdownTogglePatch,
  VENT_PATCH,
} from './dashboardRules'

/** The store surface the band needs — injectable so tests can assert patches. */
export type PlayStore = Pick<EntityState, 'get' | 'update' | 'transfer'>

type ActiveItemBandProps = {
  mech: Mech
  pilot: Pilot | null
  /** The linked crawler — the Active Item while in Downtime (Phase 6). */
  crawler?: Crawler | null
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

export function ActiveItemBand({ mech, pilot, crawler, store }: ActiveItemBandProps) {
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  // Unconditional hook; the prop wins when a stub is injected (tests / harness).
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore

  if (mount === 'downtime' && crawler) {
    return <CrawlerBand crawler={crawler} mech={mech} store={s} onLeave={leaveDowntime} />
  }
  if (mount === 'pilot' && pilot) {
    return <PilotBand pilot={pilot} store={s} onBoard={() => setMount('mech')} />
  }
  return (
    <MechBand
      mech={mech}
      store={s}
      hasPilot={pilot !== null}
      pilotAbilities={pilot?.abilities}
      onDismount={() => setMount('pilot')}
    />
  )
}

// ---------------------------------------------------------------------------
// Crawler band (Downtime — read-only: the crawler's Structure + Leave control)
// ---------------------------------------------------------------------------

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
    void store.update('crawler', crawler.id, patch, DASHBOARD_TXN)
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

function CrawlerBand({
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
  const sp = Math.min(crawler.currentSP ?? maxSP, maxSP)
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
    if (patch) void store.update('crawler', crawler.id, patch, DASHBOARD_TXN)
    setPrompt({
      kind: 'salvage',
      log: result.requiresPlayerChoice
        ? `${result.roll}: ${result.label} — pick a Damaged Chassis, System or Module at Tech ${result.areaTl}.`
        : result.scrapQty > 0
          ? `${result.roll}: ${result.label} — ${result.scrapQty} Tech ${result.areaTl} Scrap into the pool.`
          : `${result.roll}: ${result.label}.`,
    })
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
    void store.transfer(
      {
        updates: [
          { type: 'crawler', id: crawler.id, patch: crawlerPatch },
          { type: 'mech', id: mech.id, patch: mechPatch },
        ],
      },
      DASHBOARD_TXN
    )
    setPrompt({ kind: 'scrap', total: breakdown.total, skipped: breakdown.skipped.length })
  }

  const overlay = ((): ActiveItemBandViewModel['overlay'] => {
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

  const view: ActiveItemBandViewModel = {
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
  return <ActiveItemBandView view={view} />
}

// ---------------------------------------------------------------------------
// Mech band
// ---------------------------------------------------------------------------

type MechPrompt =
  | { kind: 'reactor'; log: string; meltdown?: boolean }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalDamageEffect | null; log: string }
  | { kind: 'eject' }
  | { kind: 'storage' }
  | null

/**
 * Rules a blocked Guided-Play control explains when the player reaches for it
 * (ADR-021 — the guided modes teach as they enforce).
 *
 * Paraphrased with a citation, matching the wizards' RuleBrief contract; the
 * numbers are interpolated so the brief describes THIS mech's situation rather
 * than the rule in the abstract.
 */
const PUSH_RULE = (heat: number, cap: number): StepRule => ({
  rule: `Pushing adds 2 Heat before the roll, and a Mech can never exceed its Heat Cap. This Mech is at ${heat}/${cap} Heat, so a Push would take it past the Cap — vent or take a Heat Check first.`,
  cite: 'Quick Ref · p.233',
})

function MechBand({
  mech,
  store,
  hasPilot,
  pilotAbilities,
  onDismount,
}: {
  mech: Mech
  /** Beefcake raises the piloted MECH's Max SP and Cargo (ADR-029). */
  pilotAbilities?: string[]
  store: PlayStore
  hasPilot: boolean
  onDismount: () => void
}) {
  const chassis = resolveChassisRef(mech.chassisRef)
  const activeEffects = usePlayStateStore((st) => st.activeEffects)
  const toggleEffect = usePlayStateStore((st) => st.toggleEffect)
  const piloting = { ...pilotingContext(mech, pilotAbilities), active: activeEffects }
  // What this mech/pilot could switch on (F1). Manual expiry: the table keeps
  // time, the app keeps state.
  const activatable = activatableEffects(mech, pilotAbilities)
  const maxSP = mechMaxSP(mech, chassis, piloting)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis, piloting)
  const sp = Math.min(mech.currentSP ?? maxSP, maxSP)
  const ep = Math.min(mech.currentEP ?? maxEP, maxEP)
  const heat = Math.min(mech.currentHeat ?? 0, maxHeat)
  const cargo = totalLotUnits(mech.cargoLots)

  const [prompt, setPrompt] = useState<MechPrompt>(null)
  const [dmg, setDmg] = useState(1)

  // The deck's Apply step routes a destructive Cascade Failure here: open the
  // Take-Structure-Damage overlay pre-armed for the player to confirm (ADR-007).
  const damagePromptArmed = usePlayStateStore((st) => st.damagePromptArmed)
  const consumeDamagePrompt = usePlayStateStore((st) => st.consumeDamagePrompt)
  useEffect(() => {
    if (damagePromptArmed) {
      setPrompt({ kind: 'dmg' })
      consumeDamagePrompt()
    }
  }, [damagePromptArmed, consumeDamagePrompt])

  const fresh = () => store.get('mech', mech.id) ?? mech

  // Quick Ref p.233 — can't Push if +2 Heat would exceed the Heat Cap.
  const pushLocked = heat + 2 > maxHeat

  // The rule a blocked control explains when the player reaches for it.
  const [blocked, setBlocked] = useState<StepRule | null>(null)

  function doPush() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis, piloting)
    const { patch, effect, nextHeat, meltdown } = pushPatch({
      heat: Math.min(m.currentHeat ?? 0, cap),
      heatCap: cap,
      currentSP: Math.min(m.currentSP ?? spMax, spMax),
      roll: defaultRoll,
    })
    void store.update('mech', mech.id, patch, DASHBOARD_TXN)
    setPrompt({ kind: 'reactor', log: describePushOutcome(nextHeat, effect), meltdown })
  }

  function doHeatCheck() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis, piloting)
    const { patch, effect, meltdown } = heatCheckOncePatch({
      heat: Math.min(m.currentHeat ?? 0, cap),
      currentSP: Math.min(m.currentSP ?? spMax, spMax),
      roll: defaultRoll,
    })
    void store.update('mech', mech.id, patch, DASHBOARD_TXN)
    setPrompt({ kind: 'reactor', log: describeHeatCheck(effect), meltdown })
  }

  function doVent() {
    void store.update('mech', mech.id, VENT_PATCH, DASHBOARD_TXN)
    setPrompt({
      kind: 'reactor',
      log: 'Vented — Heat 0, Vulnerable. (Shut down separately if needed.)',
    })
  }

  function doShutdown() {
    void store.update('mech', mech.id, shutdownTogglePatch(fresh().shutdown), DASHBOARD_TXN)
  }

  function applyDamage() {
    const m = fresh()
    // Damage operates on the stored SP (authoritative); default to max only
    // when it was never set. The gauge, not this write, clamps for display.
    const { patch, effect } = mechDamagePatch({
      currentSP: m.currentSP ?? mechMaxSP(m, chassis, piloting),
      amount: dmg,
      vulnerable: m.vulnerable ?? false,
    })
    void store.update('mech', mech.id, patch, DASHBOARD_TXN)
    if (effect.criticalDue) {
      setPrompt({ kind: 'crit', effect: null, log: `−${effect.effectiveDamage} SP → 0.` })
    } else {
      setPrompt({ kind: 'reactor', log: `−${effect.effectiveDamage} SP → ${effect.nextSP}.` })
    }
  }

  function rollCritical() {
    const { patch, effect } = critDamagePatch(defaultRoll)
    void store.update('mech', mech.id, patch, DASHBOARD_TXN)
    setPrompt({ kind: 'crit', effect, log: describeCritDamage(effect) })
  }

  function confirmDestroyed() {
    void store.update('mech', mech.id, { destroyed: true }, DASHBOARD_TXN)
    setPrompt(null)
  }

  function jettison(lotId: string) {
    const m = fresh()
    void store.update(
      'mech',
      mech.id,
      { cargoLots: m.cargoLots.filter((lot) => lot.id !== lotId) },
      DASHBOARD_TXN
    )
  }

  const overlay = ((): ActiveItemBandViewModel['overlay'] => {
    if (blocked) {
      return {
        title: 'Blocked by a rule',
        onClose: () => setBlocked(null),
        // Keep the gauge the rule is ABOUT on screen while explaining it —
        // the number and the reason belong together.
        gauges: [
          {
            label: 'Heat',
            value: heat,
            max: maxHeat,
            tone: 'mech',
            danger: Math.max(0, maxHeat - 2),
          },
        ],
        body: <RuleBrief rule={blocked.rule} cite={blocked.cite} />,
        actions: [{ label: 'Got it', onClick: () => setBlocked(null), variant: 'go' }],
      }
    }
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'reactor') {
      return {
        title: 'Reactor',
        onClose,
        body: <p className="pc-resolve-log">{prompt.log}</p>,
        actions: prompt.meltdown
          ? [
              {
                label: 'Confirm Meltdown — Mark Mech Destroyed',
                onClick: confirmDestroyed,
                variant: 'danger',
              },
            ]
          : undefined,
      }
    }
    if (prompt.kind === 'dmg') {
      return {
        title: 'Take Structure Damage',
        onClose,
        // Keep the gauge being edited on screen (see BandOverlay.gauges).
        gauges: [{ label: 'SP', value: sp, max: maxSP, tone: 'mech' }],
        body: (
          <CountStepper
            count={dmg}
            onChange={setDmg}
            subject="damage point"
            min={1}
            surface="instrument"
          />
        ),
        actions: [{ label: `Apply −${dmg} SP`, onClick: applyDamage, variant: 'go' }],
      }
    }
    if (prompt.kind === 'crit') {
      // Annotated: without it TS widens `variant` to `string` in this
      // intermediate const, which no longer satisfies BandButton's
      // `'danger' | 'go'` union (the two mutually-exclusive booleans it replaced
      // couldn't catch this class of mistake at all).
      const actions: BandButton[] | undefined =
        prompt.effect === null
          ? [{ label: 'Roll Critical Damage', onClick: rollCritical, variant: 'danger' }]
          : prompt.effect.destroyed
            ? [{ label: 'Mark Mech Destroyed', onClick: confirmDestroyed, variant: 'danger' }]
            : undefined
      return {
        title: 'Critical Damage',
        onClose,
        body: <p className="pc-resolve-log">{prompt.log}</p>,
        actions,
      }
    }
    if (prompt.kind === 'storage') {
      return {
        title: 'Cargo Hold',
        onClose,
        body: (
          <StorageBay
            lots={fresh().cargoLots}
            used={totalLotUnits(fresh().cargoLots)}
            cap={maxCargo}
            onJettison={jettison}
          />
        ),
      }
    }
    // eject
    return {
      title: 'Eject',
      onClose,
      body: <p className="pc-resolve-log">Eject the pilot from the mech?</p>,
      actions: [
        {
          label: 'Confirm Eject',
          onClick: () => {
            setPrompt(null)
            onDismount()
          },
          variant: 'danger',
        },
      ],
    }
  })()

  const view: ActiveItemBandViewModel = {
    fam: 'mech',
    stampLabel: 'Boarded',
    bays: [
      {
        label: 'Reactor',
        gauges: [
          {
            label: 'Heat',
            value: heat,
            max: maxHeat,
            tone: 'mech',
            danger: Math.max(0, maxHeat - 2),
          },
          { label: 'EP', value: ep, max: maxEP, tone: 'mech' },
        ],
        buttons: [
          {
            label: 'Push',
            // Guided Play teaches as it enforces (ADR-021). A blocked Push used
            // to grey out with a hover title — unreachable on touch, and it
            // taught nothing at the moment the rule actually bit. It now stays
            // pressable and opens the rule instead of performing the action.
            onClick: pushLocked ? () => setBlocked(PUSH_RULE(heat, maxHeat)) : doPush,
            variant: 'go',
            title: pushLocked
              ? `Can't Push at Heat ${heat}/${maxHeat} — why?`
              : '+2 Heat, then a Heat Check',
          },
          {
            label: 'Heat Chk',
            onClick: doHeatCheck,
            variant: 'go',
            title: 'Roll a Heat Check at current Heat',
          },
          { label: 'Vent', onClick: doVent, variant: 'go', title: 'Vent Heat to 0' },
          { label: 'Shutdn', onClick: doShutdown, title: 'Toggle reactor shutdown' },
        ],
      },
      {
        label: 'Chassis',
        gauges: [
          { label: 'SP', value: sp, max: maxSP, tone: 'mech' },
          { label: 'Cargo', value: cargo, max: maxCargo, tone: 'mech' },
        ],
        buttons: [
          {
            label: 'Take Dmg',
            onClick: () => {
              setDmg(1)
              setPrompt({ kind: 'dmg' })
            },
            title: 'Take Structure damage',
          },
          {
            label: 'Storage',
            onClick: () => setPrompt({ kind: 'storage' }),
            title: 'Open the cargo hold',
          },
        ],
      },
      ...(activatable.length > 0
        ? [
            {
              label: 'Effects',
              buttons: activatable.map((e) => ({
                label: `${activeEffects[e.ref] ? '\u25CF' : '\u25CB'} ${e.name}`,
                onClick: () => toggleEffect(e.ref),
                title: activeEffects[e.ref]
                  ? `${e.name} is active — click to end it`
                  : `${e.name}: ${e.summary}`,
              })),
            },
          ]
        : []),
      {
        label: 'Egress',
        buttons: [
          {
            label: 'Dismount',
            onClick: onDismount,
            disabled: !hasPilot,
            variant: 'go',
            title: hasPilot ? 'Exit the mech (calm)' : 'No pilot assigned to this mech',
          },
          {
            label: 'Eject',
            onClick: () => setPrompt({ kind: 'eject' }),
            disabled: !hasPilot,
            variant: 'danger',
            title: hasPilot ? 'Emergency exit' : 'No pilot assigned to this mech',
          },
        ],
      },
    ],
    overlay,
  }
  return <ActiveItemBandView view={view} />
}

// ---------------------------------------------------------------------------
// Pilot band
// ---------------------------------------------------------------------------

type PilotPrompt =
  | { kind: 'log'; log: string }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalInjuryEffect | null; log: string }
  | null

function PilotBand({
  pilot,
  store,
  onBoard,
}: {
  pilot: Pilot
  store: PlayStore
  onBoard: () => void
}) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)

  const [prompt, setPrompt] = useState<PilotPrompt>(null)
  const [dmg, setDmg] = useState(1)

  // On-foot: the deck's Apply routes a destructive Cascade Failure here — open
  // the Take-HP-Damage overlay pre-armed for the player to confirm (ADR-007).
  const damagePromptArmed = usePlayStateStore((st) => st.damagePromptArmed)
  const consumeDamagePrompt = usePlayStateStore((st) => st.consumeDamagePrompt)
  useEffect(() => {
    if (damagePromptArmed) {
      setPrompt({ kind: 'dmg' })
      consumeDamagePrompt()
    }
  }, [damagePromptArmed, consumeDamagePrompt])

  const fresh = () => store.get('pilot', pilot.id) ?? pilot

  function applyDamage() {
    const p = fresh()
    const { patch, effect } = pilotDamagePatch({
      currentHP: p.currentHP ?? Math.max(0, pilotMaxHP(p)),
      amount: dmg,
      vulnerable: false,
    })
    void store.update('pilot', pilot.id, patch, DASHBOARD_TXN)
    if (effect.criticalDue) {
      setPrompt({ kind: 'crit', effect: null, log: `−${effect.effectiveDamage} HP → 0.` })
    } else {
      setPrompt({ kind: 'log', log: `−${effect.effectiveDamage} HP → ${effect.nextHP}.` })
    }
  }

  function rollInjury() {
    const { patch, effect } = critInjuryPatch(defaultRoll)
    void store.update('pilot', pilot.id, patch, DASHBOARD_TXN)
    setPrompt({ kind: 'crit', effect, log: describeCritInjury(effect) })
  }

  const overlay = ((): ActiveItemBandViewModel['overlay'] => {
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'log') {
      return { title: 'Vitals', onClose, body: <p className="pc-resolve-log">{prompt.log}</p> }
    }
    if (prompt.kind === 'dmg') {
      return {
        title: 'Take Damage',
        onClose,
        // Keep the gauge being edited on screen (see BandOverlay.gauges).
        gauges: [{ label: 'HP', value: hp, max: maxHP, tone: 'pilot' }],
        body: (
          <CountStepper
            count={dmg}
            onChange={setDmg}
            subject="damage point"
            min={1}
            surface="instrument"
          />
        ),
        actions: [{ label: `Apply −${dmg} HP`, onClick: applyDamage, variant: 'go' }],
      }
    }
    // crit
    return {
      title: 'Critical Injury',
      onClose,
      body: <p className="pc-resolve-log">{prompt.log}</p>,
      actions:
        prompt.effect === null
          ? [{ label: 'Roll Critical Injury', onClick: rollInjury, variant: 'danger' }]
          : undefined,
    }
  })()

  const view: ActiveItemBandViewModel = {
    fam: 'pilot',
    stampLabel: 'On Foot',
    bays: [
      {
        label: 'Vitals',
        gauges: [
          { label: 'HP', value: hp, max: maxHP, tone: 'pilot' },
          { label: 'AP', value: ap, max: maxAP, tone: 'pilot' },
        ],
        buttons: [
          {
            label: 'Take Dmg',
            onClick: () => {
              setDmg(1)
              setPrompt({ kind: 'dmg' })
            },
            title: 'Take HP damage',
          },
          {
            label: 'Crit Injury',
            onClick: () =>
              setPrompt({ kind: 'crit', effect: null, log: 'Roll a Critical Injury?' }),
            variant: 'danger',
            title: 'Roll on the Critical Injury table',
          },
        ],
      },
      {
        label: 'Mount',
        buttons: [
          {
            label: '▶ Board Mech',
            onClick: onBoard,
            variant: 'go',
            wide: true,
            title: 'Board the mech',
          },
        ],
      },
    ],
    overlay,
  }
  return <ActiveItemBandView view={view} />
}
