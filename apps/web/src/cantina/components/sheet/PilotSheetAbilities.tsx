/**
 * PilotSheetAbilities — the pilot sheet's Abilities (owner's call,
 * 2026-10-14): each tree the pilot has trained in as the SRD's Tree view
 * draws it, only the Abilities taken, as Rows on the tree's track (tier
 * numerals, a Legendary tree's "or"); then the Generic tree every pilot has,
 * in its own section beneath, as Tokens that Peek their card. Edit puts Spend
 * AP and the used/recharge toggle on each line (`PilotAbilityItem`).
 *
 * SLABS, not cards: their entities carry their own frame.
 */

import type { CSSProperties } from 'react'
import { AbilityTrack, EmptyState, Panel, SheetSectionSlab, Slab, tokens } from '../../../ui/index'
import { PilotAbilityItem } from './PilotSheetItems'
import type { AbilityEntry, AbilityTreeGroup } from './pilotSheet.model'
import { SectionManageButton } from './SheetSection'

const STACK_8 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const STACK_16 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const STACK_20 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[20],
} satisfies CSSProperties

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

  return (
    <div className="su-sheet-pilot-order-1" style={SECTIONS}>
      <SheetSectionSlab
        title="Abilities"
        controls={
          readOnly ? undefined : <SectionManageButton label="abilities" onClick={onManage} />
        }
      >
        {classTrees.length === 0 && unresolvedAbilities.length === 0 ? (
          <EmptyState variant="quiet" body="No abilities learned yet." />
        ) : (
          <div style={STACK_20}>
            {classTrees.map((group) => (
              <section key={group.tree} aria-label={`${group.tree} Tree`} style={STACK_16}>
                <Slab
                  variant="solid"
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
              </section>
            ))}

            {unresolvedAbilities.length > 0 && (
              <div style={STACK_8}>
                {unresolvedAbilities.map((slug) => (
                  <Panel key={slug} className="su-sheet-pilot-panel-text">
                    {slug}
                  </Panel>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetSectionSlab>
      {genericAbilities.length > 0 && (
        <SheetSectionSlab title="Generic Abilities">
          <ul aria-label="Generic Abilities" className={tokenListClass}>
            {genericAbilities.map((entry) => (
              <li key={entry.slug}>{renderAbility(entry)}</li>
            ))}
          </ul>
        </SheetSectionSlab>
      )}
    </div>
  )
}
