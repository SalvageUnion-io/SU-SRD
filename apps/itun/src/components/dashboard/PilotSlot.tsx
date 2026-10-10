/**
 * PilotSlot — the pilot in the slot row, in its two forms
 * (ADR-038 §3):
 *
 *  - `PilotMajor`, on foot: Vitals (HP, AP, Take Damage with the
 *    player-confirmed Critical Injury roll, ADR-007), Kit, Abilities and Mount,
 *    whose Board split button and mech menu are `BoardControl`.
 *  - `PilotMinor`, boarded or in Downtime: HP and AP, and any injury in red.
 *
 * Both read the same vitals (`pilotVitals`), so a Minor and the Major it opens
 * into never disagree about a maximum.
 */

import { CountStepper } from 'component-lib'
import { useEffect, useRef, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { CriticalInjuryEffect } from 'salvageunion-reference/rules'
import { pilotMaxHPParts, resolvePoolStart, rollDie } from 'salvageunion-reference/rules'
import { readReference } from '../../lib/readReference'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Pilot } from '../../lib/schemas/pilot'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import { BoardControl, BoardMenuList } from './BoardControl'
import type { BoardMenu, BoardOption } from './boardMenu'
import { usePhoneForm } from './dashboardForm'
import { recordRoll } from './dashboardRolls'
import { critInjuryPatch, describeCritInjury, pilotDamagePatch } from './dashboardRules'
import type { BandBay, MajorModel } from './MajorFrame'
import { MajorFrame } from './MajorFrame'
import { MinorFrame } from './MinorFrame'
import type { DamagePrompt, PlayStore } from './SlotRow'
import { injuryLines, pilotMinorModel, pilotVitals } from './slotModels'

export function PilotMinor({
  pilot,
  crawler,
  boardedIn,
  onExpand,
}: {
  pilot: Pilot
  crawler: Crawler | null
  boardedIn: string | null
  onExpand: (trigger: HTMLButtonElement) => void
}) {
  return (
    <MinorFrame
      view={pilotMinorModel(pilot, crawler, boardedIn)}
      slot="Pilot"
      onExpand={onExpand}
    />
  )
}

/**
 * A Kit or Abilities chip for a stored ref: the reference entity when it
 * resolves (its shortform pill), else the ref itself as a plain chip.
 */
function refChip<T extends SURefEntity>(
  ref: string,
  find: (ref: string) => T | undefined
): { text: string; entity?: SURefEntity } {
  const entity = readReference('dashboard.pilotKit', () => find(ref), undefined)
  return entity === undefined ? { text: ref } : { text: entity.name, entity }
}

type PilotPrompt =
  | { kind: 'log'; log: string }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalInjuryEffect | null; log: string }
  /** The ▾ mech menu. */
  | { kind: 'board' }
  /** The confirm before claiming and boarding a spare. */
  | { kind: 'claim'; option: BoardOption }
  | null

