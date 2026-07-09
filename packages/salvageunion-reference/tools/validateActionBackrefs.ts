#!/usr/bin/env tsx
/**
 * Validates the namesake action back-reference convention (see
 * validateActionBackrefsLogic.ts): when an action's name matches an entity in
 * its `actionSource` file, that entity must reference the action in `actions[]`.
 *
 * Enforces what the "Bionic Arms" fix restored — an ability/system/module/etc.
 * that grants a same-named action must list it, so the action's mechanics
 * resolve from the entity. Currently 361/361 namesake matches pass; this guards
 * against the next miss.
 *
 * Thin CLI wrapper: all detection + orchestration logic lives in
 * validateActionBackrefsLogic.ts so this and the unified runner
 * (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { runActionBackrefCheck } from './validateActionBackrefsLogic.js'

function main(): void {
  const violations = runActionBackrefCheck(loadAllDataFiles())

  console.log('\n' + '='.repeat(80))
  if (violations.length === 0) {
    console.log('✅ Every namesake action is referenced by its source entity.')
    process.exit(0)
  } else {
    console.log(
      `❌ Found ${violations.length} namesake action(s) not referenced by their source entity:\n`
    )
    for (const v of violations) {
      console.log(`  [${v.source}] "${v.actionName}"${v.actionType ? ` (${v.actionType})` : ''}`)
      console.log(
        `    An entity named "${v.actionName}" exists in ${v.source}.json but its actions[] does not list it.`
      )
      console.log(
        `    Add "${v.actionName}" to that entity's actions[] (or rename the action if the name match is coincidental).`
      )
      console.log()
    }
    console.log(`Total: ${violations.length} unreferenced namesake action(s)`)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
