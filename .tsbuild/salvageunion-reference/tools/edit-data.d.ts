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
export {};
