#!/usr/bin/env bun
/**
 * agent-digest — a weekly readout of what the agent fleet actually did.
 *
 * Agents are the largest single labour input in this repo — in the fortnight
 * this tool was written, 22 sessions in this project spawned another 109
 * subagent runs — and until now not one number about them was collected. No
 * cost, no tool-error rate, no idea how often a guard hook fired or how many
 * sessions ended without landing anything.
 *
 * (Those two figures are why the split exists: counting transcript files
 * without separating them reports "131 sessions" for 22 real ones, which is
 * how this tool's own first draft — and the review that prompted it —
 * overstated the number by ~6x.)
 *
 * The instinct when facing that gap is to stand up telemetry — an OTLP
 * endpoint, a collector, a dashboard. Don't, yet. Claude Code already writes a
 * complete, structured record of every session to
 * `~/.claude/projects/<encoded-cwd>/<session>.jsonl`, and hundreds of those
 * files are already sitting on disk. That is a dataset being treated as
 * exhaust. Read it first; it will tell you whether streaming telemetry is worth
 * configuring at all, and it costs one script instead of an integration.
 *
 * Usage:
 *   bun tools/agent-digest.ts                 # this repo, last 14 days
 *   bun tools/agent-digest.ts --days 30       # a longer window
 *   bun tools/agent-digest.ts --all           # every project on this machine
 *   bun tools/agent-digest.ts --json          # machine-readable, for trending
 *
 * Reads only. Never writes, never uploads, never leaves the machine.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

type Args = { days: number; all: boolean; json: boolean }

function parseArgs(argv: string[]): Args {
  const daysFlag = argv.indexOf('--days')
  return {
    days: daysFlag === -1 ? 14 : Number(argv[daysFlag + 1]) || 14,
    all: argv.includes('--all'),
    json: argv.includes('--json'),
  }
}

/**
 * Claude Code encodes a project's directory into its transcript folder name by
 * replacing every path separator with a dash. Worktrees get their own folder,
 * so resolve to the MAIN working tree — otherwise a digest run from inside a
 * worktree silently reports on that worktree alone.
 */
function mainWorktreeDir(): string {
  const out = Bun.spawnSync(['git', 'worktree', 'list', '--porcelain']).stdout.toString()
  const first = out.split('\n').find((l) => l.startsWith('worktree '))
  return first ? first.slice('worktree '.length).trim() : process.cwd()
}

