/**
 * PlayDowntimeActionRow — one of the Downtime actions the guide names that is
 * not a unit's action (play.md §6): Train your Pilot, Craft · Trade and
 * Gather Cantina Rumours. Training Points are spent in the pilot sheet's
 * Manage Abilities, which "Spend TP" opens here, over Play
 * (`PilotAbilityTrainer`); crafting is done on the crawler's sheet, which its
 * row opens (`useOpenSheet`, play.md §4); a rumour is a roll, made here and put
 * on Play's roll log (`rollFor`, `playRolls.model.ts`): a plain d20 the
 * Mediator answers. An adventure's own rumour table is a "Roll a table…"
 * search away, never offered to every table (`tables.model.ts`).
 *
 * A bay that blocks one is named on its line (Pilot Bay, Trading Bay), never a
 * gate: the table rules it. A Mini one a line in the list (ruleset §1.3;
 * `playLineModel`, these being no reference entity), its chips and controls
 * in its chip group (C8); the rumour rolled is its contentful body, plain
 * content (N3, play.md §12).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Pilot } from 'game-domain/schemas/pilot'
import { useState } from 'react'
import { PilotAbilityTrainer } from '../build/sheet/PilotAbilityTrainer'
import { Button, Entity, Stat } from '../components/index'
import { bayGate } from '../lib/rules/crawlerEconomy'
import { playCopy } from '../messages/play'
import { NeedChip } from './PlayActionRow'
import type { DowntimeActionId } from './playActions.model'
import { playLineModel } from './playLine.model'
import type { SheetTarget } from './useOpenSheet'
import { useOpenSheet } from './useOpenSheet'
import type { PlayActions } from './usePlayActions'

type PlayDowntimeActionRowProps = {
  id: DowntimeActionId
  name: string
  pilot: Pilot | null
  crawler: Crawler | null
  rollFor: PlayActions['rollFor']
  /** Why it is not on hand ("needs Downtime"), or null when it is. */
  need: string | null
  canWrite: boolean
}

/**
 * A damaged bay, as the line names it; null when the bay is fine or absent.
 * The crawler box's chip for the same state (`PlayCrawlerUnit`), at the
 * Mini's Size: a Mini Stat, beside the TP Stat and the Mini buttons.
 */
function damagedBay(crawler: Crawler | null, slug: string, label: string) {
  if (crawler === null || !bayGate(crawler, slug).damaged) return null
  return <Stat label={playCopy('damaged', { label })} size="mini" state="critical" />
}

export function PlayDowntimeActionRow({
  id,
  name,
  pilot,
  crawler,
  rollFor,
  need,
  canWrite,
}: PlayDowntimeActionRowProps) {
  const [rumour, setRumour] = useState<{ roll: number; text: string } | null>(null)
  const [training, setTraining] = useState(false)
  const setSheet = useOpenSheet()
  const away = need !== null

  /** A plain d20, which the Mediator answers. */
  async function rollRumour() {
    const die = await rollFor(name, name)
    setRumour({ roll: die(20), text: playCopy('rumourPlainRoll') })
  }

  /** "Open": the unit's sheet in Build. */
  const open = (target: SheetTarget | null, label: string) => (
    <Button size="mini" disabled={target === null} onClick={() => target && setSheet(target)}>
      {label}
    </Button>
  )

  const chips =
    id === 'train' ? (
      <>
        <Stat size="mini" label={playCopy('tp')} value={pilot?.trainingPoints ?? 0} />
        {damagedBay(crawler, 'pilot-bay', playCopy('pilotBay'))}
      </>
    ) : id === 'craftTrade' ? (
      damagedBay(crawler, 'trading-bay', playCopy('tradingBay'))
    ) : undefined

  const controls = away ? undefined : id === 'train' ? (
    // Where Training Points are spent: the pilot's Manage Abilities.
    <Button size="mini" disabled={pilot === null || !canWrite} onClick={() => setTraining(true)}>
      {playCopy('spendTp')}
    </Button>
  ) : id === 'craftTrade' ? (
    open(crawler ? { kind: 'crawler', id: crawler.id, name: crawler.name } : null, 'Open')
  ) : id === 'rumours' ? (
    <Button size="mini" disabled={!canWrite} onClick={() => void rollRumour()}>
      {playCopy('rollD20')}
    </Button>
  ) : undefined

  const rumours = id === 'rumours' && !away && rumour !== null
  return (
    <li className="su-play-act" data-away={away || undefined} data-action-key={`downtime:${id}`}>
      <Entity
        size="mini"
        context="play"
        model={playLineModel({ name, key: `downtime-${id}` })}
        // Its source's tone: training is the pilot's, the
        // rest the crawler's.
        tint={id === 'train' ? 'pilot' : 'crawler'}
        dim={away}
        {...(away
          ? { state: <NeedChip need={need} /> }
          : chips === undefined || chips === null
            ? {}
            : { state: chips })}
        {...(controls === undefined ? {} : { controls })}
        {...(rumours
          ? {
              body: {
                text: false,
                children: (
                  <div className="su-play-resolve">
                    {rumour ? (
                      <p className="su-play-resolve__note" aria-live="polite">
                        {rumour.roll} · {rumour.text}
                      </p>
                    ) : null}
                  </div>
                ),
              },
            }
          : {})}
      />
      {training && pilot && (
        <PilotAbilityTrainer pilot={pilot} onClose={() => setTraining(false)} />
      )}
    </li>
  )
}
