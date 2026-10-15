import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderShell, SHELL_DESCRIPTION } from '../../shell/shell'

/**
 * The PWA manifest's description is what an install prompt shows. It said
 * "Local-first character builder" long after the account became the server of
 * record (ADR-034/035), so it now IS the shell's meta description: one
 * constant, which this keeps both reading. Read as text: importing
 * `vite.cantina.config.ts` would load every Vite plugin.
 */
const workspace = join(import.meta.dir, '..', '..', '..', '..')
const config = readFileSync(join(workspace, 'vite.cantina.config.ts'), 'utf8')

describe('PWA manifest description', () => {
  test("is the shell's meta description", () => {
    expect(config).toContain('description: SHELL_DESCRIPTION,')
    expect(renderShell()).toContain(`<meta name="description" content="${SHELL_DESCRIPTION}"/>`)
  })

  test('does not describe the retired device-only model', () => {
    expect(SHELL_DESCRIPTION).not.toMatch(/local-first/i)
  })
})
