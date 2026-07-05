/**
 * Pure logic for the "namesake action back-reference" convention.
 *
 * In the dataset an entity's own granted effect is frequently modeled as an
 * action of the SAME NAME, sourced from that entity's type (`actionSource`).
 * When an action's name exactly matches an entity in its `actionSource` file,
 * that entity is expected to list the action in its `actions[]` — otherwise the
 * action's mechanical detail never resolves from the entity that grants it.
 *
 * This is the generalized form of the bug that left the "Bionic Arms" ability
 * without its own `Passive` action (the +2 Max HP / downtime heal): 16 of 17
 * `Passive`/abilities actions were referenced by their namesake ability, and
 * that one was the lone miss. The convention holds 100% across the current data
 * (systems, modules, equipment, abilities — 361/361 namesake matches). This
 * check keeps it that way: a future unreferenced namesake action fails the build
 * the same way an orphan would, but points at the specific entity to fix.
 *
 * Scope note: the check only fires when an action's name EXACTLY matches an
 * entity in the same source file. Actions granted under a different name (e.g.
 * the "Bionic Arms Attack" turn action granted by the "Bionic Arms" ability) are
 * out of scope here — those are covered by the orphan validator instead.
 */

export type BackrefViolation = {
  source: string
  actionName: string
  actionType?: string
}

export type ActionLike = {
  name?: string
  displayName?: string
  actionType?: string
  actionSource?: string
}

export type EntityLike = {
  name?: string
  actions?: unknown
}

/** entityName -> set of action names it references in `actions[]`. */
function indexReferencesByEntity(entities: EntityLike[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const entity of entities) {
    if (typeof entity.name !== 'string') continue
    const refs = new Set<string>()
    if (Array.isArray(entity.actions)) {
      for (const ref of entity.actions) if (typeof ref === 'string') refs.add(ref)
    }
    map.set(entity.name, refs)
  }
  return map
}

/**
 * For each action whose name matches an entity in its `actionSource` file,
 * verify that entity references the action (by `name`, or by `displayName` for
 * disambiguated variants). Returns one violation per unreferenced namesake
 * (source, name) pair.
 */
export function findMissingActionBackrefs(
  actions: ActionLike[],
  entitiesBySource: Record<string, EntityLike[]>
): BackrefViolation[] {
  const referencesBySource: Record<string, Map<string, Set<string>>> = {}
  for (const [source, entities] of Object.entries(entitiesBySource)) {
    referencesBySource[source] = indexReferencesByEntity(entities)
  }

  const violations: BackrefViolation[] = []
  const seen = new Set<string>()
  for (const action of actions) {
    const source = action.actionSource
    const name = action.name
    if (typeof source !== 'string' || typeof name !== 'string') continue

    const references = referencesBySource[source]
    if (!references) continue

    const entityRefs = references.get(name)
    if (!entityRefs) continue // no namesake entity in this source -> convention does not apply

    const referenced =
      entityRefs.has(name) ||
      (typeof action.displayName === 'string' && entityRefs.has(action.displayName))
    if (referenced) continue

    const key = `${source}::${name}`
    if (seen.has(key)) continue
    seen.add(key)
    violations.push({ source, actionName: name, actionType: action.actionType })
  }
  return violations
}
