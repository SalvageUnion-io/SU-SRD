import type { CSSProperties, ReactNode } from 'react'
import type { RefCrawler } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { crawlerMaxSpBonus, crawlerWeaponSlots } from 'salvageunion-reference/rules'
import { Callout, EmptyState, ReferenceEntityCard, tokens } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { PickList } from './PickList'
import type { PickColumn } from './pickLedger.model'

const bonusStyle = { display: 'block', fontFamily: tokens.font.body } satisfies CSSProperties

type CrawlerTypeSelectStepProps = {
  types: RefCrawler[]
  /** The chosen type's slug. */
  selectedType: string | null
  onSelect: (slug: string) => void
  /** MOCK (wave 2): the crawler's fixed numbers, a part under the picker. */
  stats?: ReactNode
}

/** The Augmented crawler type's stable id (data/crawlers.json) — the one type
 * with the instructional +1 Training Point callout. Matched by id, never by
 * display name (the file's own "read from the data, never string-matched" rule). */
const AUGMENTED_CRAWLER_ID = '8bffb508-8c8f-418d-b6ce-f24f7266e41b'

/**
 * MOCK (wave 2): what tells the five types apart, read from the data: the
 * Ability only that type has, the special NPC it brings, and what its stored
 * `mutations` change (its Armament Bay's weapons, its Max SP).
 */
const TYPE_COLUMNS: readonly PickColumn<RefCrawler>[] = [
  {
    key: 'npc',
    label: 'Special NPC',
    kind: 'text',
    value: (type) => type.npc?.position ?? '',
  },
  {
    key: 'sp',
    label: 'Max SP',
    title: 'Its bonus to Max Structure Points',
    value: (type) => {
      const bonus = crawlerMaxSpBonus(type.mutations)
      return bonus > 0 ? `+${bonus}` : ''
    },
  },
  {
    key: 'weapons',
    label: 'Weapons',
    title: 'Weapons Systems its Armament Bay mounts',
    phone: true,
    value: (type) => crawlerWeaponSlots(type.mutations),
  },
  {
    key: 'ability',
    label: 'Ability',
    kind: 'quiet',
    phone: true,
    value: (type) => (Array.isArray(type.actions) ? type.actions.join(', ') : ''),
  },
]

/**
 * MOCK (Working Manual, wave 2) · Step 1 · Choose a Crawler Type, as a picker
 * in the Ledger form (`PickList`): the five types a line each, the Ability
 * only that type has in the open (it was hidden until the pick), exactly one
 * picked (radio). The pick stands beside the list as its contentful card (its
 * Ability, its special NPC), with the Augmented type's +1 Training Point note
 * (TEXT ONLY: the wizard never writes to other characters, ADR-007). The
 * crawler's fixed numbers, a step of their own in the book, are the part under
 * the list.
 */
export function CrawlerTypeSelectStep({
  types,
  selectedType,
  onSelect,
  stats,
}: CrawlerTypeSelectStepProps) {
  const selected = types.find((t) => getEntitySlug(t) === selectedType)
  const isAugmented = selected?.id === AUGMENTED_CRAWLER_ID

  return (
    <div className="su-wiz-compare-layout">
      <div className="su-wiz-compare-main">
        <div>
          <PickList
            title={buildWizardCopy('crawlerTypes')}
            note="Choose 1"
            rows={types}
            rowKey={getEntitySlug}
            rowName={(type) => type.name}
            columns={TYPE_COLUMNS}
            selected={selectedType ?? undefined}
            onSelect={onSelect}
            foot={{ cite: 'Workshop Manual · p.212 · Crawler Types pp.216–217' }}
          />
        </div>
        {selected && stats}
      </div>
      <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky">
        {selected ? (
          <>
            <ReferenceEntityCard data={selected} size="compact" />
            {isAugmented && (
              <Callout tone="crawler">
                <span style={bonusStyle}>
                  Every Pilot gains <strong>{buildWizardCopy('n1TrainingPoint')}</strong>, spendable
                  on the <strong>{buildWizardCopy('augmentAbilityTreeOnly')}</strong>. Apply it on
                  each Pilot&rsquo;s sheet yourself — the wizard never writes to other characters.
                </span>
              </Callout>
            )}
          </>
        ) : (
          <EmptyState
            variant="quiet"
            body={buildWizardCopy('pickATypeToPreview')}
            bodyInk="inherit"
          />
        )}
      </div>
    </div>
  )
}
