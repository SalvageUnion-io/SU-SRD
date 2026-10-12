import type { CSSProperties } from 'react'
import type { SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassAbilityTree } from './ClassAbilityTree'

export default {
  title: 'Compositions/Entity/Class Ability Tree',
}

/** The page's measure (`ENTITY_PAGE_MEASURE`), so three paths sit across. */
const PAGE: CSSProperties = { maxWidth: '75rem', padding: 'var(--space-16)' }

function Tree({ name }: { name: string }) {
  const classEntity: SURefClass | undefined = SalvageUnionReference.Classes.getByName(name)
  return classEntity ? (
    <div style={PAGE}>
      <ClassAbilityTree classEntity={classEntity} />
    </div>
  ) : null
}

/** A Core class: its brief, its Core trees, then its paths — two hybrids and its own Advanced tree. */
export const Default = () => <Tree name="Engineer" />

/** A Hybrid Class: its own tree and Legendary tree, then the Core trees it branches into. */
export const Hybrid = () => <Tree name="Fabricator" />

/** The Salvager: every Core tree and no paths. */
export const Salvager = () => <Tree name="Salvager" />
