import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { btnVariants } from '../chrome/btnVariants'
import { cn } from '../../utils/cn'

/**
 * MobileNavDrawer — the SRD reference site's hamburger + slide-in nav drawer
 * (extracted from suref-web's MobileNavIsland, pending review). Below `lg` the
 * site collapses its catalog + secondary nav in here.
 *
 * Presentational shell: the schema categories and active-path come in as props,
 * and the search combobox is slotted via `search` (suref-web passes its
 * SearchIsland) so this shared component stays free of the search/index deps.
 * The former `.catalog-item` / `.catalog-header` global rules are replicated as
 * utilities, and the bottom links use the shared `btnVariants`, so it renders
 * identically in Ladle and the site.
 */

type SchemaLink = {
  id: string
  displayName: string
  catalogBg: string
  catalogLabel?: string
  href?: string
}

type SchemaCategory = {
  label: string
  schemas: SchemaLink[]
}

type MobileNavDrawerProps = {
  categories: SchemaCategory[]
  currentPath: string
  /** Destination for the outbound ITUN builder cross-link. */
  itunUrl: string
  /** Search combobox slotted into the drawer (suref-web passes its SearchIsland). */
  search?: ReactNode
  /** Start opened — for stories/tests; the site leaves it closed. */
  defaultOpen?: boolean
}

// Full-width catalog tile (former `.catalog-item`, compact drawer variant).
const TILE =
  'block w-full rounded-[3px] border-[1.5px] border-su-black bg-[var(--catalog-bg)] px-[15px] py-[13px] text-center text-sm text-paper no-underline transition-[box-shadow,transform] duration-[120ms] hover:-translate-y-0.5 hover:shadow-[0_5px_18px_rgba(34,30,23,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

const TILE_LABEL = 'inline-block rounded-[2px] bg-[var(--catalog-label)] px-[10px] py-0.5'

export function MobileNavDrawer({
  categories,
  currentPath,
  itunUrl,
  search,
  defaultOpen = false,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(defaultOpen)
  const isActive = (path: string) => currentPath.startsWith(path)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button type="button" className="rounded-md p-2 text-paper" aria-label="Open menu">
            <Menu size={24} aria-hidden="true" />
          </button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-paper p-4 shadow-lg data-[closed]:animate-slide-out-right data-[open]:animate-slide-in-right">
          <Dialog.Title className="sr-only">Navigation Menu</Dialog.Title>

          {/* Header row: Logo | Close */}
          <div className="mb-2 flex items-center justify-between">
            <a href="/" onClick={() => setOpen(false)}>
              <span className="inline-flex shrink-0 cursor-pointer border border-su-black font-mono text-xl font-bold uppercase leading-none tracking-tight">
                <span className="bg-su-black px-1 py-0.5 text-paper">Salvage Union</span>
                <span className="bg-paper px-1 py-0.5 text-su-black">SRD</span>
              </span>
            </a>
            <Dialog.Close
              render={
                <button type="button" className="rounded-md p-1" aria-label="Close menu">
                  <X size={24} aria-hidden="true" />
                </button>
              }
            />
          </div>

          {/* Search */}
          {search && <div className="mb-3 [&_input]:w-full [&_input]:focus:w-full">{search}</div>}

          {/* Nav links */}
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {/* Schema list */}
            {categories.map((cat) => (
              <div key={cat.label} className="mb-2 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className="bg-su-black px-1 font-mono font-bold uppercase tracking-tight text-paper"
                    style={{ lineHeight: 1 }}
                  >
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
                    onClick={() => setOpen(false)}
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

            {/* Bottom links — the shared `btnVariants` button styling as links
                (active = primary/rust, inactive = ghost). */}
            <div className="mt-auto flex flex-col gap-2 border-t border-su-grey-light pt-4">
              <a
                href="/about/"
                className={cn(
                  btnVariants({ variant: isActive('/about') ? 'primary' : 'ghost' }),
                  'w-full'
                )}
                onClick={() => setOpen(false)}
              >
                ABOUT
              </a>
              <a
                href="/changelog/"
                className={cn(
                  btnVariants({ variant: isActive('/changelog') ? 'primary' : 'ghost' }),
                  'w-full'
                )}
                onClick={() => setOpen(false)}
              >
                CHANGELOG
              </a>
              <a
                href="/discord/"
                className={cn(
                  btnVariants({ variant: isActive('/discord') ? 'primary' : 'ghost' }),
                  'w-full'
                )}
                onClick={() => setOpen(false)}
              >
                DISCORD
              </a>
              <a
                href={itunUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnVariants({ variant: 'ghost' }), 'w-full')}
                onClick={() => setOpen(false)}
              >
                BUILDER ↗
              </a>
              <a
                href="https://leyline.press/collections/salvage-union"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnVariants({ variant: 'ghost' }), 'w-full')}
                onClick={() => setOpen(false)}
              >
                BUY THE GAME
              </a>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
