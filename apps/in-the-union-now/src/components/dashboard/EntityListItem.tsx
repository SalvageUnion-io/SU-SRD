/**
 * EntityListItem — single row in a dashboard section.
 *
 * Displays name, an "Open" link, and a "Delete" button that delegates to the
 * parent's `onDeleteClick` handler (which should open DeleteConfirmDialog).
 *
 * Uses a plain <a> rather than TanStack Router's <Link> so the component
 * is renderable in tests without a RouterProvider context.
 */

type EntityListItemProps = {
  id: string
  name: string
  /** Route path to navigate to when "Open" is clicked, e.g. "/pilots/abc-123" */
  href: string
  onDeleteClick: (id: string, name: string) => void
}

export function EntityListItem({ id, name, href, onDeleteClick }: EntityListItemProps) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border px-4 py-2">
      <span className="truncate font-medium">{name}</span>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={href}
          className="rounded px-3 py-1 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open
        </a>
        <button
          type="button"
          aria-label={`Delete ${name}`}
          onClick={() => onDeleteClick(id, name)}
          className="rounded px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Delete
        </button>
      </div>
    </li>
  )
}
