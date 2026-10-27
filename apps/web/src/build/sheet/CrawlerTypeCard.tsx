import type { UnitsStore } from '../../replica/units'
/**
 * CrawlerTypeCard — the crawler type's prose, its special ability and its
 * crew, for the identity panel to lay out (split from CrawlerSheetItems.tsx).
 */

import type { CrawlerNpcState } from 'game-domain/schemas/crawler'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import type { ChoiceSelections } from '../../components/index'
import { Content, MiniGrid, tokens } from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { CrawlerCrewLead } from './CrawlerCrewLead'

const TYPE_STACK = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

type CrawlerTypeCardProps = {
  crawlerId: string
  /** The crawler-type ref (SRD id) — also the bayChoices key for its NPC. */
  typeRef: string
  /** Live state for the type's special NPC. */
  typeNpc: CrawlerNpcState | undefined
  /** Persisted Keepsake/Motto selections for the type NPC (from the crawler prop). */
  seedSelections: ChoiceSelections | undefined
  store: UnitsStore
  readOnly: boolean
  /**
   * The type's special ability, one `li` a contentful Mini. Rendered INSIDE
   * this card, in one masonry grid with the crew lead, because both describe
   * the same type.
   */
  ability?: ReactNode
  /** The built NPC filling the type's NPC slot (ADR-044); see CrawlerBayCard. */
  assigned?: CrewAssignment
}

/**
 * CrawlerTypeCard — the chosen crawler type's description and special
 * action(s), with its special NPC as a bay's crew lead is (`CrawlerCrewLead`);
 * its structured state persists into the `typeNpc` field.
 */
export function CrawlerTypeCard({
  crawlerId,
  typeRef,
  typeNpc,
  seedSelections,
  store,
  readOnly,
  ability,
  assigned,
}: CrawlerTypeCardProps) {
  const storeState = store()
  const { selections, setSelections } = useEntityChoices(
    'crawler',
    crawlerId,
    typeRef,
    'bayChoices',
    seedSelections,
    store
  )
  const type = resolveCrawlerType(typeRef)
  if (!type) return null

  function patchNpc(patch: Partial<CrawlerNpcState>) {
    const fresh = storeState.get('crawler', crawlerId)
    runWrite(() =>
      storeState.update(
        'crawler',
        crawlerId,
        {
          typeNpc: { ...(fresh?.typeNpc ?? {}), ...patch },
        },
        LIVE_SHEET_MANUAL
      )
    )
  }

  const crew = type.npc ? (
    <CrawlerCrewLead
      npc={type.npc}
      slot={type}
      state={typeNpc}
      selections={selections}
      setSelections={setSelections}
      onPatch={readOnly ? undefined : patchNpc}
      assigned={assigned}
    />
  ) : undefined

  // NO card container: a full entity card here would be a frame around a frame
  // around a frame. Its INTERNALS are handed back instead, for the identity
  // panel to lay out beside its own fields.
  //
  // The type's own choices ride the ability column, so a type that carries a
  // permanent pick is editable without a card to host it.
  // The type's own PROSE survives the dissolved card. Losing the frame was the
  // point; losing the paragraph that says what an Exploratory crawler IS was
  // not — it is the only place that text appears on the sheet.
  // The cast is the duplicated-structural-type problem, not a shape mismatch:
  // `src/components` and `salvageunion-reference` each declare their own content
  // block type with identical members, so TS treats them as unrelated.
  const description = <Content body={type.content as ComponentProps<typeof Content>['body']} />

  return (
    <div style={TYPE_STACK}>
      {description}
      {/* Ability ∥ crew: one masonry grid of contentful Minis (`MiniGrid`). */}
      <MiniGrid label={buildSheetCopy('abilityAndCrew', { name: type.name })}>
        {ability}
        {crew && <li>{crew}</li>}
      </MiniGrid>
    </div>
  )
}
