/**
 * History phrases in code comments: the `history` check of
 * `tools/check-doc-drift.ts`.
 *
 * A comment says what is true of the code beside it and why. The story of how
 * it got that way (the issue that asked for it, the phase that built it, what
 * it did before) lives in git, where `git log -S` and `git blame` find it; in a
 * comment it goes stale while it still reads as current. Each phrase below is
 * the tell of one kind of that narration. A regression test still says what it
 * pins, as the invariant ("the gauge never infers an override"), not as the
 * story of the bug.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSync } from 'oxc-parser'

/** One denied phrase: its id, what it matches, and what to write instead. */
export type HistoryPhrase = { id: string; pattern: RegExp; instead: string }

const HISTORY_PHRASES: readonly HistoryPhrase[] = [
  {
    id: 'issue-number',
    // The word issue, PR or epic before a number, or a bare hash-number. Not a
    // number in code or quotes (a sample), a crawler's name, or one of React's
    // error codes.
    pattern:
      /\b(?:issues?|PRs?|epic)\s+#?[1-9]\d{2,}\b|(?<![\w&/"`[]|(?:Crawler|React|Scrap) )#[1-9]\d{2,3}\b/gi,
    instead: 'say what the code does; the issue is in git history',
  },
  {
    id: 'phase-number',
    pattern: /\bphase \d/gi,
    instead: 'name the step by what it does',
  },
  {
    id: 'used-to',
    // The passive ("is used to scope", a doc comment's capitalised opener) is
    // not history.
    pattern: /(?<!\b(?:be|is|are|been|being)\s|—\s)\bused to\b/g,
    instead: 'state the invariant the old behaviour broke',
  },
  {
    id: 'previously',
    pattern: /\bPreviously\b|\b[Ff]ormerly\b/g,
    instead: 'state what is true now',
  },
]

/** One phrase found in one comment line: the phrase's id, and the words that matched. */
export type HistoryHit = { file: string; line: number; phrase: HistoryPhrase; match: string }

const COMMENT_SOURCE = /\.(?:ts|tsx|js|mjs|mts)$/
const GENERATED = /(?:^|\/)(?:_generated|generated)\/|\.gen\.ts$|\.d\.ts$/

/** A tracked file the check reads: script or module code, not generated output. */
export const isCommentSource = (file: string): boolean =>
  COMMENT_SOURCE.test(file) && !GENERATED.test(file)

/** Every history phrase in `source`'s comments. Pure: the caller reads the file. */
export function historyHits(
  file: string,
  source: string,
  phrases: readonly HistoryPhrase[] = HISTORY_PHRASES
): HistoryHit[] {
  const hits: HistoryHit[] = []
  const lineStarts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (offset: number): number => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((lineStarts[mid] ?? 0) <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  for (const comment of parseSync(file, source).comments) {
    const first = lineOf(comment.start)
    for (const [index, text] of comment.value.split('\n').entries()) {
      for (const phrase of phrases) {
        for (const [match] of text.matchAll(phrase.pattern)) {
          hits.push({ file, line: first + index, phrase, match })
        }
      }
    }
  }
  return hits
}

/** The outcome of one check: `failures` empty means it passed. */
type CheckResult = { ok: string; failures: string[] }

/** floor(0.65 × N) for N = 1,779 tracked source files: a renamed tree fails, growth never. */
const SOURCE_FLOOR = 1_156

/** The code the check reads: tracked source under every workspace and tools/. */
function trackedSource(root: string, env: Record<string, string | undefined>): string[] {
  const out = Bun.spawnSync(['git', 'ls-files', '-z', '--', 'apps', 'packages', 'tools'], {
    cwd: root,
    env,
  })
  if (out.exitCode !== 0) throw new Error(`git ls-files failed: ${out.stderr.toString()}`)
  return out.stdout.toString().split('\0').filter(isCommentSource)
}

/**
 * doc-drift's `history` check: every history phrase in a code comment fails,
 * so each is held at zero. Pass `files` to read a fixture; the default is the
 * repo's tracked source, which must clear `SOURCE_FLOOR`. `env` is the
 * environment `git ls-files` runs in: a test passes one without `GIT_*`, so a
 * hook's `GIT_DIR` cannot point it at the outer repo.
 */
export function checkCommentHistory(
  root: string,
  files?: string[],
  env: Record<string, string | undefined> = process.env
): CheckResult {
  const sources = files ?? trackedSource(root, env)
  const failures = sources.flatMap((file) =>
    historyHits(file, readFileSync(join(root, file), 'utf-8')).map(
      ({ line, phrase, match }) =>
        `${file}:${line} says "${match}" (${phrase.id}), history in a code comment: ${phrase.instead}.`
    )
  )
  if (!files && sources.length < SOURCE_FLOOR) {
    failures.push(
      `history read ${sources.length} source files, under its floor of ${SOURCE_FLOOR}: ` +
        'a scanned directory was renamed or moved. Fix the list in gates/lib/commentHistory.'
    )
  }
  return { ok: `no code comment narrates history (${sources.length} source files)`, failures }
}
