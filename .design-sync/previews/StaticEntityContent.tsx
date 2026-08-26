/* Ported from packages/component-lib/src/components/shared/StaticEntityContent.stories.tsx. */
import { StaticEntityContent } from 'component-lib'
import { extractStaticEntitySummary, SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/**
 * The SSR / no-JS entity fallback — this is what 82% of the reference site's
 * entity pages actually ship, with no JavaScript at all. Built from a real
 * Equipment summary via `extractStaticEntitySummary`, the same path the static
 * site uses. Traits link out through the injected `resolveTraitHref`.
 */
export function WithTraits() {
  const equipment = SalvageUnionReference.Equipment.all()
  const entity =
    equipment.find((e) => extractStaticEntitySummary(e).traits.length > 0) ?? equipment[0]
  if (!entity) return null
  return (
    <div className="bg-paper p-4">
      <Caption>{entity.name}</Caption>
      <StaticEntityContent
        summary={extractStaticEntitySummary(entity)}
        resolveTraitHref={(t) => `/schema/traits/item/${t.toLowerCase().replace(/\s+/g, '-')}/`}
      />
    </div>
  )
}

/** A system rather than a weapon — the same fallback over a different schema. */
export function System() {
  const entity = SalvageUnionReference.Systems.all()[0]
  if (!entity) return null
  return (
    <div className="bg-paper p-4">
      <Caption>{entity.name}</Caption>
      <StaticEntityContent
        summary={extractStaticEntitySummary(entity)}
        resolveTraitHref={(t) => `/schema/traits/item/${t.toLowerCase().replace(/\s+/g, '-')}/`}
      />
    </div>
  )
}
