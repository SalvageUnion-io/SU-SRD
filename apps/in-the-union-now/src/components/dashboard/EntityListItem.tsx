/**
 * EntityListItem — single SavedRow in a dashboard entity column (design-spec
 * §3.1 / §2.10 `.row`): name + muted meta caption (cross-links encoded as
 * '↳ Name' sheet links) + trailing View / Sheet / Delete actions.
 *
 * Links render through AppLink (TanStack <Link> with a plain-anchor fallback)
 * so the component works in tests without a RouterProvider.
 */

import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Btn, btnVariants, Row } from 'suref-react'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

type EntityType = 'pilot' | 'mech' | 'crawler'

type EntityListItemProps = {
  id: string
  name: string
  href: string
  sheetHref: string
  onDeleteClick: (id: string, name: string) => void
  /**
   * Optional entity type used purely for the pill badge colour.
   * pilot → su-orange, mech → su-green, crawler → su-pink.
   * Omit (the dashboard default — the column already encodes the type) to
   * render the row without a pill.
   */
  entityType?: EntityType
  /**
   * Optional secondary line under the name (design row__meta), e.g.
   * `"Wrench" · Engineer · ↳ Iron Fist` for a pilot — '↳ Name' segments are
   * links to the target entity's sheet, so this accepts nodes, not just text.
   */
  meta?: ReactNode
}

/** Pill badge colours matching the design: pilot=orange, mech=green, crawler=pink */
const PILL_STYLES: Record<EntityType, string> = {
  pilot: 'bg-[var(--color-su-orange)] text-ink border-ink',
  mech: 'bg-[var(--color-su-green)] text-ink border-ink',
  crawler: 'bg-[var(--color-su-pink)] text-su-white border-ink',
}

const PILL_LABELS: Record<EntityType, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

export function EntityListItem({
  id,
  name,
  href,
  sheetHref,
  onDeleteClick,
  entityType,
  meta,
}: EntityListItemProps) {
  return (
    <li className="list-none">
      <Row
        name={
          entityType ? (
            <span className="flex items-center gap-2">
              <span className="truncate">{name}</span>
              <span
                className={cn(
                  'font-cond shrink-0 rounded-[2px] border-2 px-2 py-0.5 text-badge font-semibold uppercase leading-tight tracking-wider',
                  PILL_STYLES[entityType]
                )}
              >
                {PILL_LABELS[entityType]}
              </span>
            </span>
          ) : (
            name
          )
        }
        meta={meta}
        actions={
          <>
            <AppLink
              href={href}
              className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
            >
              View
            </AppLink>
            <AppLink
              href={sheetHref}
              className={cn(btnVariants({ variant: 'default', size: 'sm' }), 'no-underline')}
            >
              Sheet
            </AppLink>
            <Btn
              variant="ghost"
              size="sm"
              aria-label={`Delete ${name}`}
              onClick={() => onDeleteClick(id, name)}
              className="px-2 text-danger hover:text-danger"
            >
              <Trash2 aria-hidden="true" />
            </Btn>
          </>
        }
      />
    </li>
  )
}
