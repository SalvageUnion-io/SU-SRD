/**
 * Pure logic for action-reference validation in the Salvage Union data.
 * Checks that all action names referenced in data files exist in
 * actions.json (`actions[]`, a pattern's `actions[]` and `chassisAbilities[]`).
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=actions`) and the tests share one implementation.
 */

export type ActionReferenceError = {
  file: string
  entityName: string
  field: string
  referencedName: string
  message: string
  suggestion?: string
}

// Data files that may contain action references
const ACTION_REFERENCING_FILES = [
  'abilities.json',
  'systems.json',
  'modules.json',
  'equipment.json',
  'bio-titans.json',
  'crawlers.json',
  'creatures.json',
  'meld.json',
  'npcs.json',
  'squads.json',
  'chassis.json',
  'vehicles.json',
]

function findSimilarAction(
  referencedName: string,
  actionNamesLower: Map<string, string>
): string | undefined {
  const lower = referencedName.toLowerCase()

  if (actionNamesLower.has(lower)) {
    return actionNamesLower.get(lower)
  }

  for (const [lowerName, actualName] of actionNamesLower.entries()) {
    const normalize = (s: string) => s.replace(/[^a-z0-9]/g, '')
    if (normalize(lower) === normalize(lowerName)) {
      return actualName
    }
  }

  return undefined
}

/** Run the action-reference check over the supplied data bag. */
export function findActionReferenceErrors(
  filesByName: Record<string, unknown[]>
): ActionReferenceError[] {
  const errors: ActionReferenceError[] = []

  const actions = (filesByName['actions.json'] ?? []) as Record<string, unknown>[]
  const actionNames = new Set(actions.map((a) => (a.name as string) || ''))

  const actionNamesLower = new Map<string, string>()
  actions.forEach((a) => {
    const name = (a.name as string) || ''
    actionNamesLower.set(name.toLowerCase(), name)
  })

  for (const filename of ACTION_REFERENCING_FILES) {
    const data = (filesByName[filename] ?? []) as Record<string, unknown>[]

    for (const entity of data) {
      const entityName = String(entity.name ?? entity.id ?? 'unknown')

      const checkActionRefs = (refs: unknown, field: string) => {
        if (!Array.isArray(refs)) return
        for (const actionRef of refs) {
          if (typeof actionRef === 'string') {
            const actionName = actionRef
            if (!actionNames.has(actionName)) {
              const suggestion = findSimilarAction(actionName, actionNamesLower)
              errors.push({
                file: filename,
                entityName,
                field,
                referencedName: actionName,
                message: `Action "${actionName}" not found in actions.json`,
                suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
              })
            }
          }
        }
      }

      checkActionRefs(entity.actions, 'actions')

      // A Bio-Titan pattern names the actions it ADDS to its host.
      if (Array.isArray(entity.patterns)) {
        for (const pattern of entity.patterns as Record<string, unknown>[]) {
          checkActionRefs(pattern.actions, `patterns[${String(pattern.name)}].actions`)
        }
      }

      // Chassis abilities are now stored as actions in actions.json
      if (entity.chassisAbilities && Array.isArray(entity.chassisAbilities)) {
        for (const abilityRef of entity.chassisAbilities) {
          if (typeof abilityRef === 'string') {
            const abilityName = abilityRef
            if (!actionNames.has(abilityName)) {
              const suggestion = findSimilarAction(abilityName, actionNamesLower)
              errors.push({
                file: filename,
                entityName,
                field: 'chassisAbilities',
                referencedName: abilityName,
                message: `Chassis ability "${abilityName}" not found in actions.json`,
                suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
              })
            }
          }
        }
      }
    }
  }

  return errors
}
