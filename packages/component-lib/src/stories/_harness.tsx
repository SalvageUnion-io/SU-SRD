import type { ReactNode } from 'react'

/**
 * Shared Ladle story helpers.
 *
 * Every story renders on a global paper canvas provided by `.ladle/components.tsx`
 * (bg-paper + mono), so a story no longer needs its own outer `bg-paper` wrapper.
 * When a caption/frame helper would otherwise be copy-pasted across story files,
 * put it here and import it instead of re-declaring it per file.
 */

/** A small caps caption above a demo cluster — the workshop-muted label. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 font-cond text-label uppercase tracking-caps text-wk-muted">
      {children}
    </div>
  )
}
