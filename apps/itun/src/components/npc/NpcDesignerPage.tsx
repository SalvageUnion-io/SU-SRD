/**
 * NpcDesignerPage — `/npcs/new`, the one NPC designer with two modes (issue 1277;
 * `docs/architecture/npc-builder.md`).
 *
 * "Any NPC | Crawler crew" is a tab row on the band (`?view=any|crew`):
 *
 *  - **Any NPC** (board N1) on the Denizens navy band — five steps from a
 *    reference template or a blank start (`AnyNpcDesigner`).
 *  - **Crawler crew** (board N2) on the crawler band — a crawler's type and
 *    bay slots, designed and assigned (`CrewBoard`, `&crawler=&slot=`).
 *
 * Both bands are solid: the designer is a tool, and the hatched user-made
 * band belongs to an NPC's own page (D9). The selected tab is ink, never
 * rust; rust is only for the do-buttons (Next, Save and assign, Roll).
 *
 * Router-agnostic, as `NewEntityScreen` is: the route maps every change onto
 * the URL. Signed out, `NewEntityScreen` shows the sign-in panel instead.
 */

import { ChapterBand, Tab, TabList, TabPanel, Tabs, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { useEntityStore } from '../../stores/entityStore'
import { AnyNpcDesigner } from './AnyNpcDesigner'
import { CrewBoard } from './CrewBoard'
import { EYEBROW, PAGE } from './npcStyles'

export type NpcDesignerView = 'any' | 'crew'

type NpcDesignerPageProps = {
  view: NpcDesignerView
  /** `&crawler=<id>` (crew view). */
  crawlerId: string | undefined
  /** `&slot=<bayRef|type>` (crew view). */
  slot: string | undefined
  onViewChange: (view: NpcDesignerView) => void
  onCrewSelect: (next: { crawler?: string | undefined; slot?: string | undefined }) => void
  /** An Any NPC design was saved — go to its sheet. */
  onCreated: (npcId: string) => void
  onCancel: () => void
}

export function NpcDesignerPage({
  view,
  crawlerId,
  slot,
  onViewChange,
  onCrewSelect,
  onCreated,
  onCancel,
}: NpcDesignerPageProps) {
  const { mode } = useConnection()
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const me = useQuery(api.account.me, signedIn ? {} : 'skip')
  const madeBy = me?.displayName ?? 'you'
  const crawler = useEntityStore((s) => (crawlerId ? s.get('crawler', crawlerId) : null))
  const typeName = crawler?.type ? resolveCrawlerType(crawler.type)?.name : undefined

  const crew = view === 'crew'
  const eyebrow = crew
    ? [crawler?.name ?? 'Union crawler', typeName ? `${typeName} type` : null, 'Crew']
        .filter(Boolean)
        .join(' · ')
    : 'Denizens · New NPC'

  return (
    <main style={PAGE}>
      <Tabs value={view} onValueChange={onViewChange}>
        <ChapterBand
          tone={crew ? 'crawler' : 'denizen'}
          // The crawler pink behind paper text needs the deeper crawlerBand. Passed here,
          // not set in ChapterBand, so every other crawler band keeps its tone (issue 1251).
          fill={crew ? tokens.color.crawlerBand : undefined}
          measure="80rem"
          eyebrow={<p style={EYEBROW}>{eyebrow}</p>}
          aside={
            <TabList label="What to design">
              <Tab value="any">Any NPC</Tab>
              <Tab value="crew">Crawler crew</Tab>
            </TabList>
          }
        >
          {crew ? 'Crawler crew' : 'Design an NPC'}
        </ChapterBand>
        <TabPanel value="any">
          <AnyNpcDesigner madeBy={madeBy} onCreated={onCreated} onCancel={onCancel} />
        </TabPanel>
        <TabPanel value="crew">
          <CrewBoard crawlerId={crawlerId} slot={slot} madeBy={madeBy} onSelect={onCrewSelect} />
        </TabPanel>
      </Tabs>
    </main>
  )
}
