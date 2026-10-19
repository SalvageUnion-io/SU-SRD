/**
 * PilotSheetAbilities — the pilot sheet's Abilities (owner's calls,
 * 2026-10-14 and 2026-10-19): two sections, each a collapsible `SlabSection`
 * over a masonry grid (`MasonryColumns`) of the ability components, in Read
 * and Edit alike.
 *
 *   1. **Abilities**, on top and open by default: the tree abilities, each
 *      tree the pilot trained in (core, advanced, hybrid, legendary) as the
 *      SRD's Tree view draws it, only the Abilities taken, as Rows on the
 *      tree's track (tier numerals, a Legendary tree's "or"); one tree a cell.
 *   2. **Generic Abilities**, below and folded by default: the Generic tree
 *      every pilot has, as Tokens that Peek their card; one ability a cell.
 *
 * The ability components stay what they are (`PilotAbilityItem`): Edit puts
 * Spend AP and the used/recharge toggle on each line. A fold hides its body,
 * never unmounts it.
 *
 * SLABS, not cards: their entities carry their own frame.
 */

import type { CSSProperties } from 'react'
import {
  AbilityTrack,
  EmptyState,
  MasonryColumns,
  Slab,
  SlabSection,
  Stack,
  tokens,
} from '../../components/index'
import { PilotAbilityItem } from './PilotSheetItems'
import type { AbilityEntry, AbilityTreeGroup } from './pilotSheet.model'
import { SectionManageButton } from './SheetSection'
import { UnknownItemLine } from './UnknownItemLine'

/** The two slabs, a section's gap apart (the sheet column's own). */
const SECTIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
  minWidth: 0,
} satisfies CSSProperties

/** A tree's track takes a Row's room: two trees a line at most. */
const TREE_COLUMNS = 2

/** A Generic ability is a Token: three a line at most. */
const GENERIC_COLUMNS = 3

type PilotSheetAbilitiesProps = {
  classTrees: AbilityTreeGroup[]
  genericAbilities: AbilityEntry[]
  unresolvedAbilities: string[]
  usedAbilities: string[] | undefined
  currentAP: number
  readOnly: boolean
  /** Opens the Add Abilities picker. */
  onManage: () => void
  onSpend: (cost: number) => void
  onToggleUsed: (slug: string, next: boolean) => void
  /** Unlearn an ability the reference does not know (Edit). */
  onRemoveUnknown: (slug: string) => void
}

export function PilotSheetAbilities({
  classTrees,
  genericAbilities,
  unresolvedAbilities,
  usedAbilities,
  currentAP,
  readOnly,
  onManage,
  onSpend,
  onToggleUsed,
  onRemoveUnknown,
}: PilotSheetAbilitiesProps) {
  // Edit gives each Token's line its controls.
  const tokenListClass = readOnly ? 'su-entity-token-list' : 'su-entity-token-list su-sheet-items'

  /** One learned ability — identical wherever its tree puts it, a Row on a track. */
  function renderAbility({ slug, ability }: AbilityEntry, form: 'token' | 'row' = 'token') {
    return (
      <PilotAbilityItem
        form={form}
        ability={ability}
        currentAP={currentAP}
        used={usedAbilities?.includes(slug) ?? false}
        onSpend={onSpend}
        onToggleUsed={(next) => onToggleUsed(slug, next)}
        readOnly={readOnly}
      />
    )
  }

  const none = classTrees.length === 0 && unresolvedAbilities.length === 0
  return (
    <div style={SECTIONS}>
      {/* Read leaves an empty section out (ruleset §1.2): an empty state only
          where Edit can fill it. */}
      {!(readOnly && none) && (
        <SlabSection
          fold="open"
          title="Abilities"
          actions={
            readOnly ? undefined : <SectionManageButton label="abilities" onClick={onManage} />
          }
        >
          {none ? (
            <EmptyState variant="quiet" body="No abilities learned yet." />
          ) : (
            <MasonryColumns maxColumns={TREE_COLUMNS}>
              {classTrees.map((group) => (
                <Stack as="section" gap={16} key={group.tree} aria-label={`${group.tree} Tree`}>
                  <Slab
                    label={group.tree}
                    count={group.track === 'legendary' ? 'Choose 1' : 'Tree'}
                  />
                  {group.track ? (
                    <AbilityTrack
                      abilities={group.abilities.map((entry) => entry.ability)}
                      track={group.track}
                      renderAbility={(ability) => {
                        const entry = group.abilities.find((e) => e.ability.id === ability.id)
                        return entry ? renderAbility(entry, 'row') : null
                      }}
                    />
                  ) : (
                    <ul aria-label={`${group.tree} Abilities`} className={tokenListClass}>
                      {group.abilities.map((entry) => (
                        <li key={entry.slug}>{renderAbility(entry)}</li>
                      ))}
                    </ul>
                  )}
                </Stack>
              ))}
              {unresolvedAbilities.length > 0 && (
                <ul key="unknown" aria-label="Unknown Abilities" className={tokenListClass}>
                  {unresolvedAbilities.map((slug) => (
                    <li key={slug}>
                      <UnknownItemLine
                        slug={slug}
                        schemaName="abilities"
                        readOnly={readOnly}
                        onRemove={() => onRemoveUnknown(slug)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </MasonryColumns>
          )}
        </SlabSection>
      )}
      {genericAbilities.length > 0 && (
        <SlabSection fold="closed" title="Generic Abilities">
          <MasonryColumns maxColumns={GENERIC_COLUMNS}>
            {genericAbilities.map((entry) => (
              <div key={entry.slug}>{renderAbility(entry)}</div>
            ))}
          </MasonryColumns>
        </SlabSection>
      )}
    </div>
  )
}
