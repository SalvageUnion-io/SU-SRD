import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

function loadJson(filePath: string): unknown {
  const fullPath = join(projectRoot, filePath)
  const content = readFileSync(fullPath, 'utf-8')
  return JSON.parse(content)
}

type Choice = {
  id: string
  name: string
}

type Action = {
  id: string
  name: string
  choices?: Choice[]
}

type PatternItem = {
  name: string
  preselectedChoices?: { [id: string]: string }
}

type Pattern = {
  name: string
  systems: PatternItem[]
  modules: PatternItem[]
}

type Chassis = {
  name: string
  patterns: Pattern[]
}

describe('Preselected Choices Validation', () => {
  it('should ensure all choices have an ID', () => {
    const actionsData = loadJson('data/actions.json') as Action[]
    const errors: string[] = []

    for (const action of actionsData) {
      for (const choice of action.choices ?? []) {
        if (!choice.id) {
          errors.push(`Action "${action.name}" has a choice "${choice.name}" without an ID`)
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Found ${errors.length} choice(s) without IDs:\n${errors.join('\n')}`)
    }

    expect(errors.length).toBe(0)
  })

  it('should ensure all preselectedChoices reference valid choice IDs', () => {
    const chassisData = loadJson('data/chassis.json') as Chassis[]
    const actionsData = loadJson('data/actions.json') as Action[]

    // Every choice id an action declares
    const validChoiceIds = new Set<string>()

    for (const action of actionsData) {
      if (action.choices) {
        for (const choice of action.choices) {
          if (choice.id) {
            validChoiceIds.add(choice.id)
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
