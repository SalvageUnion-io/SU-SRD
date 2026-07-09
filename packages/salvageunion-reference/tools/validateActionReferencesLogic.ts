/**
 * Pure logic for action-reference validation in the Salvage Union data.
 * Checks that all action names referenced in data files exist in
 * actions.json (both `actions[]` and `chassisAbilities[]` fields).
 *
 * Extracted from tools/validateActionReferences.ts so both the standalone
 * CLI and the unified runner (tools/validate.ts) share one implementation
 * over a caller-supplied data bag, instead of each re-reading `data/*.json`
 * itself.
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
export const ACTION_REFERENCING_FILES = [
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

      if (entity.actions && Array.isArray(entity.actions)) {
        for (const actionRef of entity.actions) {
          if (typeof actionRef === 'string') {
            const actionName = actionRef
            if (!actionNames.has(actionName)) {
              const suggestion = findSimilarAction(actionName, actionNamesLower)
              errors.push({
                file: filename,
                entityName,
                field: 'actions',
                referencedName: actionName,
                message: `Action "${actionName}" not found in actions.json`,
                suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
              })
            }
          }
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
