/**
 * The Training Bay's two "Make a copy" acts, a unit's and a saved pattern's:
 * each runs at once and its notice opens the copy (`makeACopy`, chrome K8).
 */

import type { EntityKind } from 'game-domain/entityKinds'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { makeACopy } from '../../lib/copiedToast'
import { copyForShelf, copyName } from '../../lib/copyEntity'
import { patternCopy, savedPatternHref } from '../../lib/patterns/patterns'
import { usePatterns } from '../../replica/collections'
import { useUnits } from '../../replica/units'

type Go = (href: string) => void

/** Copy one of your units onto the Training Bay, named "Copy of …". */
export function copyUnit(
  type: EntityKind,
  name: string,
  body: Parameters<typeof copyForShelf>[0],
  go: Go
): Promise<void> {
  return makeACopy({
    name,
    make: async () => {
      const created = await useUnits.getState().create(type, copyForShelf(body, name) as never)
      return { name: created.name, href: `/${type}s/${created.id}` }
    },
    go,
  })
}

/** Copy a saved pattern beside the original. */
export function copyPattern(pattern: MechPattern, go: Go): Promise<void> {
  return makeACopy({
    name: pattern.name,
    make: async () => {
      const created = await usePatterns
        .getState()
        .create({ ...patternCopy(pattern), name: copyName(pattern.name) })
      return { name: created.name, href: savedPatternHref(created.id) }
    },
    go,
  })
}
