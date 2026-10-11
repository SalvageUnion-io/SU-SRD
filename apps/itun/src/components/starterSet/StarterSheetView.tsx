/**
 * StarterSheetView — one Starter Set build's sheet: the real `<Sheet>`, read
 * only, over the templates themselves. Its band says where it comes from
 * ("Starter Set · Leyline Press · read-only") and offers "Make a copy" (board
 * 10, issue 1255).
 *
 * The store is `makeReadOnlySheetStore` over the whole Starter Set, so the
 * sheet resolves the build's mech, pilot and crawler from the same crew and its
 * rail links stay inside `/starter`. Every write that store is asked for throws,
 * and `readOnly` withdraws every edit affordance before one could be asked for:
 * nothing anyone does here changes a template. Reading, rolling and browsing
 * the sheet need no account; "Make a copy" (signed in) is the way to play one.
 */

import { buttonVariants, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { EntityRef } from '../../lib/schemas/entity'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_PUBLISHER, starterTemplate } from '../../lib/starterSet/copyStarter'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
} from '../../lib/starterSet/starterSet'
import { AppLink } from '../shared/AppLink'
import { useConfirm } from '../shared/useConfirm'
import { makeReadOnlySheetStore } from '../sheet/readOnlySheetStore'
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

const NOT_FOUND = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: tokens.space[12],
  padding: tokens.space[24],
} satisfies CSSProperties

const LINK = { textDecoration: 'none' } satisfies CSSProperties

function isStarterKind(value: string): value is StarterKind {
  return value === 'pilot' || value === 'mech' || value === 'crawler'
}

export function StarterSheetView({ kind, id }: { kind: string; id: string }) {
  const { confirm, dialog } = useConfirm()
  const template = isStarterKind(kind) ? starterTemplate(kind, id) : null

  if (!isStarterKind(kind) || template === null) {
    return (
      <main style={NOT_FOUND}>
        <h1>That isn&rsquo;t in the Starter Set</h1>
        <AppLink
          href="/starter"
          className={buttonVariants({ variant: 'ghost', size: 'compact' })}
          style={LINK}
        >
          &larr; Starter Set
        </AppLink>
      </main>
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
        provenance={`Starter Set · ${STARTER_SET_PUBLISHER} · read-only`}
        bandActions={
          <MakeACopy kind={kind} templateId={id} name={template.name} confirm={confirm} />
        }
      />
      {dialog}
    </>
  )
}
