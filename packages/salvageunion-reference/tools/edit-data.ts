#!/usr/bin/env tsx
/**
 * CST-preserving CLI for editing `data/*.json`.
 *
 * See editDataLogic.ts for why this exists: CLAUDE.md's Data Conventions ban
 * whole-file JSON formatters (they reformat the hand-formatted data corpus).
 * This CLI automates the two most common edits — adding an entity, updating one field
 * — via jsonc-parser's CST editor, which touches only the edited span.
 *
 * Usage:
 *   bun tools/edit-data.ts add <file> --json '<entity JSON>'   (mints `id` when absent)
 *   bun tools/edit-data.ts set <file> (--id <id> | --name <name>) --field <field> --value '<json value>'
 *
 * <file> is a filename in data/ (e.g. "traits.json"), not a path.
 * --value must be JSON-literal syntax: numbers/booleans unquoted, strings
 * quoted (e.g. --value '"Mule Two"'), objects/arrays as JSON.
 *
 * Examples:
 *   bun tools/edit-data.ts add traits.json --json '{"name":"New Trait","description":"..."}'
 *   bun tools/edit-data.ts set chassis.json --name "Mule" --field page --value 101
 *
 * Writes the result back to data/<file> in place. Does NOT run
 * the data checks automatically — run `bun run check data` after editing.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EntityMatcher } from './editDataLogic.js'
import { addEntity, setField, withId } from './editDataLogic.js'
import { dataDir } from './loadData.js'

function parseArgs(argv: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === undefined) continue
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = argv[i + 1]
      if (value === undefined) {
        throw new Error(`Missing value for --${key}`)
      }
      flags[key] = value
      i++
    } else {
      positional.push(arg)
    }
  }
  return { flags, positional }
}

function usageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`)
  console.error(
    [
      'Usage:',
      "  bun tools/edit-data.ts add <file> --json '<entity JSON>'",
      "  bun tools/edit-data.ts set <file> (--id <id> | --name <name>) --field <field> --value '<json value>'",
      '',
      'Examples:',
      '  bun tools/edit-data.ts add traits.json --json \'{"name":"New Trait"}\'   (mints the id)',
      '  bun tools/edit-data.ts set chassis.json --name "Mule" --field page --value 101',
    ].join('\n')
  )
  process.exit(1)
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2)
  if (command !== 'add' && command !== 'set') {
    usageAndExit('first argument must be "add" or "set"')
  }

  const { flags, positional } = parseArgs(rest)
  const file = positional[0]
  if (!file) usageAndExit('missing <file> argument')

  const filePath = join(dataDir, file)
  const source = readFileSync(filePath, 'utf-8')

  let result: string
  if (command === 'add') {
    if (!flags.json) usageAndExit("add requires --json '<entity JSON>'")
    let entity: unknown
    try {
      entity = JSON.parse(flags.json)
    } catch (error) {
      usageAndExit(`--json is not valid JSON: ${(error as Error).message}`)
    }
    const row = withId(entity)
    result = addEntity(source, row)
    const id = row !== null && typeof row === 'object' && 'id' in row ? ` ${String(row.id)}` : ''
    console.log(`Added entity${id} to ${file}`)
  } else {
    if (!flags.id && !flags.name) usageAndExit('set requires --id <id> or --name <name>')
    if (flags.id && flags.name) usageAndExit('set requires only one of --id or --name')
    if (!flags.field) usageAndExit('set requires --field <field>')
    if (flags.value === undefined) usageAndExit("set requires --value '<json value>'")

    let value: unknown
    try {
      value = JSON.parse(flags.value)
    } catch (error) {
      usageAndExit(`--value is not valid JSON: ${(error as Error).message}`)
    }

    const matcher: EntityMatcher = flags.id
      ? { id: flags.id }
      : flags.name
        ? { name: flags.name }
        : usageAndExit('set requires --id <id> or --name <name>')
    result = setField(source, matcher, flags.field, value)
    const desc = flags.id ? `id "${flags.id}"` : `name "${flags.name}"`
    console.log(`Set "${flags.field}" on entity (${desc}) in ${file}`)
  }

  writeFileSync(filePath, result)
}

if (import.meta.main) {
  main()
}
