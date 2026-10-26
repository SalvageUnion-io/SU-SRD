import type { CSSProperties } from 'react'
import type { RefCrawler } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { crawlerMaxSpBonus, crawlerWeaponSlots } from 'salvageunion-reference/rules'
import {
  Callout,
  EmptyState,
  Grid,
  RadioCardGroup,
  ReferenceEntityCard,
  Slab,
  tokens,
} from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { fullWidthStyle, stepColumnStyle } from './wizardStyles.model'

const bonusStyle = { display: 'block', fontFamily: tokens.font.body } satisfies CSSProperties

/**
 * The types stand in a grid, not a masonry: a row of two radio cards shares one
 * height (§4.7), as a masonry's independent columns cannot. Two columns at most,
 * one below 20rem each.
 */
const TYPE_COLUMN = 'max(20rem, calc(50% - var(--space-8)))'

type CrawlerTypeSelectStepProps = {
  types: RefCrawler[]
  /** The chosen type's slug. */
  selectedType: string | null
  onSelect: (slug: string) => void
}

/** The Augmented crawler type's stable id (data/crawlers.json) — the one type
 * with the instructional +1 Training Point callout. Matched by id, never by
 * display name (the file's own "read from the data, never string-matched" rule). */
const AUGMENTED_CRAWLER_ID = '8bffb508-8c8f-418d-b6ce-f24f7266e41b'

/**
 * Step 1 · Choose a Crawler Type (Union Crawler p.212) — exactly one of the
 * five types, radio semantics, each rendered as the SRD entity card inside a
 * SelCard (the universal entity-card rule). A type's
 * stored `mutations` surface as footMeta badges (Battle: 2 weapon slots ·
 * +5 max SP — read from the data, never string-matched). The selected type's
 * FULL card renders below the grid — its unique Ability, its special NPC, and
 * (Augmented) the A.I. Personality roll — plus the Augmented type's
 * instructional +1 Training Point note (TEXT ONLY: the wizard never writes
 * to other characters — ADR-007 automation boundary). Every card here is
 * level 1, so its NPC is a Mini (N1); the note is an unlabelled Callout (N5).
 */
export function CrawlerTypeSelectStep({
  types,
  selectedType,
  onSelect,
}: CrawlerTypeSelectStepProps) {
  const selected = types.find((t) => getEntitySlug(t) === selectedType)
  const isAugmented = selected?.id === AUGMENTED_CRAWLER_ID

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <Slab label={buildWizardCopy('crawlerTypes')} count="Choose 1" countInk="inherit" />
      <RadioCardGroup label={buildWizardCopy('crawlerType')}>
        <Grid min={TYPE_COLUMN} gap={16}>
          {types.map((type) => {
            const slots = crawlerWeaponSlots(type.mutations)
            const spBonus = crawlerMaxSpBonus(type.mutations)
            return (
              <ReferenceEntityCard
                key={type.id}
                data={type}
                size="compact"
                selected={getEntitySlug(type) === selectedType}
                selectionRole="radio"
                cardClickLabel={type.name}
                onCardClick={() => onSelect(getEntitySlug(type))}
                hide={{ actions: true, choices: true }}
                footMeta={[
                  { label: buildWizardCopy('weaponSlots'), value: String(slots) },
                  ...(spBonus > 0
                    ? [{ label: buildWizardCopy('maxSp'), value: `+${spBonus}` }]
                    : []),
                ]}
              />
            )
          })}
        </Grid>
      </RadioCardGroup>

      {selected ? (
        <>
          <Slab
            label={buildWizardCopy('yourCrawlerType')}
            count={selected.name}
            countInk="inherit"
          />
          <div className="su-wiz-stack su-wiz-stack--12" style={stepColumnStyle}>
            <ReferenceEntityCard data={selected} />
            {isAugmented && (
              <Callout tone="crawler">
                <span style={bonusStyle}>
                  Every Pilot gains <strong>{buildWizardCopy('n1TrainingPoint')}</strong>, spendable
                  on the <strong>{buildWizardCopy('augmentAbilityTreeOnly')}</strong>. Apply it on
                  each Pilot&rsquo;s sheet yourself — the wizard never writes to other characters.
                </span>
              </Callout>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          headline={buildWizardCopy('noTypeSelected')}
          body={buildWizardCopy('pickATypeToPreview')}
        />
      )}
    </div>
  )
}
