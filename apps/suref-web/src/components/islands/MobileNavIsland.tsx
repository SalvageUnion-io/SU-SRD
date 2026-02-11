import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from 'suref-react'

type SchemaLink = {
  id: string
  displayName: string
}

type MobileNavIslandProps = {
  schemas: SchemaLink[]
  currentPath: string
}

export function MobileNavIsland({ schemas, currentPath }: MobileNavIslandProps) {
  const [open, setOpen] = useState(false)

  const isActive = useCallback((path: string) => currentPath.startsWith(path), [currentPath])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-su-orange p-2 text-su-white"
        aria-label="Open menu"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogContent className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-su-white p-6 shadow-lg">
          <DialogTitle className="sr-only">Navigation Menu</DialogTitle>

          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-md p-2 hover:bg-su-blue-pale"
            aria-label="Close menu"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Logo */}
          <a
            href="/"
            className="mb-6 flex items-center justify-center gap-1 rounded-md p-2 hover:bg-su-blue-pale"
            onClick={() => setOpen(false)}
          >
            <span className="text-xl font-semibold text-su-black">Salvage Union</span>
            <span className="text-xs font-medium text-su-orange-dark">SRD</span>
          </a>

          {/* Nav links */}
          <div className="flex flex-1 flex-col gap-1">
            {/* Schema list */}
            <div className="mb-2">
              <span className="mb-1 block px-4 text-xs font-semibold uppercase text-su-grey-dark">
                Reference
              </span>
              {schemas.map((schema) => (
                <a
                  key={schema.id}
                  href={`/schema/${schema.id}`}
                  className={`block rounded-md px-4 py-2 text-sm transition-colors ${
                    isActive(`/schema/${schema.id}`)
                      ? 'border-b-2 border-su-orange font-semibold'
                      : 'hover:bg-su-blue-pale'
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {schema.displayName}
                </a>
              ))}
            </div>

            <a
              href="/randsum"
              className={`rounded-md px-4 py-2 text-center font-medium transition-colors ${
                isActive('/randsum')
                  ? 'border-b-2 border-su-orange font-semibold'
                  : 'hover:bg-su-blue-pale'
              }`}
              onClick={() => setOpen(false)}
            >
              Discord Bot
            </a>

            {/* Bottom links */}
            <div className="mt-auto border-t border-su-grey-light pt-4">
              <a
                href="/about"
                className={`block rounded-md px-4 py-2 text-center font-medium transition-colors ${
                  isActive('/about')
                    ? 'border-b-2 border-su-orange font-semibold'
                    : 'hover:bg-su-blue-pale'
                }`}
                onClick={() => setOpen(false)}
              >
                About
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
