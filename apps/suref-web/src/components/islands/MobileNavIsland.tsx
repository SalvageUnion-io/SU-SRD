import { useState, useCallback } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { SearchIsland } from './SearchIsland'
import { Button } from '../Button'

type SchemaLink = {
  id: string
  displayName: string
  catalogBg: string
}

type MobileNavIslandProps = {
  schemas: SchemaLink[]
  currentPath: string
}

export function MobileNavIsland({ schemas, currentPath }: MobileNavIslandProps) {
  const [open, setOpen] = useState(false)

  const isActive = useCallback((path: string) => currentPath.startsWith(path), [currentPath])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button aria-label="Open menu">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-su-white p-6 shadow-lg">
          <DialogPrimitive.Title className="sr-only">Navigation Menu</DialogPrimitive.Title>

          {/* Close button */}
          <DialogPrimitive.Close asChild>
            <Button className="absolute right-4 top-4" aria-label="Close menu">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </DialogPrimitive.Close>

          {/* Logo */}
          <a
            href="/"
            className="mb-4 flex items-center justify-center p-2"
            onClick={() => setOpen(false)}
          >
            <span className="inline-flex shrink-0 cursor-pointer border border-su-black font-mono text-base font-bold uppercase leading-none tracking-tight">
              <span className="bg-su-black px-1 py-0.5 text-su-white">SU</span>
              <span className="bg-su-white px-1 py-0.5 text-su-black">SRD</span>
            </span>
          </a>

          {/* Search */}
          <div className="mb-4 px-2">
            <SearchIsland />
          </div>

          {/* Nav links */}
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {/* Schema list */}
            <div className="mb-2 flex flex-col gap-2">
              <span className="block px-4 text-xs font-semibold uppercase text-su-grey-dark">
                Reference
              </span>
              {schemas.map((schema) => (
                <a
                  key={schema.id}
                  href={`/schema/${schema.id}`}
                  className="btn catalog-item block text-center text-sm"
                  style={{ '--catalog-bg': schema.catalogBg } as React.CSSProperties}
                  onClick={() => setOpen(false)}
                >
                  {schema.displayName}
                </a>
              ))}
            </div>

            {/* Bottom links */}
            <div className="mt-auto flex flex-col gap-2 border-t border-su-grey-light pt-4">
              <Button
                href="/randsum"
                active={isActive('/randsum')}
                className="block text-sm"
                onClick={() => setOpen(false)}
              >
                RANDSUM
              </Button>
              <Button
                href="/about"
                active={isActive('/about')}
                className="block text-sm"
                onClick={() => setOpen(false)}
              >
                ABOUT
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
