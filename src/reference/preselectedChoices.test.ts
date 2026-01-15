import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

function loadJson(filePath: string): unknown {
  const fullPath = join(projectRoot, filePath)
  const content = readFileSync(fullPath, 'utf-8')
  return JSON.parse(content)
}

interface Choice {
  id: string
  name: string
  customSystemOptions?: Array<{ id: string; name: string }>
}

interface System {
  id: string
  name: string
  actions?: Array<{
    choices?: Choice[]
  }>
}

interface Action {
  id: string
  name: string
  choices?: Choice[]
}

interface PatternItem {
  name: string
  preselectedChoices?: { [id: string]: string }
}

interface Pattern {
  name: string
  systems: PatternItem[]
  modules: PatternItem[]
}

interface Chassis {
  name: string
  patterns: Pattern[]
}

describe('Preselected Choices Validation', () => {
  it('should ensure all choices have an ID', () => {
    const systemsData = loadJson('data/systems.json') as System[]
    const errors: string[] = []

    for (const system of systemsData) {
      if (system.actions?.[0]?.choices) {
        for (const choice of system.actions[0].choices) {
          if (!choice.id) {
            errors.push(`System "${system.name}" has a choice "${choice.name}" without an ID`)
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Found ${errors.length} choice(s) without IDs:\n${errors.join('\n')}`)
    }

    expect(errors.length).toBe(0)
  })

  it('should ensure all preselectedChoices reference valid choice IDs', () => {
    const systemsData = loadJson('data/systems.json') as System[]
    const chassisData = loadJson('data/chassis.json') as Chassis[]
    const actionsData = loadJson('data/actions.json') as Action[]

    // Build a set of all valid choice IDs
    // This includes both the choice IDs themselves and any customSystemOption IDs
    // From both systems (for legacy support) and actions (new meta schema)
    const validChoiceIds = new Set<string>()
    const choiceIdToSystemName = new Map<string, string>()

    // Check systems for choices (legacy support)
    for (const system of systemsData) {
      if (system.actions?.[0]?.choices) {
        for (const choice of system.actions[0].choices) {
          if (choice.id) {
            validChoiceIds.add(choice.id)
            choiceIdToSystemName.set(choice.id, system.name)
          }

          // Also add customSystemOption IDs if they exist
          if (choice.customSystemOptions) {
            for (const option of choice.customSystemOptions) {
              if (option.id) {
                validChoiceIds.add(option.id)
                choiceIdToSystemName.set(option.id, system.name)
              }
            }
          }
        }
      }
    }

    // Check actions for choices (new meta schema)
    for (const action of actionsData) {
      if (action.choices) {
        for (const choice of action.choices) {
          if (choice.id) {
            validChoiceIds.add(choice.id)
            choiceIdToSystemName.set(choice.id, action.name)
          }

          // Also add customSystemOption IDs if they exist
          if (choice.customSystemOptions) {
            for (const option of choice.customSystemOptions) {
              if (option.id) {
                validChoiceIds.add(option.id)
                choiceIdToSystemName.set(option.id, action.name)
              }
            }
          }
        }
      }
    }

    const errors: string[] = []

    // Check all preselectedChoices in chassis patterns
    for (const chassis of chassisData) {
      for (const pattern of chassis.patterns) {
        // Check systems
        for (const system of pattern.systems) {
          if (system.preselectedChoices) {
            for (const [choiceId, choiceName] of Object.entries(system.preselectedChoices)) {
              if (!validChoiceIds.has(choiceId)) {
                errors.push(
                  `Chassis "${chassis.name}", pattern "${pattern.name}", system "${system.name}" has preselectedChoice with invalid ID "${choiceId}" (value: "${choiceName}")`
                )
              }
            }
          }
        }

        // Check modules
        for (const module of pattern.modules) {
          if (module.preselectedChoices) {
            for (const [choiceId, choiceName] of Object.entries(module.preselectedChoices)) {
              if (!validChoiceIds.has(choiceId)) {
                errors.push(
                  `Chassis "${chassis.name}", pattern "${pattern.name}", module "${module.name}" has preselectedChoice with invalid ID "${choiceId}" (value: "${choiceName}")`
                )
              }
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Found ${errors.length} preselectedChoice(s) with invalid IDs:\n${errors.join('\n')}`
      )
    }

    expect(errors.length).toBe(0)
  })
})
