/**
 * PilotSheetAbilities — the pilot sheet's Abilities (owner's calls,
 * 2026-10-14, 2026-10-19 and 2026-10-20): two sections, each a collapsible
 * `SlabSection` over a masonry grid (`MiniGrid`) of contentful Minis, each
 * ability its head and then its text, in Read and Edit alike.
 *
 *   1. **Abilities**, on top and open by default: every tree the class gives
 *      access to, whole (owner, round 4), tree by tree in training order
 *      (core, advanced, hybrid, legendary), each tree's in its order, the
 *      untaken abilities greyed and read-only; then any the reference does
 *      not know.
 *   2. **Generic Abilities**, below and folded by default: the Generic tree
 *      every pilot has.
 *
 * Each ability is `PilotAbilityItem`: Edit puts Spend AP and the used/recharge
 * toggle in its chip group. A fold hides its body, never unmounts it.
 *
 * SLABS, not cards: their entities carry their own frame.
 */

import type { CSSProperties } from 'react'
import { Button, EmptyState, MiniGrid, SlabSection, tokens } from '../../components/index'
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
      <li key={slug} className={unlearned ? 'su-pilot-ability--unlearned' : undefined}>
        <PilotAbilityItem
          ability={ability}
          currentAP={currentAP}
          used={usedAbilities?.includes(slug) ?? false}
          onSpend={onSpend}
          onToggleUsed={(next) => onToggleUsed(slug, next)}
          readOnly={readOnly || !!unlearned}
        />
      </li>
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
          {(classTrees.length > 0 || unresolvedAbilities.length > 0) && (
            <MiniGrid label="Tree Abilities" edit={!readOnly}>
              {classTrees.flatMap((group) => group.abilities.map(renderAbility))}
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
            {genericAbilities.map(renderAbility)}
          </MiniGrid>
        </SlabSection>
      )}
    </div>
  )
}
