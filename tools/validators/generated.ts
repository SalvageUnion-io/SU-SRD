#!/usr/bin/env bun
/**
 * Validate that generated files are up-to-date with schema files
 * Compares actual file content to detect stale generated code
 * This is more reliable than timestamp comparison, especially in CI environments
 */

import { join } from 'path'
import { spawn } from 'bun'
import { createHash } from 'crypto'

/**
 * Normalize file content for comparison
 * Handles line endings and trailing whitespace differences
 */
function normalizeContent(content: string): string {
  // Normalize line endings to LF
  let normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Remove trailing whitespace from each line
  normalized = normalized
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
  return normalized
}

/**
 * Get file content hash for comparison
 */
async function getFileHash(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath)
    const content = await file.text()
    const normalized = normalizeContent(content)
    return createHash('sha256').update(normalized).digest('hex')
  } catch {
    return null
  }
}

/**
 * Get all generated type files
 */
function getGeneratedFiles(): string[] {
  const libTypesDir = join(import.meta.dir, '..', '..', 'src', 'reference', '/types')
  return [
    join(libTypesDir, 'enums.ts'),
    join(libTypesDir, 'common.ts'),
    join(libTypesDir, 'objects.ts'),
    join(libTypesDir, 'schemas.ts'),
    join(import.meta.dir, '..', '..', 'src', 'reference', '/index.ts'),
  ]
}

/**
 * Generate files and return their content hashes
 * This temporarily overwrites the existing files, so we need to restore them
 */
async function generateAndGetHashes(): Promise<Map<string, string>> {
  const packageDir = join(import.meta.dir, '..', '..')
  const generatedFiles = getGeneratedFiles()

  // Run generation (this will overwrite existing files)
  const generateScripts = [
    'generate:enums',
    'generate:common',
    'generate:objects',
    'generate:schemas',
    'generate:index',
  ]

  for (const script of generateScripts) {
    // Use bun run for consistency and better compatibility in CI
    const proc = spawn(['bun', 'run', script], {
      cwd: packageDir,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    const result = await proc.exited

    if (result !== 0) {
      console.error(`❌ Failed to generate ${script}`)
      const stderr = await new Response(proc.stderr).text()
      const stdout = await new Response(proc.stdout).text()
      if (stderr) console.error('STDERR:', stderr)
      if (stdout) console.error('STDOUT:', stdout)
      throw new Error(`Generation failed for ${script}`)
    }
  }

  // Get hashes of newly generated files
  const newHashes = new Map<string, string>()
  for (const file of generatedFiles) {
    const hash = await getFileHash(file)
    if (hash) {
      newHashes.set(file, hash)
    }
  }

  return newHashes
}

/**
 * Validate that generated files match what would be generated from current schemas
 */
async function validateGenerated(): Promise<boolean> {
  console.log('🔍 Validating generated files...\n')

  const generatedFiles = getGeneratedFiles()

  // Check that all files exist
  for (const file of generatedFiles) {
    const fileHandle = Bun.file(file)
    if (!(await fileHandle.exists())) {
      console.error(`❌ Generated file not found: ${file.split('/').pop()}`)
      return false
    }
  }

  // Save original file contents
  const originalContents = new Map<string, string>()
  for (const file of generatedFiles) {
    try {
      const fileHandle = Bun.file(file)
      originalContents.set(file, await fileHandle.text())
    } catch {
      console.error(`❌ Could not read file: ${file.split('/').pop()}`)
      return false
    }
  }

  // Get original hashes
  const originalHashes = new Map<string, string>()
  for (const [file, content] of originalContents) {
    const normalized = normalizeContent(content)
    originalHashes.set(file, createHash('sha256').update(normalized).digest('hex'))
  }

  // Generate fresh files and get their hashes
  let newHashes: Map<string, string>
  try {
    newHashes = await generateAndGetHashes()
  } catch {
    // Restore original files on error
    for (const [file, content] of originalContents) {
      await Bun.write(file, content)
    }
    console.error('❌ Failed to generate comparison files')
    return false
  }

  // Compare hashes
  let allValid = true
  const staleFiles: string[] = []

  for (const file of generatedFiles) {
    const originalHash = originalHashes.get(file)
    const newHash = newHashes.get(file)

    if (!originalHash || !newHash) {
      console.error(`❌ Could not hash file: ${file.split('/').pop()}`)
      allValid = false
      staleFiles.push(file)
      continue
    }

    if (originalHash !== newHash) {
      console.error(`❌ Stale: ${file.split('/').pop()}`)
      // Show a sample of the difference for debugging
      const originalContent = originalContents.get(file) || ''
      const fileHandle = Bun.file(file)
      const newContent = await fileHandle.text()
      const originalNormalized = normalizeContent(originalContent)
      const newNormalized = normalizeContent(newContent)

      if (originalNormalized !== newNormalized) {
        // Find first difference
        const originalLines = originalNormalized.split('\n')
        const newLines = newNormalized.split('\n')
        const maxLines = Math.max(originalLines.length, newLines.length)

        for (let i = 0; i < Math.min(maxLines, 10); i++) {
          if (originalLines[i] !== newLines[i]) {
            console.error(`   First difference at line ${i + 1}:`)
            const originalLine = originalLines[i]
            if (originalLine !== undefined) {
              console.error(`   Original: ${JSON.stringify(originalLine.substring(0, 100))}`)
            }
            const newLine = newLines[i]
            if (newLine !== undefined) {
              console.error(`   New:      ${JSON.stringify(newLine.substring(0, 100))}`)
            }
            break
          }
        }
      }

      allValid = false
      staleFiles.push(file)
    } else {
      console.log(`✅ Fresh: ${file.split('/').pop()}`)
    }
  }

  // Restore original files (always restore, even if validation passes,
  // to avoid modifying files during validation)
  for (const [file, content] of originalContents) {
    await Bun.write(file, content)
  }

  console.log()

  if (!allValid) {
    console.error('❌ Some generated files are stale!')
    console.error('\n💡 Run `bun run generate` to update generated files\n')
    console.error('Stale files:')
    staleFiles.forEach((f) => console.error(`  - ${f.replace(process.cwd() + '/', '')}`))
    return false
  }

  console.log('✅ All generated files are up-to-date!\n')
  return true
}

async function main() {
  const isValid = await validateGenerated()
  return isValid ? 0 : 1
}

// Export for use in unified runner
export default main

// Run directly if called as script
if (import.meta.main) {
  const exitCode = await main()
  process.exit(exitCode)
}
