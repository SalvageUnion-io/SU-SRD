/**
 * CrawlerTypeCard — the crawler type's prose, its special ability and its
 * crew, for the identity panel to lay out (split from CrawlerSheetItems.tsx).
 */

import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { ChoiceSelections } from 'component-lib'
import { Content, tokens } from 'component-lib'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { findNpcChoiceByName, resolveCrawlerType } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { runWrite } from '../../lib/runWrite'
import type { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { LinkedCrewInset } from '../npc/LinkedCrewInset'
import { useEntityChoices } from '../shared/useEntityChoices'
import { NpcInset } from './NpcInset'

const TYPE_STACK = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** Ability ∥ crew; the column template is `.su-sheet-crawler-type-grid` (it steps at @2xl). */
const TYPE_GRID = {
  display: 'grid',
  minWidth: 0,
  alignItems: 'start',
  gap: tokens.space[12],
} satisfies CSSProperties

type CrawlerNpcState = NonNullable<Crawler['typeNpc']>

type CrawlerTypeCardProps = {
  crawlerId: string
  /** The crawler-type ref (SRD id) — also the bayChoices key for its NPC. */
  typeRef: string
  /** Live state for the type's special NPC. */
  typeNpc: CrawlerNpcState | undefined
  /** Persisted Keepsake/Motto selections for the type NPC (from the crawler prop). */
  seedSelections: ChoiceSelections | undefined
  store: typeof useEntityStore
  readOnly: boolean
  /**
   * The type's special-ability card(s). Rendered INSIDE this card, beside the
   * crew inset (see the `expand` slot), because both describe the same type.
   */
  ability?: ReactNode
  /** The built NPC filling the type's NPC slot (ADR-044); see CrawlerBayCard. */
  assigned?: CrewAssignment
}

/**
 * CrawlerTypeCard — the chosen crawler type as an entity card (description +
 * special action(s)), with its special NPC rendered as an NpcInset in the
 * expand slot. Mirrors CrawlerBayCard: the SRD npc block is stripped from the
 * card (it lives in the inset); Keepsake/Motto persist through the NPC's
 * freeform choices into the crawler's bayChoices map keyed by the type ref;
 * structured name/HP/description/facts persist into the `typeNpc` field.
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

  const npc = type.npc
  const maxHP = npc?.hitPoints ?? 0

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

  const keepsakeChoice = findNpcChoiceByName(npc, 'Keepsake')
  const keepsake = keepsakeChoice ? (selections[keepsakeChoice.id]?.[0] ?? '') : ''
  function setKeepsake(next: string) {
    if (!keepsakeChoice) return
    setSelections({
      ...selections,
      [keepsakeChoice.id]: next.trim().length > 0 ? [next] : [],
    })
  }
  const mottoChoice = findNpcChoiceByName(npc, 'Motto')
  const motto = mottoChoice ? (selections[mottoChoice.id]?.[0] ?? '') : ''
  function setMotto(next: string) {
    if (!mottoChoice) return
    setSelections({
      ...selections,
      [mottoChoice.id]: next.trim().length > 0 ? [next] : [],
    })
  }

  const inlineReadOnly = readOnly || assigned !== undefined
  const inlineCrew = npc ? (
    <NpcInset
      bayName={type.name}
      title={npc.position}
      name={typeNpc?.npcName ?? ''}
      hp={typeNpc?.npcCurrentHP ?? maxHP}
      maxHp={maxHP}
      keepsake={keepsake}
      motto={motto}
      detail={typeNpc?.npcDescription ?? ''}
      facts={typeNpc?.npcFacts ?? []}
      // Handler absence IS the read-only encoding: readOnly branches once
      // here instead of per-handler ternaries + a second readOnly prop.
      {...(inlineReadOnly
        ? {}
        : {
            onNameChange: (next: string) => patchNpc({ npcName: next }),
            onHpChange: (next: number) => patchNpc({ npcCurrentHP: next }),
            onKeepsakeChange: keepsakeChoice ? setKeepsake : undefined,
            onMottoChange: mottoChoice ? setMotto : undefined,
            onDetailChange: (next: string) => patchNpc({ npcDescription: next }),
            onFactsChange: (next: string[]) => patchNpc({ npcFacts: next }),
          })}
    />
  ) : undefined
  const crew =
    assigned && inlineCrew ? (
      <LinkedCrewInset slotName={type.name} assignment={assigned} fallback={inlineCrew} />
    ) : (
      inlineCrew
    )

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
  // `component-lib` and `salvageunion-reference` each declare their own content
  // block type with identical members, so TS treats them as unrelated.
  const description = <Content body={type.content as ComponentProps<typeof Content>['body']} />

  return (
    <div style={TYPE_STACK}>
      {description}
      <div className="su-sheet-crawler-type-grid" style={TYPE_GRID}>
        {ability}
        {crew}
      </div>
    </div>
  )
}
