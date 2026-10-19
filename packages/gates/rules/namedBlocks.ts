/**
 * R18, same content, same block — the `named-block` rule of the
 * `entity-nesting` rule set (`entityNesting.ts`). A named rules block (When
 * Damaged) has one renderer in every context (EDL E15), so its field is read
 * off an entity in one module only, the block's own (`x.damagedEffect`,
 * `'damagedEffect' in x`); everyone else asks it (`damagedEffectOf`). A
 * card's `hide` flag of the same name is not a read, nor is a key, a comment
 * or a test.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Exemption, Finding } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'

const SRC = 'apps/web/src'

const isTest = (rel: string) => rel.split('/').includes('__tests__') || /\.test\.tsx?$/.test(rel)

/**
 * Each named rules block: the entity field it draws and the one module that
 * reads it, its renderer's model (hard rule R18). A new block is a line here.
 */
export const NAMED_BLOCKS: readonly { field: string; reader: string }[] = [
  {
    field: 'damagedEffect',
    reader: 'apps/web/src/components/referenceEntity/card/whenDamaged.model.ts',
  },
]

/** Source modules, components and models alike: a field read hides in either. */
function moduleFiles(root: string): string[] {
  return listFiles(root, [SRC], ['.ts', '.tsx']).filter((rel) => !isTest(rel))
}

/** A line's code, its comments dropped (a doc may name the field). */
function codeOf(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return ''
  return line.replace(/\/\/.*$/, '')
}

export function scanNamedBlocks(
  root: string,
  exemptions: readonly Exemption[] = [],
  files = moduleFiles(root)
): Finding[] {
  const out: Finding[] = []
  for (const rel of files) {
    if (isExempt(exemptions, rel, 'named-block')) continue
    const lines = readFileSync(join(root, rel), 'utf8').split('\n')
    for (const { field, reader } of NAMED_BLOCKS) {
      if (rel === reader) continue
      // `x.field` / `x?.field` off anything but a `hide` flag set, or `'field' in x`.
      const read = new RegExp(`(?<!\\bhide\\??)\\??\\.${field}\\b|['"]${field}['"]\\s+in\\b`)
      lines.forEach((line, i) => {
        if (!read.test(codeOf(line))) return
        out.push({
          file: rel,
          line: i + 1,
          detail: `reads \`${field}\` off an entity outside its block's model (${reader.split('/').pop()})`,
        })
      })
    }
  }
  return out
}
