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
 */

import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { findTraitIssues, type TraitIssue } from './validateTraitsLogic.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', 'data')

// Load every data file that is an array of entities.
const filesByName: Record<string, Record<string, unknown>[]> = {}
for (const filename of readdirSync(dataDir)) {
  if (!filename.endsWith('.json')) continue
  try {
    const parsed = JSON.parse(readFileSync(join(dataDir, filename), 'utf-8'))
    if (Array.isArray(parsed)) {
      filesByName[filename] = parsed
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error)
  }
}

const fileCount = Object.keys(filesByName).length
console.log(`Validating traits across ${fileCount} data file(s)\n`)

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
  if (!byFile.has(issue.file)) byFile.set(issue.file, [])
  byFile.get(issue.file)!.push(issue)
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