export function PilotMajor({
  pilot,
  crawler,
  store,
  boardedIn,
  board,
  onBoard,
  onClaimAndBoard,
  damagePrompt,
}: {
  pilot: Pilot
  /** The pilot's crawler — its tier drives Stat Training (max HP/AP). */
  crawler: Crawler | null
  store: PlayStore
  /** The mech the seat has the pilot in, or null on foot. */
  boardedIn: string | null
  /** What the Mount bay's Board control offers (`boardMenu.ts`). */
  board: BoardMenu
  /** Board one of the player's own mechs. */
  onBoard: (mechId: string) => void
  /** Claim a spare, then board it; called once the player has confirmed. */
  onClaimAndBoard: (option: BoardOption) => void
  /**
   * The deck's Take Damage hand-off, which this copy answers. Only the slot
   * row's Major gets it; the ⤢ overlay's copy passes null so it never
   * consumes it.
   */
  damagePrompt: DamagePrompt | null
}) {
  const { statInput, maxHP, gauges } = pilotVitals(pilot, crawler)
  const phone = usePhoneForm()
  const hp = gauges[0]?.value ?? 0

  const [prompt, setPrompt] = useState<PilotPrompt>(null)
  const [dmg, setDmg] = useState(1)
  // The ▾ that opened the mech menu, to hand focus back to when it closes.
  const menuTrigger = useRef<HTMLButtonElement | null>(null)

  // On-foot: the deck's Apply routes a destructive Cascade Failure here — open
  // the Take-HP-Damage overlay pre-armed for the player to confirm (ADR-007).
  const armed = damagePrompt?.armed ?? false
  const consume = damagePrompt?.consume
  useEffect(() => {
    if (armed && consume) {
      setPrompt({ kind: 'dmg' })
      consume()
    }
  }, [armed, consume])

  const fresh = () => store.get('pilot', pilot.id) ?? pilot

  function applyDamage() {
    const p = fresh()
    const { patch, effect } = pilotDamagePatch({
      currentHP: resolvePoolStart(
        p.currentHP,
        Math.max(0, pilotMaxHPParts({ ...p, crawlerTechLevel: statInput.crawlerTechLevel }).total)
      ),
      amount: dmg,
      vulnerable: false,
    })
    runWrite(
      () => store.update('pilot', pilot.id, patch, DASHBOARD_TXN),
      () =>
        setPrompt(
          effect.criticalDue
            ? { kind: 'crit', effect: null, log: `−${effect.effectiveDamage} HP → 0.` }
            : { kind: 'log', log: `−${effect.effectiveDamage} HP → ${effect.nextHP}.` }
        )
    )
  }

  function rollInjury() {
    const { patch, effect } = critInjuryPatch(rollDie)
    const log = describeCritInjury(effect)
    runWrite(
      () => store.update('pilot', pilot.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'crit', effect, log })
    )
    // The Game's log, for the crew's Log tab (`dashboardRolls.ts`).
    recordRoll(pilot, {
      description: `${pilot.name} · ${log}`,
      result: {
        kind: 'critical-injury',
        roll: effect.result.roll,
        outcome: effect.result.outcome,
      },
    })
  }

  const overlay = ((): MajorModel['overlay'] => {
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'board') {
      return {
        title: 'Board a mech',
        onClose: () => {
          setPrompt(null)
          menuTrigger.current?.focus()
        },
        body: (
          <BoardMenuList
            options={board.options}
            onBoard={(mechId) => {
              setPrompt(null)
              onBoard(mechId)
            }}
            onClaim={(option) => setPrompt({ kind: 'claim', option })}
          />
        ),
      }
    }
    if (prompt.kind === 'claim') {
      const { option } = prompt
      return {
        title: 'Claim and board',
        onClose,
        body: (
          <p className="pc-resolve-log">
            {option.name} is an unclaimed spare. Claim it to make it yours in this Game, then board
            it. Boarding doesn’t assign it to {pilot.name}.
          </p>
        ),
        actions: [
          {
            label: `Claim and board ${option.name}`,
            onClick: () => {
              setPrompt(null)
              onClaimAndBoard(option)
            },
            variant: 'go',
          },
        ],
      }
    }
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

  const kit = pilot.equipment.map((ref) =>
    refChip(ref, (r) => SalvageUnionReference.Equipment.getBySlug(r))
  )
  const abilities = pilot.abilities.map((ref) =>
    refChip(ref, (r) => SalvageUnionReference.Abilities.getBySlug(r))
  )

  const vitals: BandBay = {
    label: 'Vitals',
    gauges,
    lines: injuryLines(pilot).map((text) => ({ text, warn: true })),
    buttons: [
      {
        label: phone ? 'Take Damage' : 'Take Dmg',
        onClick: () => {
          setDmg(1)
          setPrompt({ kind: 'dmg' })
        },
        title: 'Take HP damage',
      },
      {
        label: phone ? 'Critical Injury' : 'Crit Injury',
        onClick: () => setPrompt({ kind: 'crit', effect: null, log: 'Roll a Critical Injury?' }),
        variant: 'danger',
        title: 'Roll on the Critical Injury table',
      },
    ],
  }
  const kitBay: BandBay = {
    label: 'Kit',
    grow: 2,
    chips: kit.length > 0 ? kit : undefined,
    lines: kit.length > 0 ? undefined : [{ text: 'No equipment.' }],
    buttons: [],
  }
  const abilityBay: BandBay = {
    label: 'Abilities',
    grow: 2,
    chips: abilities.length > 0 ? abilities : undefined,
    lines: abilities.length > 0 ? undefined : [{ text: 'No abilities.' }],
    buttons: [],
  }
  const mount: BandBay =
    boardedIn === null
      ? {
          label: 'Mount',
          buttons: [],
          control: (
            <BoardControl
              menu={board}
              onBoard={onBoard}
              onClaim={(option) => setPrompt({ kind: 'claim', option })}
              onOpenMenu={(trigger) => {
                menuTrigger.current = trigger
                setPrompt({ kind: 'board' })
              }}
            />
          ),
        }
      : // Boarded, the way out is the Mech's Egress, not a second control here.
        { label: 'Mount', lines: [{ text: `In ${boardedIn}` }], buttons: [] }

  const view: MajorModel = {
    fam: 'pilot',
    stampLabel: boardedIn === null ? 'On Foot' : 'Boarded',
    // The phone puts Mount second (ADR-043 D5): Board starts every boarded turn.
    bays: phone ? [vitals, mount, kitBay, abilityBay] : [vitals, kitBay, abilityBay, mount],
    overlay,
  }
  return <MajorFrame view={view} />
}
