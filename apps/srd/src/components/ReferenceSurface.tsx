import type { AnnouncedRoll, PageRefIndex } from 'component-lib'
import { EntitySurfaceProvider, toast } from 'component-lib'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

/**
 * A roll on a card's table, raised as a toast: the die and where it landed,
 * then the outcome. A reroll on the same table replaces its toast rather than
 * stacking another. The `<Toaster />` is `ReferenceEntityIsland`'s.
 */
function toastRoll({ table, roll, range, label, text }: AnnouncedRoll) {
  toast(`${table}: rolled ${roll} (${range})`, {
    id: `roll-${table}`,
    description: label ? `${label}: ${text}` : text,
    duration: 8000,
  })
}

/**
 * The SRD's card surface: a Reference context (ruleset §1) whose roll tables
 * roll, the result raised as a toast (`toastRoll`) rather than read out in the
 * card, and whose "p. N" references link where `pageRefs`
 * (`lib/pageRefIndex.ts`) resolves them. A table's own page (`RollTablePage`)
 * keeps its readout.
 */
export function ReferenceSurface({
  pageRefs,
  children,
}: {
  pageRefs?: PageRefIndex
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ announceRoll: toastRoll, ...(pageRefs ? { pageRefs } : {}) }),
    [pageRefs]
  )
  return <EntitySurfaceProvider value={value}>{children}</EntitySurfaceProvider>
}
