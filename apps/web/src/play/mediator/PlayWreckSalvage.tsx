/**
 * PlayWreckSalvage — what a downed Opposition leaves, salvaged from its box
 * (Core Book pp.246, 248), plain content at level 2 under its vital.
 *
 * A Mech rolls the Mech Salvage table (its stamp the roll, R8); the band
 * says what may be taken, and the Mediator picks it, part by part (ADR-007:
 * never picked for them), Damaged, into the crawler's hold, or on a 2–5 half
 * the Chassis's Salvage Value in Scrap into its pool. A Vehicle is scrapped
 * for its Salvage Value in Scrap of its Tech Level. Taking anything, or
 * settling a wreck with nothing to take, claims it once (`salvaged`): what
 * was left of it is destroyed (`wreckOf`, `wreckSalvageOutcome`).
 */

import type { Wreck, WreckPart } from 'game-domain/rules/wreck'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { MechSalvageResult } from 'salvageunion-reference/rules'
import {
  MECH_SALVAGE_TABLE as MECH_SALVAGE,
  mechSalvageAllows,
  mechSalvageResult,
  mechSalvageScrap,
} from 'salvageunion-reference/rules'
import { Button, rollForTable, Text, Toggle, tokens } from '../../components/index'
import { wreckSalvageOutcome, wreckScrapOutcome } from '../../lib/rules/downtimeEconomy'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayRollInstrument } from '../PlayRollInstrument'
import { reportingRoll } from '../playRolls.model'
import type { TrayNpc } from './opposition.model'
import type { PlayMediator } from './usePlayMediator'
import { NOTHING } from './usePlayMediator'

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[4],
} satisfies CSSProperties

type PlayWreckSalvageProps = {
  npc: TrayNpc
  wreck: Wreck
  canWrite: boolean
  /** Whether the Mediator holds a crawler to haul it to. */
  hasCrawler: boolean
  onSettle: PlayMediator['salvageWreck']
  /** The dice (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayWreckSalvage({
  npc,
  wreck,
  canWrite,
  hasCrawler,
  onSettle,
  rollFor = rollForTable,
}: PlayWreckSalvageProps) {
  const [rolled, setRolled] = useState<MechSalvageResult | null>(null)
  const [picked, setPicked] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)

  if (npc.salvaged) return <Text variant="note">{mediatorCopy('salvaged')}</Text>

  const live = canWrite && !busy
  const settle = (haul: Parameters<PlayMediator['salvageWreck']>[1]) => {
    setBusy(true)
    void onSettle(npc, haul)
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }
  const noCrawler = hasCrawler ? null : <Text variant="note">{mediatorCopy('wreckNoCrawler')}</Text>

  if (wreck.kind === 'scrap') {
    return (
      <>
        <Button
          size="mini"
          disabled={!live || !hasCrawler}
          onClick={() => settle((crawler) => wreckScrapOutcome(crawler, wreck))}
        >
          {mediatorCopy('wreckScrap', { count: wreck.salvageValue, tl: wreck.techLevel })}
        </Button>
        {noCrawler}
      </>
    )
  }

  async function roll() {
    let said: string | undefined
    const die = reportingRoll(await rollFor(MECH_SALVAGE), MECH_SALVAGE, () => ({
      label: `${npc.name} · ${MECH_SALVAGE}`,
      ...(said ? { outcome: said } : {}),
    }))(20)
    const result = mechSalvageResult(die)
    said = result.label
    setPicked([])
    setRolled(result)
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

  return (
    <div className="su-play-resolve">
      <PlayRollInstrument
        table={MECH_SALVAGE}
        roll={rolled?.roll ?? null}
        onRoll={live && rolled === null ? () => void roll() : undefined}
      />
      {band === 'ashes' && (
        <Button size="mini" disabled={!live} onClick={() => settle(NOTHING)}>
          {mediatorCopy('wreckNothing')}
        </Button>
      )}
      {band === 'nuts' && chassis?.techLevel !== undefined && (
        <Button
          size="mini"
          disabled={!live || !hasCrawler}
          onClick={() => settle((crawler) => wreckSalvageOutcome(crawler, parts, 'nuts', []).patch)}
        >
          {mediatorCopy('wreckTakeScrap', {
            count: mechSalvageScrap(chassis.salvageValue),
            tl: chassis.techLevel,
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
                {mediatorCopy('wreckPart', {
                  name: part.name,
                  tl: part.techLevel ?? '?',
                  sv: Math.max(1, part.salvageValue),
                })}
              </Toggle>
            ))}
          </div>
          <div style={ROW}>
            <Button
              size="mini"
              disabled={!live || !hasCrawler || picked.length === 0}
              onClick={() =>
                settle((crawler) => wreckSalvageOutcome(crawler, parts, band, picked).patch)
              }
            >
              {mediatorCopy('wreckTake')}
            </Button>
            <Button variant="ghost" size="mini" disabled={!live} onClick={() => settle(NOTHING)}>
              {mediatorCopy('wreckLeave')}
            </Button>
          </div>
        </>
      )}
      {rolled !== null && noCrawler}
    </div>
  )
}
