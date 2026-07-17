import type { Story } from '@ladle/react'
import { SalvageUnionReference, extractStaticEntitySummary } from 'salvageunion-reference'
import { StaticEntityContent } from './StaticEntityContent'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Static Entity Content',
}

/**
 * The SSR / no-JS entity fallback (converted from srd),
 * built from a real Equipment summary via `extractStaticEntitySummary` — the
 * same path the static site uses. Traits link out through the injected
 * `resolveTraitHref` (here a slug approximation of the reference site's route).
 */
export const Default: Story = () => {
  const equipment = SalvageUnionReference.Equipment.all()
  const entity =
    equipment.find((e) => extractStaticEntitySummary(e).traits.length > 0) ?? equipment[0]
  if (!entity) return null
  const summary = extractStaticEntitySummary(entity)

  return (
    <StaticEntityContent
      summary={summary}
      resolveTraitHref={(t) => `/schema/traits/item/${t.toLowerCase().replace(/\s+/g, '-')}/`}
    />
  )
}
