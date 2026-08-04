#!/usr/bin/env tsx
/**
 * Validates trait data across the Salvage Union dataset:
 *   1. every `traits[].type` is lowercase (case-sensitive consumers such as
 *      getInventorySlots depend on it);
 *   2. every choice-effect `removeTrait` targets a trait the entity carries
 *      (otherwise it is a silent no-op — usually a misplaced base trait);
 *   3. every `traits[].type` names a trait defined in traits.json or a keyword
 *      defined in keywords.json (otherwise the UI silently drops its tooltip).
 *
 * All checks are data-driven: they apply to every entity in every data file, so
 * they cover all cases without depending on any specific fixture entity.
 *
 * Thin CLI wrapper: all detection logic lives in validateTraitsLogic.ts so
 * this and the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import type { TraitIssue } from './validateTraitsLogic.js'
import { findTraitIssues } from './validateTraitsLogic.js'

function main(): void {
  const filesByName = loadAllDataFiles()
  console.log(`Validating traits across ${Object.keys(filesByName).length} data file(s)\n`)

  const issues = findTraitIssues(filesByName)

  console.log('='.repeat(80))
  if (issues.length === 0) {
    console.log(
      '✅ All trait types are lowercase, all removeTrait effects resolve, and all trait types are in the known vocabulary!'
    )
    process.exit(0)
  }

  console.log(`❌ Found ${issues.length} trait issue(s):\n`)

  const byFile = new Map<string, TraitIssue[]>()
  for (const issue of issues) {
    let fileIssues = byFile.get(issue.file)
    if (!fileIssues) {
      fileIssues = []
      byFile.set(issue.file, fileIssues)
    }
    fileIssues.push(issue)
  }

  for (const [file, fileIssues] of byFile.entries()) {
    console.log(`${file}:`)
    for (const issue of fileIssues) {
      console.log(`  ${issue.entity} [${issue.kind}]`)
      console.log(`    ${issue.detail}`)
    }
    console.log()
  }

  console.log(`Total: ${issues.length} trait issue(s)`)
  process.exit(1)
}

if (import.meta.main) {
  main()
}
