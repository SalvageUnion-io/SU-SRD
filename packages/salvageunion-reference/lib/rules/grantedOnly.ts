/**
 * Granted-only gear: what a grant gives and nothing else does.
 *
 * "You acquire and train in the use of a Camo Suit that only you can use"
 * (Core Book p.51): a class ability's gear comes from the ability, never off a
 * shelf. So it is listed by its grantor, carried because the grantor is
 * (`grantedEquipment` in the app), and offered nowhere an item is added on its
 * own: not the equipment index, not Add equipment, not starting gear, not a
 * catalog pick (hard rule R63). Its own Page stays, reached from its grantor,
 * search and links.
 *
 * Derived from the data's `grants` (every one an ability's today), never a
 * stored flag: an entity is granted-only when some grant names it.
 */
import { SalvageUnionReference } from '../index'

/** `schema:name` of every entity a grant names; built once abilities load. */
let grantedKeys: ReadonlySet<string> | undefined

function keys(): ReadonlySet<string> {
  if (grantedKeys) return grantedKeys
  // Before abilities load nothing can be known granted: answer empty, and
  // keep no cache, so the first call after the load builds the real set.
  if (!SalvageUnionReference.isLoaded('abilities')) return new Set()
  const out = new Set<string>()
  for (const ability of SalvageUnionReference.Abilities.all()) {
    for (const grant of ability.grants ?? []) {
      if (grant.schema !== 'choice') out.add(`${grant.schema}:${grant.name}`)
    }
  }
  grantedKeys = out
  return out
}

/** Whether a grant (a class ability's) is the only way to come by this entity. */
export function isGrantedOnly(schema: string, entity: { name: string }): boolean {
  return keys().has(`${schema}:${entity.name}`)
}
