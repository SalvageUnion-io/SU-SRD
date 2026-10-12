import { extractStaticEntitySummary, SalvageUnionReference } from 'salvageunion-reference'
import { StaticEntityContent } from './StaticEntityContent'

export default {
  title: 'Compositions/Entity/Static Entity Content',
}

/**
 * The SSR / no-JS entity fallback (converted from srd),
 * built from a real Equipment summary via `extractStaticEntitySummary` — the
 * same path the static site uses, its references kept, so every trait it
 * names is a Mention to its page.
 */
export const Default = () => {
  const equipment = SalvageUnionReference.Equipment.all()
  const entity =
    equipment.find((e) => extractStaticEntitySummary(e).traits.length > 0) ?? equipment[0]
  if (!entity) return null
  const summary = extractStaticEntitySummary(entity, { keepReferences: true })

  return <StaticEntityContent summary={summary} />
}
