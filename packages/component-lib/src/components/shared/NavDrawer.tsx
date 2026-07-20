import { useState } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { buttonVariants } from '../chrome/buttonVariants'
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
  /** Start opened — for stories/tests; the apps leave it closed. */
  defaultOpen?: boolean
}

// Full-width catalog tile (former `.catalog-item`, compact drawer variant).
const TILE =
  // `background` shorthand, not `bg-[…]`/`background-color` — `--catalog-bg` may
  // be a gradient (see CatalogTile), which background-color silently drops.
  'block w-full rounded-card border-chrome border-ink [background:var(--catalog-bg)] px-[15px] py-[13px] text-center text-sm text-paper no-underline transition-[box-shadow,transform] duration-[120ms] hover:-translate-y-0.5 hover:shadow-[0_5px_18px_rgba(34,30,23,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pilot'

const TILE_LABEL = 'inline-block rounded-badge bg-[var(--catalog-label)] px-[10px] py-0.5'

export function NavDrawer({
  brand,
  navItems,
  categories,
  search,
  LinkComponent = 'a',
  triggerClassName,
  panelClassName = 'w-full',
  defaultOpen = false,
}: NavDrawerProps) {
  const [open, setOpen] = useState(defaultOpen)
  const close = () => setOpen(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className={cn(
              'rounded-md p-2 text-paper transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pilot',
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
                  className="flex items-center justify-center rounded-md p-1 text-ink/60 transition-colors hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pilot"
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
                  <span className="bg-ink px-1 font-cond font-bold uppercase leading-none tracking-caps-tight text-paper">
                    {cat.label}
                  </span>
                </div>
                {cat.schemas.map((schema) => (
                  <a
                    key={schema.id}
                    href={schema.href || `/schema/${schema.id}/`}
                    className={TILE}
                    style={
                      {
                        '--catalog-bg': schema.catalogBg,
                        ...(schema.catalogLabel ? { '--catalog-label': schema.catalogLabel } : {}),
                      } as CSSProperties
                    }
                    onClick={close}
                  >
                    {schema.catalogLabel ? (
                      <span className={TILE_LABEL}>{schema.displayName}</span>
                    ) : (
                      schema.displayName
                    )}
                  </a>
                ))}
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
