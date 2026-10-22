/**
 * PilotSheetAbilities — the pilot sheet's Abilities (R48): two collapsible
 * `SlabSection`s of
 * contentful Minis, each ability its head and then its text, in Read and Edit
 * alike.
 *
 *   1. **Abilities**, on top and open by default: the trees the class
 *      itself opens (its Core trees; no Advanced trees for a Core class, R48)
 *      and any tree the pilot has taken from, each drawn as the
 *      class page draws it, on its track with its stems, three across at
 *      most, the trees the pilot has taken from first, the untaken abilities
 *      greyed and read-only; then any the reference does not know.
 *   2. **Generic Abilities**, below and folded by default: the Generic tree
 *      every pilot has.
 *
 * Each ability is `PilotAbilityItem`: Edit puts Spend AP and the used/recharge
 * toggle in its chip group. A fold hides its body, never unmounts it.
 *
 * SLABS, not cards: their entities carry their own frame.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import {
  AbilityTrack,
  Button,
  EmptyState,
  MiniGrid,
  SlabSection,
  tokens,
} from '../../components/index'
import { PilotAbilityItem } from './PilotSheetItems'
import type { AbilityEntry, AbilityTreeGroup } from './pilotSheet.model'
import { UnknownItemLine } from './UnknownItemLine'

/** The two slabs, a section's gap apart (the sheet column's own). */
const SECTIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
  minWidth: 0,
} satisfies CSSProperties

/**
 * One tree on its track under a slab naming it, as the class page's
 * (`ClassAbilityTree`): each ability the sheet's own item, the untaken greyed.
 */
function TreeTrackSection({
  group,
  render,
}: {
  group: AbilityTreeGroup
  render: (entry: AbilityEntry) => ReactNode
}) {
  const byId = new Map(group.abilities.map((entry) => [entry.ability.id, entry]))
  const track = group.track ?? 'core'
  return (
    <SlabSection
      title={group.tree}
      count={track === 'legendary' ? 'Choose 1' : 'Tree'}
      className="su-ability-tree__group"
      bodyClassName="su-ability-tree__track"
    >
      <AbilityTrack
        abilities={group.abilities.map((entry) => entry.ability)}
        track={track}
        renderAbility={(ability: RefAbility) => {
          const entry = byId.get(ability.id)
          return entry ? render(entry) : null
        }}
      />
    </SlabSection>
  )
}

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
  /**
   * One ability, its contentful Mini, wherever its tree puts it; one the pilot
   * has not taken greyed, with no controls.
   */
  function renderAbility({ slug, ability, unlearned }: AbilityEntry) {
    return (
      <div key={slug} className={unlearned ? 'su-pilot-ability--unlearned' : undefined}>
        <PilotAbilityItem
          ability={ability}
          currentAP={currentAP}
          used={usedAbilities?.includes(slug) ?? false}
          onSpend={onSpend}
          onToggleUsed={(next) => onToggleUsed(slug, next)}
          readOnly={readOnly || !!unlearned}
          full={!unlearned}
        />
      </div>
    )
  }

  const none =
    !classTrees.some((group) => group.abilities.some((entry) => !entry.unlearned)) &&
    unresolvedAbilities.length === 0
  return (
    <div style={SECTIONS}>
      {/* Read leaves an empty section out (ruleset §1.2): an empty state only
          where Edit can fill it. */}
      {!(readOnly && none) && (
        <SlabSection
          fold="open"
          title="Abilities"
          actions={
            readOnly ? undefined : (
              <Button size="compact" onClick={onManage}>
                Manage Abilities
              </Button>
            )
          }
        >
          {none && <EmptyState variant="quiet" body="No abilities learned yet." />}
          {classTrees.length > 0 && (
            // The trees as the class page draws them, each on its track with
            // its stems, side by side, three across at most.
            <div className="su-pilot-trees">
              {classTrees.map((group) => (
                <TreeTrackSection key={group.tree} group={group} render={renderAbility} />
              ))}
            </div>
          )}
          {unresolvedAbilities.length > 0 && (
            <MiniGrid label="Unknown Abilities" edit={!readOnly}>
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
            </MiniGrid>
          )}
        </SlabSection>
      )}
      {genericAbilities.length > 0 && (
        <SlabSection fold="closed" title="Generic Abilities">
          <MiniGrid label="Generic Abilities" edit={!readOnly}>
            {genericAbilities.map((entry) => (
              <li key={entry.slug}>{renderAbility(entry)}</li>
            ))}
          </MiniGrid>
        </SlabSection>
      )}
    </div>
  )
}
