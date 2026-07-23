import { useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import type { CSSVarStyle } from '../../styles/cssVars'
import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { buttonVariants } from '../chrome/buttonVariants'
import { Badge } from '../chrome/Badge'
import { CATALOG_TILE_CHROME, CATALOG_TILE_FILL, CATALOG_TILE_LABEL } from '../chrome/catalogTile'
import { FOCUS_RING } from '../chrome/interaction'
import { cn } from '../../utils/cn'

/**
 * NavDrawer — the shared hamburger + slide-in mobile nav drawer (unifies the
 * SRD site drawer and the ITUN builder drawer). One base-ui `Dialog`: a
 * hamburger trigger, a dimmed backdrop, and a right-side slide-in panel
 * (`animate-slide-in-right`/`-out`, defined in the consuming app's CSS).
 *
 * Content is fully driven by props: a `brand` lockup, primary `navItems`
 * (rendered as the shared `buttonVariants` buttons — `active` = primary/rust, else
 * ghost), and optional `categories` (catalog tiles) + `search` slot for the
 * SRD's richer drawer. Router-agnostic: internal items render through the
 * injected `LinkComponent` (defaults to a plain anchor), external ones as
 * `<a target=_blank>`. Every item closes the drawer on tap.
 */

export type NavDrawerItem = {
  label: ReactNode
  href: string
  /** Renders as the primary (rust) button instead of ghost. */
  active?: boolean
  /** Opens in a new tab via a plain anchor (bypasses LinkComponent). */
  external?: boolean
  /** Optional trailing pill (e.g. an "Alpha" tag). */
  badge?: ReactNode
}

type SchemaLink = {
  id: string
  displayName: string
  catalogBg: string
  catalogLabel?: string
  href?: string
}

export type NavDrawerCategory = {
  label: string
  schemas: SchemaLink[]
}

type NavDrawerProps = {
  /** Brand lockup shown top-left of the panel (e.g. the two-tone wordmark tag). */
  brand: ReactNode
  /** Primary nav links, rendered as buttonVariants buttons. */
  navItems: NavDrawerItem[]
  /** Optional catalog categories (SRD schema tiles), rendered above navItems. */
  categories?: NavDrawerCategory[]
  /** Optional search slot (SRD combobox), rendered under the brand row. */
  search?: ReactNode
  /** Link component for internal items. Defaults to a plain anchor; ITUN passes AppLink. */
  LinkComponent?: ElementType
  /** Extra classes on the hamburger trigger (e.g. tint for a dark header). */
  triggerClassName?: string
  /** Panel width class. Defaults to full-width; ITUN uses a narrower drawer. */
  panelClassName?: string
}

// Full-width catalog tile (former `.catalog-item`, compact drawer variant).
// The frame, fill and name plate are the SHARED tile treatment; the drawer only
// adds its own layout (full-width block, centred, one step down in type). This
// file used to carry a verbatim copy of both strings, so the two tiles drifted.
const TILE = cn(CATALOG_TILE_CHROME, CATALOG_TILE_FILL, 'block w-full text-center text-sm')

const TILE_LABEL = CATALOG_TILE_LABEL

export function NavDrawer({
  brand,
  navItems,
  categories,
  search,
  LinkComponent = 'a',
  triggerClassName,
  panelClassName = 'w-full',
}: NavDrawerProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className={cn(
              cn('rounded-md p-2 text-paper transition-colors', FOCUS_RING),
              triggerClassName
            )}
          >
            <Menu size={24} aria-hidden="true" />
          </button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex max-w-[85vw] flex-col bg-paper p-4 shadow-lg data-[closed]:animate-slide-out-right data-[open]:animate-slide-in-right',
            panelClassName
          )}
        >
          <Dialog.Title className="sr-only">Navigation Menu</Dialog.Title>

          {/* Brand row: lockup | Close */}
          <div className="mb-4 flex items-center justify-between">
            {brand}
            <Dialog.Close
              render={
                <button
                  type="button"
                  aria-label="Close menu"
                  className={cn(
                    'flex items-center justify-center rounded-md p-1 text-ink/60 transition-colors hover:bg-ink/10 hover:text-ink',
                    FOCUS_RING
                  )}
                >
                  <X size={22} aria-hidden="true" />
                </button>
              }
            />
          </div>

          {search && <div className="mb-3 [&_input]:w-full [&_input]:focus:w-full">{search}</div>}

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {/* Catalog categories (SRD) */}
            {categories?.map((cat) => (
              <div key={cat.label} className="mb-2 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Badge shape="stamp">{cat.label}</Badge>
                </div>
                {cat.schemas.map((schema) => {
                  const tileStyle: CSSVarStyle = {
                    '--catalog-bg': schema.catalogBg,
                    ...(schema.catalogLabel ? { '--catalog-label': schema.catalogLabel } : {}),
                  }
                  return (
                    <a
                      key={schema.id}
                      href={schema.href || `/schema/${schema.id}/`}
                      className={TILE}
                      style={tileStyle}
                      onClick={close}
                    >
                      {schema.catalogLabel ? (
                        <span className={TILE_LABEL}>{schema.displayName}</span>
                      ) : (
                        schema.displayName
                      )}
                    </a>
                  )
                })}
              </div>
            ))}

            {/* Primary nav links */}
            <div
              className={cn(
                'flex flex-col gap-2',
                categories && categories.length > 0 && 'mt-auto border-t border-wk-faint pt-4'
              )}
            >
              {navItems.map((item) => {
                // External items render a plain anchor in a new tab; internal
                // ones route through LinkComponent. One element either way.
                const Link = item.external ? 'a' : LinkComponent
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      buttonVariants({ variant: item.active ? 'primary' : 'ghost' }),
                      'w-full'
                    )}
                    onClick={close}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {item.label}
                    {item.badge}
                  </Link>
                )
              })}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
