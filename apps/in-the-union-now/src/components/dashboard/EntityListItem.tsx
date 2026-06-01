import { Button } from '../ui/button'
import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../../lib/utils'

/**
 * EntityListItem — single row in a dashboard entity list (pilot / mech /
 * crawler).
 *
 * Uses plain <a> elements rather than TanStack Router's <Link> so the
 * component can be rendered in tests / sheets without a router context.
 * Both link anchors render with the same SRD `.btn-inactive` style as the
 * <Button variant="outline"> so the row reads as a consistent button bar.
 */
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
   * Omit to render the row without a pill (backwards-compatible).
   */
  entityType?: EntityType
  /**
   * Optional secondary line under the name (design row__meta), e.g.
   * `"Wrench" · Engineer` for a pilot or `Atlas Hauler · TL 3` for a mech.
   */
  meta?: string
}

/** Pill badge colours matching the design: pilot=orange, mech=green, crawler=pink */
const PILL_STYLES: Record<EntityType, string> = {
  pilot: 'bg-[var(--color-su-orange)] text-[var(--color-su-black)] border-[var(--color-su-black)]',
  mech: 'bg-[var(--color-su-green)] text-[var(--color-su-black)] border-[var(--color-su-black)]',
  crawler: 'bg-[var(--color-su-pink)] text-white border-[var(--color-su-black)]',
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
  const linkClass = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-[3px] border-[1.5px] border-[var(--color-su-black)] bg-[var(--color-su-white)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{name}</div>
        {meta && <div className="truncate font-mono text-xs text-muted-foreground">{meta}</div>}
      </div>
      {entityType && (
        <span
          className={cn(
            'font-cond shrink-0 rounded-[2px] border-2 px-2 py-0.5 text-[11px] font-semibold uppercase leading-tight tracking-[.05em]',
            PILL_STYLES[entityType]
          )}
        >
          {PILL_LABELS[entityType]}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <a href={href} className={linkClass}>
          View
        </a>
        <a href={sheetHref} className={linkClass}>
          Sheet
        </a>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          aria-label={`Delete ${name}`}
          onClick={() => onDeleteClick(id, name)}
        >
          Delete
        </Button>
      </div>
    </li>
  )
}
