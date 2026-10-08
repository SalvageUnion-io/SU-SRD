import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from 'component-lib'
import { StarterSetRoster } from '../components/starterSet/StarterSetRoster'
import { pageTitle } from '../lib/pageTitle'

/**
 * `/starter` — the Starter Set, Leyline Press's pre-generated crew, as a
 * read-only pseudo-Game. Open to anyone; copying needs an account. See
 * `components/starterSet/StarterSetRoster.tsx`.
 */
export const Route = createFileRoute('/starter/')({
  head: () => ({ meta: [{ title: pageTitle('Starter Set') }] }),
  component: StarterSetRoute,
})

function StarterSetRoute() {
  return (
    <PageShell>
      <StarterSetRoster headingLevel="h1" />
    </PageShell>
  )
}
