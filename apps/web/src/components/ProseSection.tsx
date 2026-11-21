import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'
import type { ProseSectionScope } from '../lib/proseSection'
import { ProseSectionContext } from '../lib/proseSection'

/** One section of prose: a term in it links at its first mention alone (`proseSection`). */
export function ProseSection({ children }: { children: ReactNode }) {
  const claims = useRef<Map<string, string> | null>(null)
  const scope = useMemo<ProseSectionScope>(
    () => ({
      claim(term, by) {
        claims.current ??= new Map()
        const held = claims.current.get(term)
        if (held === undefined) claims.current.set(term, by)
        return held === undefined || held === by
      },
    }),
    []
  )
  return <ProseSectionContext.Provider value={scope}>{children}</ProseSectionContext.Provider>
}