const encodeProject = (dir: string): string => dir.replace(/\//g, '-')

type Session = {
  project: string
  file: string
  /**
   * A project folder holds top-level `<session>.jsonl` files — the sessions you
   * actually start — plus `<session>/subagents/agent-*.jsonl` for every
   * subagent those sessions spawned. Counting them together overstates
   * "sessions" by roughly 5x (22 real sessions vs 131 files, measured), so they
   * are tallied separately.
   */
  kind: 'main' | 'subagent'
  startedAt: Date
  endedAt: Date
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  toolCalls: number
  toolErrors: number
  toolNames: Map<string, number>
  errorToolNames: Map<string, number>
  denials: number
  committed: boolean
  branches: Set<string>
}

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

/** Content is an array of blocks for tool traffic, but a bare string elsewhere. */
const blocksOf = (rec: unknown): Array<Record<string, unknown>> => {
  const content = (rec as { message?: { content?: unknown } })?.message?.content
  return Array.isArray(content) ? (content as Array<Record<string, unknown>>) : []
}

/**
 * A permission denial — the auto-mode classifier, a `permissions.deny` rule, or
 * a PreToolUse hook returning deny. All three surface as an errored tool_result
 * whose text says so, rather than as a distinct record type.
 */
const DENIAL = /permission .*denied|denied by the claude code|blocked by classifier|^blocked:/i

function readSession(project: string, file: string, kind: 'main' | 'subagent'): Session | null {
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return null
  }

  const session: Session = {
    project,
    file,
    kind,
    startedAt: new Date(8.64e15),
    endedAt: new Date(0),
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    toolCalls: 0,
    toolErrors: 0,
    toolNames: new Map(),
    errorToolNames: new Map(),
    denials: 0,
    committed: false,
    branches: new Set(),
  }

  // tool_result carries only the id it answers, so remember what each id was.
  const toolNameById = new Map<string, string>()
  let sawAnything = false

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let rec: Record<string, unknown>
    try {
      rec = JSON.parse(line)
    } catch {
      continue // a partially-flushed final line is normal on a live session
    }

    const ts = rec.timestamp as string | undefined
    if (ts) {
      const at = new Date(ts)
      if (!Number.isNaN(at.valueOf())) {
        sawAnything = true
        if (at < session.startedAt) session.startedAt = at
        if (at > session.endedAt) session.endedAt = at
      }
    }
    if (typeof rec.gitBranch === 'string' && rec.gitBranch) session.branches.add(rec.gitBranch)

    const usage = (rec as { message?: { usage?: Record<string, number> } })?.message?.usage
    if (usage) {
      session.outputTokens += usage.output_tokens ?? 0
      session.cacheReadTokens += usage.cache_read_input_tokens ?? 0
      session.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0
    }

    for (const block of blocksOf(rec)) {
      if (block.type === 'tool_use') {
        session.toolCalls++
        const name = String(block.name ?? '?')
        bump(session.toolNames, name)
        if (typeof block.id === 'string') toolNameById.set(block.id, name)

        // "Did this session land anything?" is the cheapest proxy for whether
        // the work survived, and it needs no git archaeology.
        const command = (block.input as { command?: string } | undefined)?.command
        if (name === 'Bash' && command && /\bgit\s+commit\b/.test(command)) {
          session.committed = true
        }
      }

      if (block.type === 'tool_result') {
        const text =
          typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '')
        if (block.is_error) {
          session.toolErrors++
          bump(session.errorToolNames, toolNameById.get(String(block.tool_use_id)) ?? '?')
        }
        if (DENIAL.test(text)) session.denials++
      }
    }
  }

  return sawAnything ? session : null
}

function collect({ days, all }: Args): Session[] {
  const root = join(homedir(), '.claude', 'projects')
  const cutoff = Date.now() - days * 86_400_000
  const wanted = encodeProject(mainWorktreeDir())

  let projectDirs: string[]
  try {
    projectDirs = readdirSync(root)
  } catch {
    return []
  }
  if (!all) projectDirs = projectDirs.filter((d) => d === wanted)

  const sessions: Session[] = []

  const take = (dir: string, path: string, kind: 'main' | 'subagent') => {
    // mtime is a cheap pre-filter; the authoritative window check is the
    // session's own last timestamp, below.
    try {
      if (statSync(path).mtimeMs < cutoff) return
    } catch {
      return
    }
    const s = readSession(dir, path, kind)
    if (s && s.endedAt.valueOf() >= cutoff) sessions.push(s)
  }

  for (const dir of projectDirs) {
    const full = join(root, dir)
    let entries: string[]
    try {
      entries = readdirSync(full)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.endsWith('.jsonl')) {
        take(dir, join(full, entry), 'main')
        continue
      }
      // `<session-uuid>/subagents/agent-*.jsonl` — one file per subagent run.
      const subagentDir = join(full, entry, 'subagents')
      try {
        for (const f of readdirSync(subagentDir)) {
          if (f.endsWith('.jsonl')) take(dir, join(subagentDir, f), 'subagent')
        }
      } catch {
        // not a session folder (e.g. `memory/`), or it spawned no subagents
      }
    }
  }
  return sessions.sort((a, b) => a.startedAt.valueOf() - b.startedAt.valueOf())
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const pct = (n: number, d: number) => (d === 0 ? '0.0%' : `${((n / d) * 100).toFixed(1)}%`)

/**
 * Token counts here span six orders of magnitude — a session's output is
 * thousands, its cache reads are billions — so a single fixed unit is
 * unreadable at one end or the other. Step the unit instead.
 */
