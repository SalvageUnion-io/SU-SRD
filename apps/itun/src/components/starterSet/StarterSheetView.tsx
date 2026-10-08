/**
 * StarterSheetView — one Starter Set build's sheet: the real `<Sheet>`, read
 * only, over the templates themselves.
 *
 * The store is `makeReadOnlySheetStore` over the whole Starter Set, so the
 * sheet resolves the build's mech, pilot and crawler from the same crew and its
 * rail links stay inside `/starter`. Every write that store is asked for throws,
 * and `readOnly` withdraws every edit affordance before one could be asked for:
 * nothing anyone does here changes a template. Reading, rolling and browsing
 * the sheet need no account; "Copy to…" (signed in) is the way to play one.
 */

import { buttonVariants, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { EntityRef } from '../../lib/schemas/entity'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import {
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
  starterTemplate,
} from '../../lib/starterSet/copyStarter'
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
import { CopyStarterSelect } from './CopyStarterSelect'

/** One store for every Starter Set sheet: the templates never change. */
const STARTER_STORE = makeReadOnlySheetStore({
  pilots: [...STARTER_PILOTS],
  mechs: [...STARTER_MECHS],
  crawlers: [...STARTER_CRAWLERS],
  softLinks: [...STARTER_SOFT_LINKS],
})

const starterHref = (kind: EntityRef['type'], id: string) => `/starter/${kind}/${id}`

const BANNER = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space[12],
  borderBottom: '2px solid var(--color-ink)',
  background: 'var(--color-caution)',
  padding: `${tokens.space[8]} ${tokens.space[16]}`,
  fontSize: tokens.fontSize.sm,
  fontWeight: 600,
  color: 'var(--color-ink)',
} satisfies CSSProperties

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
    <div>
      <div role="note" aria-label="Starter Set reference" style={BANNER}>
        <span>
          Starter Set · {STARTER_SET_ADVENTURE} · owned by {STARTER_SET_PUBLISHER}. Read-only
          reference.
        </span>
        <CopyStarterSelect kind={kind} templateId={id} name={template.name} confirm={confirm} />
      </div>

      <Sheet
        kind={kind}
        id={id}
        store={STARTER_STORE}
        hrefFor={starterHref}
        back={{ href: '/starter', label: 'Starter Set' }}
        readOnly
      />
      {dialog}
    </div>
  )
}
