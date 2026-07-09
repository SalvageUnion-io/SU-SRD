import { useState, useCallback } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { SearchIsland } from './SearchIsland'
import { Button } from '../Button'

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

type MobileNavIslandProps = {
  categories: SchemaCategory[]
  currentPath: string
}

export function MobileNavIsland({ categories, currentPath }: MobileNavIslandProps) {
  const [open, setOpen] = useState(false)

  const isActive = useCallback((path: string) => currentPath.startsWith(path), [currentPath])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button className="rounded-md p-2 text-su-white" aria-label="Open menu">
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-su-white p-4 shadow-lg data-[open]:animate-slide-in-right data-[closed]:animate-slide-out-right">
          <Dialog.Title className="sr-only">Navigation Menu</Dialog.Title>

          {/* Header row: Logo | Close */}
          <div className="mb-2 flex items-center justify-between">
            <a href="/" onClick={() => setOpen(false)}>
              <span className="inline-flex shrink-0 cursor-pointer border border-su-black font-mono text-xl font-bold uppercase leading-none tracking-tight">
                <span className="bg-su-black px-1 py-0.5 text-su-white">Salvage Union</span>
                <span className="bg-su-white px-1 py-0.5 text-su-black">SRD</span>
              </span>
            </a>
            <Dialog.Close
              render={
                <button className="rounded-md p-1" aria-label="Close menu">
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              }
            />
          </div>

          {/* Search */}
          <div className="mb-3 [&_input]:w-full [&_input]:focus:w-full">
            <SearchIsland />
          </div>

          {/* Nav links */}
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {/* Schema list */}
            {categories.map((cat) => (
              <div key={cat.label} className="mb-2 flex flex-col gap-2">
                <div className="catalog-header">
                  <span
                    className="bg-su-black px-1 font-mono font-bold uppercase tracking-tight text-su-white"
                    style={{ lineHeight: 1 }}
                  >
                    {cat.label}
                  </span>
                </div>
                {cat.schemas.map((schema) => (
                  <a
                    key={schema.id}
                    href={schema.href || `/schema/${schema.id}/`}
                    className="btn catalog-item block text-center text-sm"
                    style={
                      {
                        '--catalog-bg': schema.catalogBg,
                        ...(schema.catalogLabel ? { '--catalog-label': schema.catalogLabel } : {}),
                      } as React.CSSProperties
                    }
                    onClick={() => setOpen(false)}
                  >
                    {schema.catalogLabel ? (
                      <span className="catalog-item-label">{schema.displayName}</span>
                    ) : (
                      schema.displayName
                    )}
                  </a>
                ))}
              </div>
            ))}

            {/* Bottom links */}
            <div className="mt-auto flex flex-col gap-2 border-t border-su-grey-light pt-4">
              <Button
                href="/about/"
                active={isActive('/about')}
                className="block text-sm"
                onClick={() => setOpen(false)}
              >
                ABOUT
              </Button>
              <Button
                href="/changelog/"
                active={isActive('/changelog')}
                className="block text-sm"
                onClick={() => setOpen(false)}
              >
                CHANGELOG
              </Button>
              <Button
                href="/discord/"
                active={isActive('/discord')}
                className="block text-sm"
                onClick={() => setOpen(false)}
              >
                DISCORD
              </Button>
              <a
                href="https://in-the-union-now.netlify.app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-inactive block text-center text-sm"
                onClick={() => setOpen(false)}
              >
                BUILDER ↗
              </a>
              <a
                href="https://leyline.press/collections/salvage-union"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-inactive block text-center text-sm"
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