function k(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

function mergeCounts(maps: Array<Map<string, number>>): Array<[string, number]> {
  const merged = new Map<string, number>()
  for (const m of maps) for (const [key, v] of m) merged.set(key, (merged.get(key) ?? 0) + v)
  return [...merged].sort((a, b) => b[1] - a[1])
}

const args = parseArgs(process.argv.slice(2))
const sessions = collect(args)

if (sessions.length === 0) {
  console.log(`No agent sessions in the last ${args.days} days.`)
  process.exit(0)
}

// Session-shaped metrics (how many, how long, did it land) describe sessions
// you actually started; token and tool volume covers every process, subagents
// included, because that is what the work really cost.
const main = sessions.filter((s) => s.kind === 'main')
const subagents = sessions.filter((s) => s.kind === 'subagent')

const toolCalls = sum(sessions.map((s) => s.toolCalls))
const toolErrors = sum(sessions.map((s) => s.toolErrors))
const denials = sum(sessions.map((s) => s.denials))
const outputTokens = sum(sessions.map((s) => s.outputTokens))
const cacheRead = sum(sessions.map((s) => s.cacheReadTokens))
const cacheCreation = sum(sessions.map((s) => s.cacheCreationTokens))
const committed = main.filter((s) => s.committed).length
const durations = main
  .map((s) => (s.endedAt.valueOf() - s.startedAt.valueOf()) / 60_000)
  .sort((a, b) => a - b)
const medianMinutes = durations[Math.floor(durations.length / 2)] ?? 0

if (args.json) {
  console.log(
    JSON.stringify(
      {
        windowDays: args.days,
        sessions: main.length,
        subagentRuns: subagents.length,
        sessionsPerDay: +(main.length / args.days).toFixed(2),
        medianSessionMinutes: +medianMinutes.toFixed(1),
        outputTokens,
        cacheReadTokens: cacheRead,
        cacheCreationTokens: cacheCreation,
        toolCalls,
        toolErrors,
        toolErrorRate: +(toolErrors / Math.max(toolCalls, 1)).toFixed(4),
        denials,
        sessionsWithCommit: committed,
        topTools: mergeCounts(sessions.map((s) => s.toolNames)).slice(0, 10),
        topErrorTools: mergeCounts(sessions.map((s) => s.errorToolNames)).slice(0, 10),
      },
      null,
      2
    )
  )
  process.exit(0)
}

const scope = args.all ? 'all projects' : mainWorktreeDir()
console.log(`\nAgent digest — last ${args.days} days — ${scope}\n${'─'.repeat(60)}`)
console.log(`  sessions              ${main.length}  (${(main.length / args.days).toFixed(1)}/day)`)
console.log(`  subagent runs         ${subagents.length}  (spawned by those sessions)`)
console.log(`  median session        ${medianMinutes.toFixed(0)} min`)
console.log(`  landed a commit       ${committed}  (${pct(committed, main.length)} of sessions)`)
console.log(`  output tokens         ${k(outputTokens)}`)
console.log(`  cache read / created  ${k(cacheRead)} / ${k(cacheCreation)}`)
console.log(`  tool calls            ${k(toolCalls)}`)
console.log(`  tool errors           ${toolErrors}  (${pct(toolErrors, toolCalls)} of calls)`)
console.log(`  permission denials    ${denials}`)

const topTools = mergeCounts(sessions.map((s) => s.toolNames)).slice(0, 8)
console.log(`\n  most-used tools`)
for (const [name, n] of topTools) {
  console.log(`    ${name.padEnd(22)} ${String(n).padStart(5)}  ${pct(n, toolCalls)}`)
}

const topErrors = mergeCounts(sessions.map((s) => s.errorToolNames)).slice(0, 8)
if (topErrors.length > 0) {
  console.log(`\n  tools that errored most`)
  for (const [name, n] of topErrors) {
    const calls = mergeCounts(sessions.map((s) => s.toolNames)).find(([t]) => t === name)?.[1] ?? 0
    console.log(`    ${name.padEnd(22)} ${String(n).padStart(5)}  (${pct(n, calls)} of its calls)`)
  }
}

console.log()
