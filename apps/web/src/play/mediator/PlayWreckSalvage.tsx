/**
 * PlayWreckSalvage — what a downed Opposition leaves, salvaged from its box
 * (Core Book pp.246, 248), plain content at level 2 under its vital.
 *
 * A Mech rolls the Mech Salvage table (its stamp the roll, R8), once: the roll
 * is kept with the wreck (`salvageRoll`, r5 B1), so leaving Mediate or a
 * reload finds it as it was, and rolling again asks first and replaces its
 * Feed line. The band says what may be taken, and the Mediator picks it, part
 * by part (ADR-007: never picked for them), Damaged, or on a 2–5 half the
 * Chassis's Salvage Value in Scrap. A Vehicle is scrapped for its Salvage
 * Value in Scrap of its Tech Level.
 *
 * The haul goes where the Mediator says (r5 B2): the crawler's hold and pool,
 * or a crew Mech's hold, as a proposal its player accepts. With no crawler in
 * the Game the card says so and still offers the Mechs. What was taken, and
 * where, is written on the wreck's Feed line. Taking anything, or settling a
 * wreck with nothing to take, claims it once (`salvaged`): what was left of
 * it is destroyed (`wreckOf`, `wreckSalvageOutcome`).
 */

import type { Wreck, WreckPart } from 'game-domain/rules/wreck'
import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { MechSalvageResult } from 'salvageunion-reference/rules'
import {
  halfSalvageValue,
  MECH_SALVAGE_TABLE as MECH_SALVAGE,
  mechSalvageAllows,
  mechSalvageResult,
} from 'salvageunion-reference/rules'
import { ConfirmDialog } from '../../components/app'
import { Button, Field, rollForTable, Select, Text, Toggle, tokens } from '../../components/index'
import {
  wreckHaulLots,
  wreckSalvageOutcome,
  wreckScrapLot,
  wreckScrapOutcome,
} from '../../lib/rules/downtimeEconomy'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayRollInstrument } from '../PlayRollInstrument'
import { recordPlayRoll, reportingRoll } from '../playRolls.model'
import type { TrayNpc } from './opposition.model'
import type { PlayMediator, WreckHaul } from './usePlayMediator'
import { NOTHING } from './usePlayMediator'

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[4],
} satisfies CSSProperties

/** The crawler, as the destination Select names it. */
const CRAWLER = ''

/** A crew Mech a haul can go to. */
export type WreckMech = { id: string; label: string }

