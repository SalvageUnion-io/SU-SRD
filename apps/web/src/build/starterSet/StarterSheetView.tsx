/**
 * StarterSheetView — one Starter Set build's sheet: the real `<Sheet>`, read
 * only, over the templates themselves. Its band offers "Make a copy" in its
 * top-right corner, and says nothing else: the page is plainly the
 * Starter Set's, and a sheet with no edit controls is plainly read-only.
 *
 * The store is `makeReadOnlySheetStore` over the whole Starter Set, so the
 * sheet resolves the build's mech, pilot and crawler from the same crew and its
 * rail links stay inside `/starter`. Every write that store is asked for throws,
 * and `readOnly` withdraws every edit affordance before one could be asked for:
 * nothing anyone does here changes a template. Reading, rolling and browsing
 * the sheet need no account; "Make a copy" (signed in) is the way to play one.
 */

import { isSheetKind } from 'game-domain/entityKinds'
import type { EntityRef } from 'game-domain/schemas/entity'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
} from 'game-domain/starterSet/starterSet'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { useConfirm } from '../../components/shared/useConfirm'
import { starterTemplate } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { makeReadOnlySheetStore } from '../sheet/readOnlySheetStore.model'
import { Sheet } from '../sheet/Sheet'
import { MakeACopy } from './MakeACopy'

/** One store for every Starter Set sheet: the templates never change. */
const STARTER_STORE = makeReadOnlySheetStore({
  pilots: [...STARTER_PILOTS],
  mechs: [...STARTER_MECHS],
  crawlers: [...STARTER_CRAWLERS],
  npcs: [],
  softLinks: [...STARTER_SOFT_LINKS],
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
