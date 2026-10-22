import { createFileRoute } from '@tanstack/react-router'
import { StarterSetRoster } from '../../build/starterSet/StarterSetRoster'
import { PageShell } from '../../components/index'
import { STARTER_SET_TITLE } from '../../lib/starterSet/starterTemplates'

/**
 * `/starter` — the Starter Set, Leyline Press's pre-generated crew, as a
 * read-only pseudo-Game. Open to anyone; copying needs an account. See
 * `build/starterSet/StarterSetRoster.tsx`.
 */
export const Route = createFileRoute('/starter/')({
  head: () => ({ meta: [{ title: STARTER_SET_TITLE }] }),
  validateSearch: (search: Record<string, unknown>): { copy?: string } =>
    typeof search.copy === 'string' ? { copy: search.copy } : {},
  component: StarterSetRoute,
})

function StarterSetRoute() {
  const { copy } = Route.useSearch()
  return (
    <PageShell>
      <StarterSetRoster headingLevel="h1" copy={copy} />
    </PageShell>
  )
}
