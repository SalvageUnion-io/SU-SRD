import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'component-lib'
import { SavePatternPage } from '../../../components/mech/Pattern/SavePatternPage'
import { pageTitle } from '../../../lib/pageTitle'

/**
 * `/mechs/patterns/new?from=<mechId>` — save a mech as a pattern (issue 1276,
 * board P1). Reached from the mech sheet's ⋯ menu. A pattern shared beyond its
 * maker opens on its own page, where the link is; one kept private goes to the
 * patterns shelf.
 */
export const Route = createFileRoute('/mechs/patterns/new')({
  head: () => ({ meta: [{ title: pageTitle('Save as pattern') }] }),
  validateSearch: (search: Record<string, unknown>): { from: string } => ({
    from: typeof search.from === 'string' ? search.from : '',
  }),
  component: SavePatternRoute,
})

function SavePatternRoute() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()

  return (
    <SavePatternPage
      mechId={from}
      onSaved={(patternId, visibility) => {
        toast.success('Pattern saved.')
        if (visibility === 'private') void navigate({ to: '/mechs/patterns' })
        else void navigate({ to: '/p/$kind/$appId', params: { kind: 'pattern', appId: patternId } })
      }}
      onCancel={() =>
        void navigate(
          from ? { to: '/sheet/$kind/$id', params: { kind: 'mech', id: from } } : { to: '/' }
        )
      }
    />
  )
}
