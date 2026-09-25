/**
 * The two `.claude/workflows/*.js` scripts, run for real against stubbed
 * workflow primitives.
 *
 * Nothing executed these before, and it showed twice: `batch_issue_response.js`
 * shipped a missing comma between two prompt lines — a SyntaxError that made
 * the whole workflow unloadable while every check stayed green — and both
 * prompts kept telling subagents things the repo had long since stopped being
 * true (ITUN is "local-first, no backend", reuse `EntityDisplay`, a Prettier
 * hook, bare `bun test`, `gh` always present). A prompt is executed, not read,
 * so these assert on what the subagents are actually told.
 *
 * The workflow runtime evaluates a script as an async function body with
 * `args`, `agent`, `parallel`, `phase`, `log` and `workflow` in scope; the
 * harness below does the same, minus the `export` on `meta`.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type AgentCall = { prompt: string; options: { label?: string } }
type Runtime = {
  agent: (prompt: string, options: { label?: string }) => Promise<unknown>
  workflow: (name: string, args: unknown) => Promise<unknown>
}
type WorkflowBody = (
  args: unknown,
  agent: Runtime['agent'],
  parallel: (tasks: (() => Promise<unknown>)[]) => Promise<unknown[]>,
  phase: (title: string) => void,
  log: (message: string) => void,
  workflow: Runtime['workflow']
) => Promise<unknown>

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...params: string[]
) => WorkflowBody

const WORKFLOW_DIR = join(import.meta.dir, '..', '..', '.claude', 'workflows')

function compile(name: string): WorkflowBody {
  const source = readFileSync(join(WORKFLOW_DIR, `${name}.js`), 'utf-8').replace(
    /^export const meta/m,
    'const meta'
  )
  return new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'workflow', source)
}

async function run(
  name: string,
  args: unknown,
  respond: (call: AgentCall) => unknown,
  workflow: Runtime['workflow'] = async () => null
): Promise<{ calls: AgentCall[]; logs: string[]; result: unknown }> {
  const calls: AgentCall[] = []
  const logs: string[] = []
  const result = await compile(name)(
    args,
    async (prompt, options) => {
      const call = { prompt, options }
      calls.push(call)
      return respond(call)
    },
    (tasks) => Promise.all(tasks.map((task) => task())),
    () => undefined,
    (message) => logs.push(message),
    workflow
  )
  return { calls, logs, result }
}

/** Claims both prompts used to make, each of which the repo had retired. */
const RETIRED_CLAIMS: [RegExp, string][] = [
  [/local-first/i, 'ITUN has been account-gated since ADR-030/034/035'],
  [/no auth\/backend|do not introduce a backend/i, 'Convex is the server of record'],
  [/\bEntityDisplay\b|\bDisplayCard\b/, 'neither component exists'],
  [/prettier/i, 'Biome is the only formatter'],
  [/"bun test"/, 'the gate is `bun run test`'],
  [/docs\/rules\//, 'that digest never existed'],
]

function expectNoRetiredClaims(prompt: string): void {
  for (const [pattern, why] of RETIRED_CLAIMS) {
    if (pattern.test(prompt)) throw new Error(`prompt matches ${pattern} — ${why}`)
  }
}

const IMPL_RESULT = {
  prNumber: 7,
  prUrl: 'https://github.com/SalvageUnion-io/SU-SRD/pull/7',
  branch: 'fix/itun-x',
  validated: true,
  summary: 's',
  notes: '',
}

describe('single_issue_resolve', () => {
  it('tells both subagents current facts and how to reach GitHub without gh', async () => {
    const { calls, result } = await run(
      'single_issue_resolve',
      'The heat track is unreadable',
      (call) =>
        call.options.label?.startsWith('resolve:')
          ? IMPL_RESULT
          : { approval: 'approved', commentUrl: null, rationale: 'r' }
    )
    expect(calls).toHaveLength(2)
    for (const { prompt } of calls) {
      expectNoRetiredClaims(prompt)
      expect(prompt).toContain('ToolSearch')
      expect(prompt).toContain('SalvageUnion-io')
    }
    const [impl] = calls
    expect(impl?.prompt).toContain('ReferenceEntityCard')
    expect(impl?.prompt).toContain('ADR-035')
    expect(impl?.prompt).toContain('bun run test')
    expect(impl?.prompt).not.toContain('STACKED')
    expect((result as { review: unknown }).review).not.toBeNull()
  })

  it('names rebase --onto for a two-layer stack and gh stack for three or more', async () => {
    const promptFor = async (stackDepth: number): Promise<string> => {
      const { calls } = await run(
        'single_issue_resolve',
        { title: 't', summary: 's', baseBranch: 'fix/itun-base', stackDepth },
        () => null
      )
      return calls[0]?.prompt ?? ''
    }
    const two = await promptFor(2)
    expect(two).toContain('STACKED on "fix/itun-base"')
    expect(two).toContain('git rebase --onto')
    expect(two).not.toContain('gh stack sync')

    const three = await promptFor(3)
    expect(three).toContain('3 PRs deep')
    expect(three).toContain('gh stack sync')
  })
})

describe('batch_issue_response', () => {
  it('parses, stacks a three-item group base-first and hands it to gh stack', async () => {
    const dispatched: { name: string; args: Record<string, unknown> }[] = []
    let n = 0
    const { calls, result } = await run(
      'batch_issue_response',
      ['first', 'second', 'third'],
      (call) => {
        if (call.options.label?.startsWith('triage:')) {
          return {
            title: call.prompt.split('\n')[3]?.trim(),
            summary: 's',
            uxArea: 'u',
            rules: [],
            approach: 'a',
            inScope: true,
          }
        }
        if (call.options.label === 'relate:dependency-graph') {
          return { groups: [{ order: [0, 1, 2], relation: 'same component' }] }
        }
        return null
      },
      async (name, args) => {
        dispatched.push({ name, args: args as Record<string, unknown> })
        n++
        return { implementation: { branch: `fix/itun-${n}`, prUrl: null }, review: null }
      }
    )

    for (const { prompt } of calls) expectNoRetiredClaims(prompt)
    expect(dispatched.map((d) => d.args.baseBranch)).toEqual([
      undefined,
      'fix/itun-1',
      'fix/itun-2',
    ])
    expect(dispatched.every((d) => d.args.stackDepth === 3)).toBe(true)

    const { stackRecovery } = result as {
      stackRecovery: { branches: string[]; procedure: string }[]
    }
    expect(stackRecovery).toEqual([
      {
        branches: ['fix/itun-1', 'fix/itun-2', 'fix/itun-3'],
        procedure: 'gh stack checkout fix/itun-3, then gh stack sync after every merge beneath it',
      },
    ])
  })

  it('falls back to GitHub issues with a gh-or-MCP instruction when given no feedback', async () => {
    const { calls } = await run('batch_issue_response', undefined, () => ({ items: [] }))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.options.label).toBe('collect:github-issues')
    expect(calls[0]?.prompt).toContain('mcp__github__list_issues')
  })
})
