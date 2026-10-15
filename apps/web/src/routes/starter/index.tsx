import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '../../components/index'
import { StarterSetRoster } from '../../components/starterSet/StarterSetRoster'
import { STARTER_SET_TITLE } from '../../lib/starterSet/starterTemplates'

/**
 * `/starter` — the Starter Set, Leyline Press's pre-generated crew, as a
 * read-only pseudo-Game. Open to anyone; copying needs an account. See
 * `components/starterSet/StarterSetRoster.tsx`.
 */
export const Route = createFileRoute('/starter/')({
  head: () => ({ meta: [{ title: STARTER_SET_TITLE }] }),
  component: StarterSetRoute,
})

function StarterSetRoute() {
  return (
    <PageShell>
      <StarterSetRoster headingLevel="h1" />
    </PageShell>
  )
}
