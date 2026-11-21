/**
 * TypeCrewLead — the crawler type's special NPC as a bay's crew lead is
 * (`CrawlerCrewLead`), its fields in Edit; its structured state persists into
 * `typeNpc`, its Keepsake and Motto into the type's choices.
 */

import type { Crawler, CrawlerNpcState } from 'game-domain/schemas/crawler'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { runWrite } from '../../lib/runWrite'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { CrawlerCrewLead } from './CrawlerCrewLead'

export function TypeCrewLead({
  crawler,
  typeRef,
  store,
  assigned,
}: {
  crawler: Crawler
  /** The crawler-type ref (SRD id), also the bayChoices key for its NPC. */
  typeRef: string
  store: UnitsStore
  /** The built NPC filling the type's NPC slot (ADR-044). */
  assigned?: CrewAssignment | undefined
}) {
  const storeState = store()
  const { selections, setSelections } = useEntityChoices(
    'crawler',
    crawler.id,
    typeRef,
    'bayChoices',
    crawler.bayChoices?.[typeRef],
    store
  )
  const type = resolveCrawlerType(typeRef)
  if (!type?.npc) return null

  function patchNpc(patch: Partial<CrawlerNpcState>) {
    const fresh = storeState.get('crawler', crawler.id)
    runWrite(() =>
      storeState.update(
        'crawler',
        crawler.id,
        { typeNpc: { ...(fresh?.typeNpc ?? {}), ...patch } },
        LIVE_SHEET_MANUAL
      )
    )
  }

  return (
    <CrawlerCrewLead
      npc={type.npc}
      slot={type}
      state={crawler.typeNpc}
      selections={selections}
      setSelections={setSelections}
      onPatch={patchNpc}
      assigned={assigned}
    />
  )
}
