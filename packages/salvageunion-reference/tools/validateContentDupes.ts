#!/usr/bin/env tsx
/**
 * Detects records that duplicate their own `content[]` prose — a paragraph
 * that repeats another paragraph of the same record verbatim, or an un-split
 * "blob" paragraph sitting alongside the split version of the same text.
 * Either way the entity card renders the prose twice.
 *
 * Thin CLI wrapper: all detection logic lives in validateContentDupesLogic.ts
 * so this and the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { runContentDupeCheck } from './validateContentDupesLogic.js'

function main(): void {
  const filesByName = loadAllDataFiles()
  const dupes = runContentDupeCheck(filesByName)

  console.log(`Scanned ${Object.keys(filesByName).length} data file(s) for duplicated content.`)
  console.log(`\n${'='.repeat(80)}`)

  if (dupes.length === 0) {
    console.log('No records duplicate their own content.')
    process.exit(0)
  }

  console.error(`Found ${dupes.length} duplicated paragraph(s):\n`)

  const byFile = new Map<string, typeof dupes>()
  for (const dupe of dupes) {
    const bucket = byFile.get(dupe.file)
    if (bucket) bucket.push(dupe)
    else byFile.set(dupe.file, [dupe])
  }

  for (const [file, fileDupes] of byFile) {
    console.error(`${file}: ${fileDupes.length} issue(s)`)
    for (const dupe of fileDupes) {
      const relation =
        dupe.kind === 'exact'
          ? `repeats paragraph ${dupe.duplicateOf} verbatim`
          : `fully contains paragraph ${dupe.duplicateOf}`
      console.error(`  - "${dupe.record}" paragraph ${dupe.paragraph} ${relation}`)
      console.error(`      ${dupe.excerpt}`)
    }
    console.error('')
  }

  console.error(
    'Each of these renders the same prose twice on the entity card. Remove the\n' +
      'redundant paragraph, or trim the containing one down to the text that is\n' +
      'genuinely its own (usually the leading flavour sentence).'
  )
  process.exit(1)
}

if (import.meta.main) {
  main()
}
