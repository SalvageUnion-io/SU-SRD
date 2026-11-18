/**
 * CrawlerPhoneSheet — a crawler's Live Sheet on a phone in Read
 * (`PhoneSheet`, R11): the numbers (`vitals`: SP, the Upgrade pool, Upkeep and
 * Pay / Fund / Trade, built by `CrawlerLiveSheet`), then the tabs Bays,
 * Storage, About.
 *
 *  - **Bays** is one Ledger (L9, R46): a line a bay with its crew lead and
 *    their HP, a damaged bay saying so on its stamp; each bay's name Peeks
 *    its card. The Armament Bay's weapons are a second Ledger under it.
 *  - **Storage** is what the crawler holds (`storage`), then who it homes
 *    (the Assigned Units).
 *  - **About** wraps the Description round the art, the type's ability and
 *    crew lead the card's width under both.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { ReactNode } from 'react'
import { EmptyState, Stat } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { assignmentFor } from '../../lib/npcs/npcModel'
import { crawlerTypeArt } from '../../lib/photos/defaultArt'
import { resolveCrawlerSystem } from '../../lib/rules/crawlerItems'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsState, UnitsStore } from '../../replica/units'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import { PhoneSheet } from './PhoneSheet'
import { SheetHero } from './SheetHero'
import { SheetLedger } from './SheetLedger'

export function CrawlerPhoneSheet({
  crawler,
  vitals,
  storage,
  linkedUnits,
  crew,
  store,
  storeState,
}: {
  crawler: Crawler
  /** The phone's vitals block (`PhoneVitals`). */
  vitals: ReactNode
  /** What the Storage Bay holds (`CrawlerStorage`); null when Read has nothing to show. */
  storage: ReactNode
  linkedUnits?: ReactNode
  crew?: readonly CrewAssignment[] | undefined
  store: UnitsStore
  storeState: UnitsState
}) {
  const bays = crawler.crawlerBays ?? []
  const intactBays = bays.filter((b) => (b.condition ?? 'intact') === 'intact').length
  return (
    <PhoneSheet
      name={crawler.name}
      vitals={vitals}
      tabs={[
        {
          value: 'bays',
          label: buildSheetCopy('bays'),
          count: `${intactBays}/${bays.length}`,
          panel: (
            <>
              <SheetLedger
                kind="bays"
                tone="crawler"
                title={buildSheetCopy('bays')}
                count={`${intactBays}/${bays.length} ${buildSheetCopy('intact')}`}
                lines={bays.map((entry, i) => {
                  const bay = resolveCrawlerBay(entry.bayRef)
                  const built = assignmentFor(crew, { kind: 'bay', bayRef: entry.bayRef })?.npc
                  const maxHp = bay?.npc?.hitPoints ?? 0
                  return {
                    id: `${entry.bayRef}-${i}`,
                    entity: bay,
                    name: bay ? undefined : entry.bayRef,
                    stamp:
                      (entry.condition ?? 'intact') === 'damaged' ? (
                        <Stat label={buildSheetCopy('damaged')} size="mini" state="critical" />
                      ) : undefined,
                    cells: {
                      lead: built?.name ?? entry.npcName?.trim() ?? bay?.npc?.position ?? '',
                      hp: maxHp > 0 ? `${entry.npcCurrentHP ?? maxHp}/${maxHp}` : '',
                    },
                  }
                })}
              />
              {crawler.systems.length > 0 && (
                <SheetLedger
                  kind="loadout"
                  title={buildSheetCopy('weapons')}
                  count={crawler.systems.length}
                  lines={crawler.systems.map((slug) => ({
                    id: slug,
                    entity: resolveCrawlerSystem(slug),
                    name: resolveCrawlerSystem(slug) ? undefined : slug,
                  }))}
                />
              )}
            </>
          ),
        },
        {
          value: 'storage',
          label: buildSheetCopy('storage'),
          panel: (
            <>
              {storage ?? <EmptyState variant="quiet" body={buildSheetCopy('nothingStored')} />}
              {linkedUnits}
            </>
          ),
        },
        {
          value: 'about',
          label: buildSheetCopy('about'),
          panel: (
            <SheetHero
              flat
              name={crawler.name}
              fields={
                <CrawlerIdentityPanel
                  crawler={crawler}
                  store={store}
                  storeState={storeState}
                  patch={undefined}
                  readOnly
                  proseUnder
                  typeCrew={assignmentFor(crew, { kind: 'type' })}
                  photo={
                    <EntityPhoto
                      photo={crawler.photo}
                      fallback={crawlerTypeArt(crawler.type)}
                      name={crawler.name}
                    />
                  }
                />
              }
            />
          ),
        },
      ]}
    />
  )
}
