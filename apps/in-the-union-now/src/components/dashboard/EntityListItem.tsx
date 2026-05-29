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
type EntityListItemProps = {
  id: string
  name: string
  href: string
  sheetHref: string
  onDeleteClick: (id: string, name: string) => void
}

export function EntityListItem({ id, name, href, sheetHref, onDeleteClick }: EntityListItemProps) {
  const linkClass = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-su-grey-light)] bg-[var(--color-su-white)] px-4 py-2">
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
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
