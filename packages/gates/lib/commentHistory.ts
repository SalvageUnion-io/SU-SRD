/**
 * History phrases in code comments: the `history` check of
 * `tools/check-doc-drift.ts`.
 *
 * A comment says what is true of the code beside it and why. The story of how
 * it got that way (the issue that asked for it, the phase that built it, what
 * it did before) lives in git, where `git log -S` and `git blame` find it; in a
 * comment it goes stale while it still reads as current. So does who asked
 * for it, in which design review, on which day, or on which board or screen of
 * a design: the rule it implements has an id to cite instead. Each phrase below
 * is the tell of one kind of that narration. A regression test still says what it
 * pins, as the invariant ("the gauge never infers an override"), not as the
 * story of the bug.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSync } from 'oxc-parser'

/** One denied phrase: its id, what it matches, and what to write instead. */
export type HistoryPhrase = { id: string; pattern: RegExp; instead: string }

/** What a review's provenance gives way to. */
const CITE_THE_RULE = 'cite the rule (R/§/ADR/EDL id) it implements, or say what is true now'

const HISTORY_PHRASES: readonly HistoryPhrase[] = [
  {
    id: 'issue-number',
    // The word issue, PR or epic before a number, a bare hash-number, or one
    // joined to another by a slash. Not a number in code or quotes (a
    // sample), a crawler's name, or one of React's error codes.
    pattern:
      /\b(?:issues?|PRs?|epic)\s+#?[1-9]\d{2,}\b|(?<![\w&/"`[]|(?:Crawler|React|Scrap) )#[1-9]\d{2,3}\b|(?<=#\d+\/)#[1-9]\d{2,3}\b/gi,
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
  {
    id: 'owner-stamp',
    // The owner's word, stamped with a review's number or a date (the tests
    // spell them out). A unit's owner is not one.
    pattern:
      /\bowner(?:['’]s)?(?: (?:calls?|rules?|review|ask|notes?))?[,:]?\s+(?:rounds? \d|20\d\d-\d\d)/gi,
    instead: CITE_THE_RULE,
  },
  {
    id: 'review-round',
    // A design review's numbered pass cited beside a rule, in parentheses or
    // before a colon. A game's round is prose ("the round ends"), never a
    // numbered citation.
    pattern: /\(rounds? \d|\brounds? \d+(?:[–-]\d+)?(?:\)|:|,| review)/gi,
    instead: CITE_THE_RULE,
  },
  {
    id: 'dated-call',
    // A decision's date beside the word for it (a ruling, a call, a choice, a
    // re-baseline), or a date alone in parentheses.
    pattern:
      /\b(?:ruling|rul(?:e|ed)|calls?|chose|decided|review(?:ed)?|re-?baselined|raised)\b[^.\n]{0,24}?\b20\d\d-\d\d-\d\d|\(20\d\d-\d\d-\d\d\)/gi,
    instead: CITE_THE_RULE,
  },
  {
    id: 'board-ref',
    // A board of a design canvas, by its number or its letter and number.
    pattern: /\bboards? (?:\d{2}[a-z]?|[A-Z]{1,2}\d+[a-z]?)\b/gi,
    instead: CITE_THE_RULE,
  },
  {
    id: 'mockup',
    // A design's mock-up, or a numbered screen of one.
    pattern: /\bmockups?\b|\bScreen \d{2}\b/gi,
    instead: CITE_THE_RULE,
  },
]

/** One phrase found in one comment line: the phrase's id, and the words that matched. */
export type HistoryHit = { file: string; line: number; phrase: HistoryPhrase; match: string }

const COMMENT_SOURCE = /\.(?:ts|tsx|js|mjs|mts|css)$/
const GENERATED = /(?:^|\/)(?:_generated|generated)\/|\.gen\.ts$|\.d\.ts$/

/** A tracked file the check reads: script, module or stylesheet code, not generated output. */
export const isCommentSource = (file: string): boolean =>
  COMMENT_SOURCE.test(file) && !GENERATED.test(file)

/** A stylesheet's comment: CSS has block comments only. */
const CSS_COMMENT = /\/\*([\s\S]*?)\*\//g

type Comment = { type: 'Line' | 'Block'; value: string; start: number }

/** Each comment's kind, text and offset: a stylesheet's block comments, or the parser's. */
function commentsOf(file: string, source: string): Comment[] {
  if (file.endsWith('.css')) {
    return [...source.matchAll(CSS_COMMENT)].map((m) => ({
      type: 'Block',
      value: m[1] ?? '',
      start: m.index,
    }))
  }
  return parseSync(file, source).comments
}

/** One line of comment prose, its leading space and `*` gone, and the line it is on. */
type ProseLine = { text: string; line: number }

/**
 * The comments as runs of prose: a block comment's lines, or a run of line
 * comments on consecutive lines. A phrase wrapped across two lines is one
 * phrase.
 */
function proseRuns(comments: Comment[], lineOf: (offset: number) => number): ProseLine[][] {
  const runs: ProseLine[][] = []
  let last: { type: Comment['type']; line: number } | undefined
  for (const comment of comments) {
    const first = lineOf(comment.start)
    const lines = comment.value
      .split('\n')
      .map((text, index) => ({ text: text.replace(/^\s*\*?\s*/, ''), line: first + index }))
    const run = runs.at(-1)
    if (comment.type === 'Line' && last?.type === 'Line' && last.line === first - 1 && run) {
      run.push(...lines)
    } else {
      runs.push(lines)
    }
    last = { type: comment.type, line: first + lines.length - 1 }
  }
  return runs
}

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
  for (const run of proseRuns(commentsOf(file, source), lineOf)) {
    const starts: number[] = []
    let joined = ''
    for (const { text } of run) {
      starts.push(joined.length)
      joined += `${text} `
    }
    const lineAt = (index: number): number => {
      let i = starts.length - 1
      while (i > 0 && (starts[i] ?? 0) > index) i--
      return run[i]?.line ?? 0
    }
    for (const phrase of phrases) {
      for (const found of joined.matchAll(phrase.pattern)) {
        hits.push({ file, line: lineAt(found.index), phrase, match: found[0].trim() })
      }
    }
  }
  // By line, then by phrase: the order a reader meets them.
  return hits.sort((a, b) => a.line - b.line)
}

/** The outcome of one check: `failures` empty means it passed. */
type CheckResult = { ok: string; failures: string[] }

/** floor(0.65 × N) for N = 2,047 tracked source files: a renamed tree fails, growth never. */
const SOURCE_FLOOR = 1_330

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