type PlayWreckSalvageProps = {
  npc: TrayNpc
  wreck: Wreck
  canWrite: boolean
  /** Whether the Mediator holds a crawler to haul it to. */
  hasCrawler: boolean
  /** The crew's Mechs, whose holds a haul can be proposed to (r5 B2). */
  mechs?: readonly WreckMech[]
  /** Keep the Mech Salvage roll with the wreck (r5 B1). */
  onRoll: (npc: TrayNpc, roll: number) => Promise<unknown>
  onSettle: PlayMediator['salvageWreck']
  /** The dice (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayWreckSalvage({
  npc,
  wreck,
  canWrite,
  hasCrawler,
  mechs = [],
  onRoll,
  onSettle,
  rollFor = rollForTable,
}: PlayWreckSalvageProps) {
  const id = useId()
  // This screen's roll until the wreck's kept one says the same.
  const [mine, setMine] = useState<number | null>(null)
  const [picked, setPicked] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [to, setTo] = useState<string>(hasCrawler ? CRAWLER : (mechs[0]?.id ?? CRAWLER))

  if (npc.salvaged) return <Text variant="note">{mediatorCopy('salvaged')}</Text>

  const die = mine ?? npc.salvageRoll
  const rolled: MechSalvageResult | null = die === null ? null : mechSalvageResult(die)
  const mech = mechs.find((m) => m.id === to) ?? null
  const toCrawler = mech === null
  const where = mech?.label ?? mediatorCopy('wreckTheCrawler')
  const canHaul = toCrawler ? hasCrawler : true
  const live = canWrite && !busy
  const slot = `wreck:${npc.id}`
  const label = `${npc.name} · ${MECH_SALVAGE}`

  /** The wreck's Feed line, now saying what it yielded and where it went. */
  const tell = (taken: readonly string[]) => {
    const said = taken.length === 0 ? mediatorCopy('wreckTookNothing') : taken.join(', ')
    const took = taken.length === 0 ? said : mediatorCopy('wreckTook', { what: said, to: where })
    recordPlayRoll({
      tableName: MECH_SALVAGE,
      rolls: die === null ? [] : [die],
      label,
      veiled: true,
      outcome: rolled === null ? took : `${rolled.label} · ${took}`,
      slot,
    })
  }

  const settle = (
    crawlerHaul: Parameters<PlayMediator['salvageWreck']>[1],
    mechLots: () => { lots: CargoLot[] },
    taken: readonly string[]
  ) => {
    let haul: WreckHaul = crawlerHaul
    if (!toCrawler && crawlerHaul !== NOTHING && mech !== null) {
      haul = { mechId: mech.id, lots: mechLots().lots, reason: label }
    }
    setBusy(true)
    void onSettle(npc, haul)
      .then(() => tell(crawlerHaul === NOTHING ? [] : taken))
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }

  const destination =
    mechs.length === 0 ? null : (
      <Field label={mediatorCopy('wreckTo')} htmlFor={`${id}-to`}>
        <Select id={`${id}-to`} value={to} disabled={!live} onChange={(e) => setTo(e.target.value)}>
          {hasCrawler ? <option value={CRAWLER}>{mediatorCopy('wreckToCrawler')}</option> : null}
          {mechs.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
    )
  const noCrawler = hasCrawler ? null : (
    <Text variant="note">
      {mediatorCopy(mechs.length === 0 ? 'wreckNoCrawler' : 'wreckNoCrawlerMechs')}
    </Text>
  )

  if (wreck.kind === 'scrap') {
    const scrap = { count: wreck.salvageValue, tl: wreck.techLevel, to: where }
    const lot = wreckScrapLot(wreck)
    return (
      <>
        {destination}
        <Button
          size="mini"
          disabled={!live || !canHaul}
          onClick={() =>
            settle(
              (crawler) => wreckScrapOutcome(crawler, wreck),
              () => ({ lots: lot === null ? [] : [lot] }),
              [mediatorCopy('wreckScrapTaken', scrap)]
            )
          }
        >
          {mediatorCopy('wreckScrap', scrap)}
        </Button>
        {noCrawler}
      </>
    )
  }

  async function roll() {
    let said: string | undefined
    const face = reportingRoll(await rollFor(MECH_SALVAGE), MECH_SALVAGE, () => ({
      label,
      veiled: true as const,
      slot,
      ...(said ? { outcome: said } : {}),
    }))(20)
    said = mechSalvageResult(face).label
    setPicked([])
    setMine(face)
    await onRoll(npc, face).catch(() => undefined)
  }

  const parts = wreck.parts
  const chassis = parts.find((p) => p.kind === 'chassis')
  const pickOf = (keys: readonly string[]) => {
    const chosen = parts.filter((p) => keys.includes(p.key))
    return {
      chassis: chosen.some((p) => p.kind === 'chassis'),
      systems: chosen.filter((p) => p.kind === 'system').length,
      modules: chosen.filter((p) => p.kind === 'module').length,
    }
  }
  const band = rolled?.band ?? null
  // The parts the band lets the salvager take at all, and of those, each one
  // that can join what is picked now; one already picked can always go.
  const takeable = (part: WreckPart) => band !== null && mechSalvageAllows(band, pickOf([part.key]))
  const addable = (part: WreckPart) =>
    band !== null &&
    (picked.includes(part.key) || mechSalvageAllows(band, pickOf([...picked, part.key])))
  const pickedNames = parts.filter((p) => picked.includes(p.key)).map((p) => p.name)

  return (
    <div className="su-play-resolve">
      <PlayRollInstrument
        table={MECH_SALVAGE}
        roll={rolled?.roll ?? null}
        onRoll={live && rolled === null ? () => void roll() : undefined}
      />
      {rolled !== null ? (
        <span style={ROW}>
          <Button variant="ghost" size="mini" disabled={!live} onClick={() => setAsking(true)}>
            {mediatorCopy('wreckRollAgain')}
          </Button>
        </span>
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={mediatorCopy('wreckRollAgainTitle')}
        body={mediatorCopy('wreckRollAgainBody', { roll: rolled?.roll ?? 0 })}
        confirmLabel={mediatorCopy('wreckRollAgain')}
        onConfirm={async () => {
          await roll()
        }}
      />
      {band === 'ashes' && (
        <Button
          size="mini"
          disabled={!live}
          onClick={() => settle(NOTHING, () => ({ lots: [] }), [])}
        >
          {mediatorCopy('wreckNothing')}
        </Button>
      )}
      {band !== null && band !== 'ashes' && destination}
      {band === 'nuts' && chassis?.techLevel !== undefined && (
        <Button
          size="mini"
          disabled={!live || !canHaul}
          onClick={() => {
            const haul = wreckHaulLots(parts, 'nuts', [])
            settle(
              (crawler) => wreckSalvageOutcome(crawler, parts, 'nuts', []).patch,
              () => haul,
              haul.taken
            )
          }}
        >
          {mediatorCopy('wreckTakeScrap', {
            count: halfSalvageValue(chassis.salvageValue),
            tl: chassis.techLevel,
            to: where,
          })}
        </Button>
      )}
      {band !== null && band !== 'ashes' && band !== 'nuts' && (
        <>
          <Text variant="note">{mediatorCopy('wreckPickLede')}</Text>
          <div style={ROW}>
            {parts.filter(takeable).map((part) => (
              <Toggle
                key={part.key}
                size="mini"
                pressed={picked.includes(part.key)}
                disabled={!live || !addable(part)}
                onClick={() =>
                  setPicked((now) =>
                    now.includes(part.key) ? now.filter((k) => k !== part.key) : [...now, part.key]
                  )
                }
              >
                {part.salvageValue <= 1
                  ? mediatorCopy('wreckPartOne', { name: part.name, tl: part.techLevel ?? '?' })
                  : mediatorCopy('wreckPart', {
                      name: part.name,
                      tl: part.techLevel ?? '?',
                      sv: part.salvageValue,
                    })}
              </Toggle>
            ))}
          </div>
          <div style={ROW}>
            <Button
              size="mini"
              disabled={!live || !canHaul || picked.length === 0}
              onClick={() =>
                settle(
                  (crawler) => wreckSalvageOutcome(crawler, parts, band, picked).patch,
                  () => wreckHaulLots(parts, band, picked),
                  pickedNames
                )
              }
            >
              {mediatorCopy('wreckTake', { to: where })}
            </Button>
            <Button
              variant="ghost"
              size="mini"
              disabled={!live}
              onClick={() => settle(NOTHING, () => ({ lots: [] }), [])}
            >
              {mediatorCopy('wreckLeave')}
            </Button>
          </div>
        </>
      )}
      {rolled !== null && noCrawler}
    </div>
  )
}
