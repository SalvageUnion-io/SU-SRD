import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

/**
 * `.mcp.json` starts the Convex MCP server with `bunx convex@<pin>`, so it runs
 * the CLI version ITUN pins whether or not `node_modules` is installed. Nothing
 * bumps that pin automatically; this test fails if it and the workspace one
 * ever differ, or if a write tool or a production flag creeps back in.
 */

const ROOT = join(import.meta.dir, '..', '..')

type McpConfig = { mcpServers: { convex: { command: string; args: string[] } } }
type Manifest = { dependencies: Record<string, string> }

const mcp: McpConfig = await Bun.file(join(ROOT, '.mcp.json')).json()
const itun: Manifest = await Bun.file(join(ROOT, 'apps/itun/package.json')).json()
const { args } = mcp.mcpServers.convex

describe('.mcp.json convex server', () => {
  test('runs the Convex CLI version apps/itun pins', () => {
    expect(args[0]).toBe(`convex@${itun.dependencies.convex}`)
  })

  test('disables the write tools', () => {
    const disabled = args[args.indexOf('--disable-tools') + 1]?.split(',') ?? []
    expect(disabled).toEqual(expect.arrayContaining(['envSet', 'envRemove', 'run']))
  })

  test('never reaches production', () => {
    expect(args).not.toContain('--dangerously-enable-production-deployments')
    expect(args).not.toContain('--cautiously-allow-production-pii')
  })
})
