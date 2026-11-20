/**
 * StarterCrewLedger — MOCK (density mock, sheet variant): a book crew as a
 * PAIRED MANIFEST, not a list of different things in one table.
 *
 * The old table put pilots, mechs and a crawler in one list under KIND /
 * BUILT ON / TL, so each row's columns meant something different and most
 * cells were empty. The crew is really pairs: a pilot and the mech they
 * field (the Starter Set's own soft links). So a line is the PAIR —
 * the pilot with their class, HP and AP, then their mech with its chassis,
 * Tech Level, SP, EP and Heat — and the crawler, which belongs to the whole
 * crew, is its own short group with the numbers a crawler has.
 *
 * Each name still opens its read-only sheet. One copy control rides a line —
 * the pilot's, whose menu is the crew's usual "Copy to…"; a mech on its own
 * line keeps its own. A single mech is copied from its sheet (`MakeACopy`),
 * so a paired line stays one line. The cite foot stays bottom-right.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import {
  crawlerMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
  resolveChassisRef,
} from 'salvageunion-reference/rules'
import { CiteLine } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { resolveClass } from '../../lib/classRef'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { StarterRosterId } from '../../lib/starterSet/starterTemplates'
import {
  QUICKSTART_BOOK,
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
  starterRoster,
} from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import type { OpenColumn, OpenRow } from '../dash/OpenLedger'
import { OpenLedger, TechLevel } from '../dash/OpenLedger'
import { CopyStarterMenu } from './CopyStarterMenu'

const BOOK: Record<StarterRosterId, string> = {
  'starter-set': STARTER_SET_ADVENTURE,
  quickstart: QUICKSTART_BOOK,
}

const PAIR_COLUMNS: readonly OpenColumn[] = [
  { key: 'hp', label: buildStarterSetCopy('hp'), phone: true },
  { key: 'ap', label: buildStarterSetCopy('ap'), phone: true },
  { key: 'mech', label: buildStarterSetCopy('mech'), kind: 'text', phone: true },
  { key: 'tl', label: buildStarterSetCopy('tl'), title: buildStarterSetCopy('techLevel') },
  { key: 'sp', label: buildStarterSetCopy('sp') },
  { key: 'ep', label: buildStarterSetCopy('ep') },
  { key: 'heat', label: buildStarterSetCopy('heat') },
]

const CRAWLER_COLUMNS: readonly OpenColumn[] = [
  { key: 'type', label: buildStarterSetCopy('type'), kind: 'text', phone: true },
  { key: 'tl', label: buildStarterSetCopy('tl'), title: buildStarterSetCopy('techLevel') },
  { key: 'sp', label: buildStarterSetCopy('sp'), phone: true },
  { key: 'bays', label: buildStarterSetCopy('bays') },
]

/** The mech each pilot fields, from the book's own links. */
function pairing(roster: ReturnType<typeof starterRoster>): Map<string, Mech> {
  const byId = new Map(roster.mechs.map((mech) => [mech.id, mech]))
  const pairs = new Map<string, Mech>()
  for (const link of roster.softLinks) {
    if (link.type !== 'mech-to-pilot') continue
    const mech = byId.get(link.from.id)
    if (mech) pairs.set(link.to.id, mech)
  }
  return pairs
}

/** The chassis is worth printing only when the mech is not named after it. */
function chassisMeta(mech: Mech, chassis: { name: string } | null | undefined) {
  if (!chassis) return null
  if (chassis.name.toLowerCase() === mech.name.toLowerCase()) return null
  return <span className="su-open__meta">{chassis.name}</span>
}

function mechCells(mech: Mech | undefined) {
  if (!mech) return ['', '', '', '', '']
  const chassis = resolveChassisRef(mech.chassisRef)
  return [
    <span key="mech" className="su-open__pair">
      <a
        className="su-inline-ref su-inline-ref--link su-open__pair-name"
        href={`/starter/mech/${mech.id}`}
      >
        {mech.name}
      </a>
      {chassisMeta(mech, chassis)}
    </span>,
    chassis?.techLevel !== undefined ? <TechLevel key="tl" level={chassis.techLevel} /> : '',
    mechMaxSP(mech, chassis),
    mechMaxEP(mech, chassis),
    mechMaxHeat(mech, chassis),
  ]
}

function pilotRow(pilot: Pilot, mech: Mech | undefined, confirm: Confirm | undefined): OpenRow {
  const pilotClass = resolveClass(pilot.classRef)
  return {
    id: pilot.id,
    name: pilot.name,
    href: `/starter/pilot/${pilot.id}`,
    meta: pilotClass?.name,
    state: confirm ? (
      <CopyStarterMenu kind="pilot" templateId={pilot.id} name={pilot.name} confirm={confirm} />
    ) : undefined,
    cells: [pilotMaxHP(pilot), pilotMaxAP(pilot), ...mechCells(mech)],
  }
}

function crawlerRow(crawler: Crawler, confirm: Confirm | undefined): OpenRow {
  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  return {
    id: crawler.id,
    name: crawler.name,
    href: `/starter/crawler/${crawler.id}`,
    state: confirm ? (
      <CopyStarterMenu
        kind="crawler"
        templateId={crawler.id}
        name={crawler.name}
        confirm={confirm}
      />
    ) : undefined,
    cells: [
      type?.name ?? '',
      <TechLevel key="tl" level={crawler.techLevel} />,
      crawlerMaxSP(crawler),
      (crawler.crawlerBays ?? []).length,
    ],
  }
}

type StarterCrewLedgerProps = {
  roster?: StarterRosterId
  confirm?: Confirm
}

export function StarterCrewLedger({ roster = 'starter-set', confirm }: StarterCrewLedgerProps) {
  const crew = starterRoster(roster)
  const pairs = pairing(crew)
  const paired = new Set([...pairs.values()].map((mech) => mech.id))
  const loose = crew.mechs.filter((mech) => !paired.has(mech.id))
  return (
    <div className="su-dash-group__body">
      <OpenLedger
        title={buildStarterSetCopy('pilotsAndTheirMechs')}
        className="su-open--pairs"
        tally={{ label: buildStarterSetCopy('pilots'), value: crew.pilots.length }}
        columns={PAIR_COLUMNS}
        groups={[
          {
            key: 'pairs',
            rows: crew.pilots.map((pilot) => pilotRow(pilot, pairs.get(pilot.id), confirm)),
          },
          {
            key: 'loose',
            label: buildStarterSetCopy('mechsWithNoPilot'),
            rows: loose.map((mech) => ({
              id: mech.id,
              name: mech.name,
              href: `/starter/mech/${mech.id}`,
              meta: chassisMeta(mech, resolveChassisRef(mech.chassisRef)),
              state: confirm ? (
                <CopyStarterMenu
                  kind="mech"
                  templateId={mech.id}
                  name={mech.name}
                  confirm={confirm}
                />
              ) : undefined,
              cells: ['', '', '', ...mechCells(mech).slice(1)],
            })),
          },
        ]}
        {...(crew.crawlers.length === 0
          ? { cite: <CiteLine text={`${BOOK[roster]} // ${STARTER_SET_PUBLISHER}`} /> }
          : {})}
      />
      {crew.crawlers.length > 0 && (
        <OpenLedger
          title={buildStarterSetCopy('unionCrawler')}
          columns={CRAWLER_COLUMNS}
          groups={[{ key: 'crawlers', rows: crew.crawlers.map((c) => crawlerRow(c, confirm)) }]}
          cite={<CiteLine text={`${BOOK[roster]} // ${STARTER_SET_PUBLISHER}`} />}
        />
      )}
    </div>
  )
}
