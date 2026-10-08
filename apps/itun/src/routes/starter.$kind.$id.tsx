import { createFileRoute, useParams } from '@tanstack/react-router'
import { StarterSheetView } from '../components/starterSet/StarterSheetView'
import { pageTitle } from '../lib/pageTitle'

/**
 * `/starter/$kind/$id` — one Starter Set build's sheet, read-only and open to
 * anyone. Addressed by the template's own id (`starter-pilot-bonesaw`, …),
 * which never reaches an account: a copy gets a fresh one.
 *
 * The page body is `StarterSheetView`; this file exports only `Route` so
 * `autoCodeSplitting` keeps the sheet tree out of the entry chunk (see
 * `routes/__tests__/routeExports.test.ts`).
 */
export const Route = createFileRoute('/starter/$kind/$id')({
  head: () => ({ meta: [{ title: pageTitle('Starter Set') }] }),
  component: StarterSheetRoute,
})

function StarterSheetRoute() {
  const { kind, id } = useParams({ from: '/starter/$kind/$id' })
  return <StarterSheetView kind={kind} id={id} />
}
