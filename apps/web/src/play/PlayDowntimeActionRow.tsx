/**
 * PlayDowntimeActionRow — one of the Downtime actions the guide names that is
 * not a unit's action (play.md §6): Train your Pilot, Craft · Trade and
 * Gather Cantina Rumours. Training and crafting are spent on the sheets, so
 * their rows open the pilot's or the crawler's over Play (`PlaySheetOverlay`,
 * play.md §4); a rumour is a roll, made here and put on Play's roll log with
 * its row (`rollFor`, `playRolls.model.ts`).
 *
 * A bay that blocks one is named on its line (Pilot Bay, Trading Bay), never a
 * gate: the table rules it. A Mini one a line in the list (ruleset §1.3;
 * `playLineModel`, these being no reference entity), its chips and controls
 * in its chip group (R6); the Rumour table rolled is its contentful body,
 * plain content (N3, play.md §12).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Pilot } from 'game-domain/schemas/pilot'
import { useState } from 'react'
import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import { Button, Entity, Stat } from '../components/index'
import { bayGate } from '../lib/rules/crawlerEconomy'
import { NeedChip } from './PlayActionRow'
import { PlayRollInstrument } from './PlayRollInstrument'
import type { SheetTarget } from './PlaySheetOverlay'
import { PlaySheetOverlay } from './PlaySheetOverlay'
import type { DowntimeActionId } from './playActions.model'
import { playLineModel } from './playLine.model'
import type { PlayActions } from './usePlayActions'

/** The table an app rumour is rolled on. */
const RUMOUR_TABLE = 'Rumour'

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
  return <Stat label={`${label} · damaged`} size="mini" state="critical" />
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
  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  const away = need !== null

  async function rollRumour() {
    let said: string | undefined
    const die = await rollFor(RUMOUR_TABLE, name, { outcome: () => said })
    const roll = die(20)
    const table = SalvageUnionReference.RollTables.getByName(RUMOUR_TABLE)?.table
    const row = resultForTable(table, roll)
    const text = row.success ? row.result.value : ''
    said = text || undefined
    setRumour({ roll, text })
  }

  /** "Spend TP" / "Open": the unit's sheet over Play. */
  const open = (target: SheetTarget | null, label: string) => (
    <Button size="mini" disabled={target === null} onClick={() => setSheet(target)}>
      {label}
    </Button>
  )

  const chips =
    id === 'train' ? (
      <>
        <Stat size="mini" label="TP" value={pilot?.trainingPoints ?? 0} />
        {damagedBay(crawler, 'pilot-bay', 'Pilot Bay')}
      </>
    ) : id === 'craftTrade' ? (
      damagedBay(crawler, 'trading-bay', 'Trading Bay')
    ) : undefined

  const controls = away
    ? undefined
    : id === 'train'
      ? open(pilot ? { kind: 'pilot', id: pilot.id, name: pilot.name } : null, 'Spend TP')
      : id === 'craftTrade'
        ? open(crawler ? { kind: 'crawler', id: crawler.id, name: crawler.name } : null, 'Open')
        : undefined

  const rumours = id === 'rumours' && !away
  return (
    <li className="su-play-act" data-away={away || undefined} data-action-key={`downtime:${id}`}>
      <Entity
        size="mini"
        context="play"
        model={playLineModel({ name, key: `downtime-${id}` })}
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
                  // The Rumour table, open (R8): its stamp the roll, the rumour its marked row.
                  <div className="su-play-resolve">
                    <PlayRollInstrument
                      table={RUMOUR_TABLE}
                      roll={rumour?.roll ?? null}
                      onRoll={canWrite ? () => void rollRumour() : undefined}
                    />
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
      <PlaySheetOverlay sheet={sheet} onClose={() => setSheet(null)} />
    </li>
  )
}
