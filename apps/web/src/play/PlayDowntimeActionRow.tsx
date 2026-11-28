/**
 * PlayDowntimeActionRow — one of the Downtime actions the guide names that is
 * not a unit's action (play.md §6): Train your Pilot, Craft · Trade and
 * Gather Cantina Rumours. Training Points are spent in the pilot sheet's
 * Manage Abilities, which "Spend TP" opens here, over Play
 * (`PilotAbilityTrainer`); crafting is done on the crawler's sheet, which its
 * row opens: solo in Build, in Edit, where the economy's dialogs are (r5
 * A14); in a Game over Play (`useOpenSheet`, play.md §4); a rumour is a roll, made here and put
 * on Play's roll log (`rollFor`, `playRolls.model.ts`): a plain d20 the
 * Mediator answers; solo, and on the Mediator's screen, it lands on the
 * Rumour table and says its row, the table a link away (r6 D8,
 * `rumours.model.ts`). With no crawler, Craft · Trade says a Union Crawler is
 * needed and, solo, links to making one.
 *
 * A bay that blocks one is named on its line (Pilot Bay, Trading Bay), never a
 * gate: the table rules it. A Mini one a line in the list (ruleset §1.3;
 * `playLineModel`, these being no reference entity), its chips and controls
 * in its chip group (C8); the rumour rolled is its contentful body, plain
 * content (N3, play.md §12).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { lazy, Suspense, useState } from 'react'
import { PilotAbilityTrainer } from '../build/sheet/PilotAbilityTrainer'
import { Button, Entity, Stat } from '../components/index'
import { bayGate } from '../lib/rules/crawlerEconomy'
import { playCopy } from '../messages/play'
import { playDowntimeCopy } from '../messages/play-downtime'
import { SPEND_TP_REFUSES_SHORT } from './downtimeRulings.model'
import { NeedChip } from './PlayActionRow'
import type { DowntimeActionId } from './playActions.model'
import { playLineModel } from './playLine.model'
import { RUMOUR_TABLE, rumourRowText, rumourTableHref } from './rumours.model'
import { makeCrawlerHref } from './units.model'
import type { SheetTarget } from './useOpenSheet'
import { useOpenSheet } from './useOpenSheet'
import type { PlayActions } from './usePlayActions'

/** Craft · Trade's panel, loaded once Open is pressed (the sheet route's bundle budget). */
const PlayDowntimeCraftTrade = lazy(() =>
  import('./PlayDowntimeCraftTrade').then((m) => ({ default: m.PlayDowntimeCraftTrade }))
)

type PlayDowntimeActionRowProps = {
  id: DowntimeActionId
  name: string
  pilot: Pilot | null
  crawler: Crawler | null
  rollFor: PlayActions['rollFor']
  /** The mech a craft may mount on (solo Craft · Trade); none on the Mediator's screen. */
  mech?: Mech | null
  /** Play's store, for solo Craft · Trade's writes. */
  store?: PlayActions['store']
  /** Why it is not on hand ("needs Downtime"), or null when it is. */
  need: string | null
  canWrite: boolean
  /** A solo table: no Mediator to answer a rumour, and the crawler is the player's own to make. */
  solo?: boolean
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
  solo = false,
  mech = null,
  store,
}: PlayDowntimeActionRowProps) {
  const [rumour, setRumour] = useState<{ roll: number; text: string } | null>(null)
  const [training, setTraining] = useState(false)
  const setSheet = useOpenSheet()
  const [crafting, setCrafting] = useState(false)
  const away = need !== null

  /**
   * Solo, and for the Mediator, the Rumour table: the row it landed on (r6
   * D8). A player in a Game rolls a plain d20 the Mediator answers (p.228).
   */
  const onTable = solo || pilot === null
  async function rollRumour() {
    if (!onTable) {
      const die = await rollFor(name, name)
      setRumour({ roll: die(20), text: playCopy('rumourPlainRoll') })
      return
    }
    const die = await rollFor(RUMOUR_TABLE, name)
    const roll = die(20)
    setRumour({ roll, text: rumourRowText(roll) })
  }

  /** "Open": the unit's sheet, over Play, or where `onOpen` takes it. */
  const open = (target: SheetTarget | null, label: string, onOpen?: () => void) => (
    <Button
      size="mini"
      disabled={target === null}
      onClick={() => (onOpen ? onOpen() : target && setSheet(target))}
    >
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
      // No crawler is why there is nothing to open: said, never a greyed button (r3 L2).
      // Solo, Make a Union Crawler says it, so the title keeps its room (r8 D3).
      crawler === null ? (
        solo ? undefined : (
          <NeedChip need={playCopy('needsAUnionCrawler')} />
        )
      ) : (
        damagedBay(crawler, 'trading-bay', playCopy('tradingBay'))
      )
    ) : undefined

  const controls = away ? undefined : id === 'train' ? (
    // Where Training Points are spent: the pilot's Manage Abilities.
    <Button size="mini" disabled={pilot === null || !canWrite} onClick={() => setTraining(true)}>
      {playCopy('spendTp')}
    </Button>
  ) : id === 'craftTrade' ? (
    crawler !== null ? (
      open(
        { kind: 'crawler', id: crawler.id, name: crawler.name },
        // Open, it reads Close: the press folds it back (r8 D1, SB8-10).
        solo && crafting ? playDowntimeCopy('closeCraftTrade') : 'Open',
        // Solo the crawler is the player's own: its Crafting and Trading Bays
        // open here, inside Downtime (r6 D4), never in an Edit sheet.
        solo ? () => setCrafting((was) => !was) : undefined
      )
    ) : solo ? (
      // Solo the crawler is the player's own to make; a Game's is its table runner's.
      <Button size="mini" href={makeCrawlerHref(pilot?.id ?? null)}>
        {playCopy('makeAUnionCrawler')}
      </Button>
    ) : undefined
  ) : id === 'rumours' ? (
    <Button size="mini" disabled={!canWrite} onClick={() => void rollRumour()}>
      {playCopy('rollD20')}
    </Button>
  ) : undefined

  const craftOpen =
    id === 'craftTrade' && !away && solo && crafting && crawler !== null && store !== undefined
  const rumours = id === 'rumours' && !away && rumour !== null
  const tableHref = rumours ? rumourTableHref() : null
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
        {...(craftOpen && crawler !== null && store !== undefined
          ? {
              body: {
                text: false,
                children: (
                  <Suspense fallback={null}>
                    <PlayDowntimeCraftTrade
                      crawler={crawler}
                      mech={mech}
                      store={store}
                      rollFor={rollFor}
                      canWrite={canWrite}
                      onClose={() => setCrafting(false)}
                    />
                  </Suspense>
                ),
              },
            }
          : {})}
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
                    {onTable && tableHref !== null && (
                      <Button size="mini" href={tableHref}>
                        {playCopy('openTheTable')}
                      </Button>
                    )}
                  </div>
                ),
              },
            }
          : {})}
      />
      {training && pilot && (
        <PilotAbilityTrainer
          pilot={pilot}
          onClose={() => setTraining(false)}
          spendOnly={SPEND_TP_REFUSES_SHORT}
        />
      )}
    </li>
  )
}
