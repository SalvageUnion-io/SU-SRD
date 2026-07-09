#!/usr/bin/env tsx

/**
 * Check all data files for unique UUIDs
 * This script validates that:
 * 1. All IDs are valid UUIDs (v4 format) — except files in SLUG_ID_FILES
 * 2. All IDs are unique within each file
 * 3. All IDs are unique across all files
 *
 * Thin CLI wrapper: all detection logic lives in checkUniqueIdsLogic.ts so
 * this and the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { checkAllFiles, type ValidationResult } from './checkUniqueIdsLogic.js'

function printResults(results: ValidationResult): void {
  let hasIssues = false

  console.log('🔍 Checking all data files for unique UUIDs...\n')
  console.log('📁 File-by-File Analysis:')
  console.log('='.repeat(80))

  for (const fileResult of results.files) {
    const hasFileIssues =
      fileResult.invalidUUIDs.length > 0 || fileResult.duplicatesInFile.length > 0

    if (hasFileIssues) {
      hasIssues = true
      console.log(`\n❌ ${fileResult.file}`)
      console.log(`   Total items: ${fileResult.totalItems}`)
      console.log(`   Items with IDs: ${fileResult.itemsWithIds}`)

      if (fileResult.invalidUUIDs.length > 0) {
        console.log(`   ⚠️  Invalid UUIDs: ${fileResult.invalidUUIDs.length}`)
        fileResult.invalidUUIDs.forEach(({ id, index, context }) => {
          console.log(`      - Index ${index}: "${id} (${context})"`)
        })
      }

      if (fileResult.duplicatesInFile.length > 0) {
        console.log(`   ⚠️  Duplicate IDs within file: ${fileResult.duplicatesInFile.length}`)
        fileResult.duplicatesInFile.forEach(({ id, indices }) => {
          console.log(`      - "${id}" at indices: ${indices.join(', ')}`)
        })
      }
    } else {
      console.log(`✅ ${fileResult.file} (${fileResult.itemsWithIds} IDs)`)
    }
  }

  if (results.globalDuplicates.length > 0) {
    hasIssues = true
    console.log('\n\n🌍 Global Duplicate IDs (across files):')
    console.log('='.repeat(80))

    results.globalDuplicates.forEach(({ id, files }) => {
      console.log(`\n❌ ID: "${id}"`)
      files.forEach(({ file, indices }) => {
        console.log(`   - ${file} at indices: ${indices.join(', ')}`)
      })
    })
  }

  console.log('\n\n📊 Summary:')
  console.log('='.repeat(80))
  console.log(`Total IDs found: ${results.totalIds}`)
  console.log(`Unique IDs: ${results.uniqueIds}`)
  console.log(`Invalid UUIDs: ${results.invalidIds}`)
  console.log(`Duplicate IDs (global): ${results.duplicateIds}`)

  if (!hasIssues) {
    console.log('\n✅ All IDs are valid and unique!')
  } else {
    console.log('\n❌ Issues found! Please review the output above.')
    process.exit(1)
  }
}

const results = checkAllFiles(loadAllDataFiles())
printResults(results)
