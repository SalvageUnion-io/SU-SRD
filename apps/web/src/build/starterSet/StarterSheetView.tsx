/**
 * StarterSheetView — one book crew's build's sheet (the Starter Set's or the
 * Quickstart's): the real `<Sheet>`, read
 * only, over the templates themselves. Its band offers "Make a copy" in its
 * top-right corner, and says nothing else: the page is plainly the
 * Starter Set's, and a sheet with no edit controls is plainly read-only.
 *
 * The store is `makeReadOnlySheetStore` over every book crew, so the
 * sheet resolves the build's mech, pilot and crawler from the same crew and its
 * rail links stay inside `/starter`. Every write that store is asked for throws,
 * and `readOnly` withdraws every edit affordance before one could be asked for:
 * nothing anyone does here changes a template. Reading, rolling and browsing
 * the sheet need no account; "Make a copy" (signed in) is the way to play one.
 */

import { isSheetKind } from 'game-domain/entityKinds'
import type { EntityRef } from 'game-domain/schemas/entity'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { useConfirm } from '../../components/shared/useConfirm'
import { STARTER_ROSTERS, starterTemplate } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { makeReadOnlySheetStore } from '../sheet/readOnlySheetStore.model'
import { Sheet } from '../sheet/Sheet'
import { MakeACopy } from './MakeACopy'

/** One store for every book crew's sheet: the templates never change, and their ids never collide. */
const STARTER_STORE = makeReadOnlySheetStore({
  pilots: STARTER_ROSTERS.flatMap((r) => r.pilots),
  mechs: STARTER_ROSTERS.flatMap((r) => r.mechs),
  crawlers: STARTER_ROSTERS.flatMap((r) => r.crawlers),
  npcs: [],
  softLinks: STARTER_ROSTERS.flatMap((r) => r.softLinks),
})

const starterHref = (kind: EntityRef['type'], id: string) => `/starter/${kind}/${id}`

export function StarterSheetView({ kind, id }: { kind: string; id: string }) {
  const { confirm, dialog } = useConfirm()
  const template = isSheetKind(kind) ? starterTemplate(kind, id) : null

  if (!isSheetKind(kind) || template === null) {
    return (
      <NotFoundPanel
        title={buildStarterSetCopy('thatIsntInTheStarter')}
        message={buildStarterSetCopy('noStarterSetBuildLives')}
        back={{ href: '/starter', label: buildStarterSetCopy('starterSet2') }}
      />
    )
  }

  return (
    <>
      <Sheet
        kind={kind}
        id={id}
        store={STARTER_STORE}
        hrefFor={starterHref}
        back={{ href: '/starter', label: buildStarterSetCopy('starterSet2') }}
        readOnly
        bandActions={
          <MakeACopy kind={kind} templateId={id} name={template.name} confirm={confirm} />
        }
      />
      {dialog}
    </>
  )
}
