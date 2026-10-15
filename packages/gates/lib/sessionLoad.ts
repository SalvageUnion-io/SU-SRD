/**
 * What an agent session loads: the instruction text a session working in some
 * directories reads before it starts. doc-drift's `load` check
 * (`tools/check-doc-drift.ts`) totals it per named profile and holds each total
 * to a ratchet; the profiles and their ceilings live there.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** The outcome of one check: `failures` empty means it passed. */
type CheckResult = { ok: string; failures: string[] }

/**
 * A kind of agent session: the directories it works in, and the docs its loaded
 * text tells it to read before working (beyond what loads by itself).
 */
/** `skip`: directories under `dirs` that belong to another session (the Cantina inside `apps/web`). */
export type SessionProfile = { dirs: string[]; reads: string[]; skip?: string[] }

/** How far under its ceiling a profile may fall before the ceiling must come down. */
export const SESSION_SLACK = 500

const read = (root: string, relPath: string): string => readFileSync(join(root, relPath), 'utf-8')

/** Repo-relative paths of the `.md` files at or below `dir`, sorted. */
export function markdownIn(root: string, dir: string): string[] {
  const full = join(root, dir)
  if (!existsSync(full)) return []
  const found: string[] = []
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...markdownIn(root, `${dir}/${entry.name}`))
    else if (entry.name.endsWith('.md')) found.push(`${dir}/${entry.name}`)
  }
  return found.sort()
}

/**
 * "This path is gitignored at the repo root": absent in CI by design, so its
 * existence proves nothing. Handles the rule shapes the root `.gitignore` uses.
 */
export function gitignoredMatcher(root: string): (candidate: string) => boolean {
  const file = join(root, '.gitignore')
  if (!existsSync(file)) return () => false
  const rules = readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('!'))
  return (candidate) =>
    rules.some((line) => {
      const rule = line.replace(/^\//, '')
      const bare = rule.replace(/\/$/, '')
      // An unanchored pattern with no inner slash matches that name at any depth.
      if (!line.startsWith('/') && !bare.includes('/') && !bare.includes('*')) {
        return candidate.split('/').includes(bare)
      }
      if (rule.startsWith('**/')) {
        const name = rule.slice(3)
        return candidate.startsWith(name) || candidate.includes(`/${name}`)
      }
      if (rule.endsWith('/*')) return candidate.startsWith(rule.slice(0, -1))
      if (rule.includes('*')) return false
      return candidate === rule || candidate.startsWith(rule.endsWith('/') ? rule : `${rule}/`)
    })
}

/** Repo-relative paths a doc imports by a line of its own: `@path`, relative to the doc. */
export function importsOf(doc: string, source: string): string[] {
  return [...source.matchAll(/^@(\S+)\s*$/gm)].map((match) =>
    join(dirname(doc), match[1] as string)
  )
}

/** Files at or below `dir`, repo-relative, minus node_modules and gitignored paths. */
function filesUnder(root: string, dir: string, ignored: (path: string) => boolean): string[] {
  const full = join(root, dir)
  if (!existsSync(full)) return []
  const found: string[] = []
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.name === 'node_modules' || ignored(path)) continue
    if (entry.isDirectory()) found.push(...filesUnder(root, path, ignored))
    else found.push(path)
  }
  return found
}

/** A rule's `paths:` globs from its front matter; empty when it has none (it always loads). */
export function rulePaths(source: string): string[] {
  const front = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const list = front.match(/^paths:[ \t]*\n((?:[ \t]+-.*(?:\n|$))+)/m)?.[1] ?? ''
  return [...list.matchAll(/^[ \t]+-[ \t]*['"]?([^'"\n]+?)['"]?[ \t]*$/gm)].map(
    (match) => match[1] as string
  )
}

/**
 * The files a session in `profile` loads: the root CLAUDE.md, every CLAUDE.md
 * under its directories, each with its `@path` imports, every rule whose
 * `paths:` match a file there (or that has none), and the profile's `reads`.
 */
export function sessionLoad(root: string, profile: SessionProfile): string[] {
  const gitignored = gitignoredMatcher(root)
  const skip = profile.skip ?? []
  const ignored = (path: string) => gitignored(path) || skip.includes(path)
  const files = profile.dirs.flatMap((dir) => filesUnder(root, dir, ignored))
  const claudeMds = ['CLAUDE.md', ...files.filter((file) => file.endsWith('/CLAUDE.md')).sort()]
  const loaded: string[] = []
  for (const doc of claudeMds.filter((doc) => existsSync(join(root, doc)))) {
    loaded.push(doc, ...importsOf(doc, read(root, doc)))
  }
  for (const rule of markdownIn(root, '.claude/rules')) {
    const globs = rulePaths(read(root, rule)).map((glob) => new Bun.Glob(glob))
    if (globs.length === 0 || files.some((file) => globs.some((glob) => glob.match(file)))) {
      loaded.push(rule)
    }
  }
  return [...new Set([...loaded, ...profile.reads])]
}

/** Each profile's total against its ceiling: over fails, more than `SESSION_SLACK` under too. */
export function checkSessionLoad(
  root: string,
  profiles: Record<string, SessionProfile>,
  ceilings: Record<string, number>
): CheckResult {
  const failures: string[] = []
  const totals: string[] = []
  for (const [name, profile] of Object.entries(profiles)) {
    for (const path of [...profile.dirs, ...profile.reads]) {
      if (!existsSync(join(root, path))) {
        failures.push(`SESSION_PROFILES.${name} names ${path}, which does not exist.`)
      }
    }
    const sizes = sessionLoad(root, profile)
      .filter((file) => existsSync(join(root, file)))
      .map((file): [string, number] => [file, [...read(root, file)].length])
    const total = sizes.reduce((sum, [, size]) => sum + size, 0)
    totals.push(`${name} ${total}`)
    const ceiling = ceilings[name]
    if (ceiling === undefined) {
      failures.push(`SESSION_CEILINGS has no entry for ${name}. Add it at ${total}.`)
      continue
    }
    if (total > ceiling) {
      const largest = sizes
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([file, size]) => `${file} ${size}`)
        .join(', ')
      failures.push(
        `The ${name} session loads ${total} characters, over its ${ceiling} ceiling ` +
          `(largest: ${largest}). Cut what it loads, or scope a rule's paths: tighter.`
      )
    } else if (total < ceiling - SESSION_SLACK) {
      failures.push(
        `The ${name} session loads ${total} characters, ${ceiling - total} under its ${ceiling} ` +
          `ceiling. Lower SESSION_CEILINGS.${name} to ${total}.`
      )
    }
  }
  for (const name of Object.keys(ceilings)) {
    if (!(name in profiles)) {
      failures.push(`SESSION_CEILINGS names ${name}, which is not a profile. Remove the entry.`)
    }
  }
  return { ok: `session loads within their ceilings (${totals.join(', ')})`, failures }
}
