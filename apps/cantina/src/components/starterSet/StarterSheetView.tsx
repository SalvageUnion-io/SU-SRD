/**
 * StarterSheetView — one Starter Set build's sheet: the real `<Sheet>`, read
 * only, over the templates themselves. Its band offers "Make a copy" (board
 * 10) in its top-right corner, and says nothing else: the page is plainly the
 * Starter Set's, and a sheet with no edit controls is plainly read-only.
 *
 * The store is `makeReadOnlySheetStore` over the whole Starter Set, so the
 * sheet resolves the build's mech, pilot and crawler from the same crew and its
 * rail links stay inside `/starter`. Every write that store is asked for throws,
 * and `readOnly` withdraws every edit affordance before one could be asked for:
 * nothing anyone does here changes a template. Reading, rolling and browsing
 * the sheet need no account; "Make a copy" (signed in) is the way to play one.
 */

import type { EntityRef } from 'cantina-domain/schemas/entity'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
} from 'cantina-domain/starterSet/starterSet'
import { isStarterKind, starterTemplate } from '../../lib/starterSet/starterTemplates'
import { NotFoundPanel } from '../shared/RouteFallbacks'
import { useConfirm } from '../shared/useConfirm'
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
  const template = isStarterKind(kind) ? starterTemplate(kind, id) : null

  if (!isStarterKind(kind) || template === null) {
    return (
      <NotFoundPanel
        title={<>That isn&rsquo;t in the Starter Set</>}
        message="No Starter Set build lives at this address."
        back={{ href: '/starter', label: 'Starter Set' }}
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
        back={{ href: '/starter', label: 'Starter Set' }}
        readOnly
        bandActions={
          <MakeACopy kind={kind} templateId={id} name={template.name} confirm={confirm} />
        }
      />
      {dialog}
    </>
  )
}
