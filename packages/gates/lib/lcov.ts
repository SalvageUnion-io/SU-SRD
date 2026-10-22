/**
 * Bun's lcov, read and merged. Bun writes one record per loaded source file:
 * `SF`, `FNF`/`FNH` (no per-function `FN` lines), a `DA:<line>,<hits>` per
 * reported line, then `LF` (the count of `DA` lines) and `LH` (those with hits).
 *
 * Which lines Bun reports depends on what ran. A function that executed is
 * reported as its code lines, run or not. One that never executed (and is not
 * inside one that did) is reported as a single 0-hit range: comments and blank
 * lines included, its last line left out, sometimes starting on the line its
 * previous sibling ended. So two runs over the same file can disagree on its
 * line set, and neither the union (comments inflate `LF`) nor the intersection
 * (last lines drop out) matches what one run over every test would report.
 * `mergeLcov` resolves each disputed line by the run that executed the most of
 * the functions around it; on the app suite that reproduces a serial run's
 * `DA` lines exactly.
 */

type Lines = Map<number, number>

/** A function's first and last source line, 1-based. */
export type FunctionRange = readonly [start: number, end: number]

type FileRecord = { lines: Lines; fnFound: number; fnHit: number }

/** Each file's `DA` lines (line → hits) and function totals. */
function parseLcov(lcov: string): Map<string, FileRecord> {
  const files = new Map<string, FileRecord>()
  let current: FileRecord | undefined
  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) {
      current = { lines: new Map(), fnFound: 0, fnHit: 0 }
      files.set(line.slice(3), current)
      continue
    }
    if (!current) continue
    if (line.startsWith('DA:')) {
      const [at = 0, hits = 0] = line.slice(3).split(',').map(Number)
      current.lines.set(at, hits)
    } else if (line.startsWith('FNF:')) {
      current.fnFound = Number(line.slice(4))
    } else if (line.startsWith('FNH:')) {
      current.fnHit = Number(line.slice(4))
    } else if (line === 'end_of_record') {
      current = undefined
    }
  }
  return files
}

const sameLines = (a: Lines, b: Lines) =>
  a.size === b.size && [...a.keys()].every((at) => b.has(at))

/** The module body: a run can load a file without evaluating it (a mocked module). */
const MODULE: FunctionRange = [0, Number.POSITIVE_INFINITY]

const span = ([start, end]: FunctionRange) => end - start
const innermost = (ranges: readonly FunctionRange[]) =>
  ranges.reduce<FunctionRange | undefined>(
    (best, range) => (best === undefined || span(range) < span(best) ? range : best),
    undefined
  )

const strictlyInside = ([start, end]: FunctionRange, line: number) => start < line && line < end

/**
 * The function (or the module) a line belongs to: the innermost one it sits
 * strictly inside, unless it also sits on the first or last line of a function
 * nested there, which makes it nobody's own line.
 */
function ownerOf(line: number, functions: readonly FunctionRange[]): FunctionRange | undefined {
  const owner = innermost(functions.filter((range) => strictlyInside(range, line))) ?? MODULE
  const [start, end] = owner
  const onNestedEdge = functions.some(
    (f) => f !== owner && start <= f[0] && f[1] <= end && f[0] <= line && line <= f[1]
  )
  return onNestedEdge ? undefined : owner
}

/**
 * Whether a run executed a function: the first line it reports among the
 * function's own lines has hits. A called function always runs its first
 * statement, whereas an uncalled one's first line is part of its 0-hit range.
 * ("Any hit inside" would not do: Bun's source map can pin a stray
 * module-level hit on a line deep inside a function that never ran.) A
 * function with no own lines reported counts as executed, so the functions
 * nested in it decide.
 *
 * The module is judged at the line in question instead (its nearest own line
 * at or before it), because a run can stop evaluating a module part-way (an
 * import cycle) and report the rest of its body as one 0-hit range.
 */
function executedIn(run: Lines, owners: ReadonlyMap<number, FunctionRange | undefined>) {
  const firstOwn = new Map<FunctionRange, number>()
  const moduleOwn: number[] = []
  for (const line of [...run.keys()].sort((a, b) => a - b)) {
    const owner = owners.get(line)
    if (owner === MODULE) moduleOwn.push(line)
    else if (owner && !firstOwn.has(owner)) firstOwn.set(owner, line)
  }
  return (scope: FunctionRange, at: number): boolean => {
    let judge = firstOwn.get(scope)
    if (scope === MODULE) {
      judge = moduleOwn[0]
      for (const line of moduleOwn) if (line <= at) judge = line
    }
    return judge === undefined || (run.get(judge) ?? 0) > 0
  }
}

/**
 * The lines one run over every test would report for a file the given runs
 * disagree on. A line's form is set by its chain of enclosing functions, module
 * first: the outermost one a run did not execute is what it reports as a 0-hit
 * range. A single run executes every function some run executed, so the runs
 * that executed the line's chain deepest report it as the single run would.
 * Where they tie, a line some of them leave out is a gap between functions
 * that a sibling's 0-hit range spilled into, so it needs all of them or a hit.
 */
function resolveLines(runs: readonly Lines[], functions: readonly FunctionRange[]): number[] {
  const outermostFirst = [MODULE, ...functions].sort((a, b) => span(b) - span(a))
  const candidates = [...new Set(runs.flatMap((run) => [...run.keys()]))]
  const owners = new Map(candidates.map((line) => [line, ownerOf(line, functions)]))
  const executed = runs.map((run) => executedIn(run, owners))
  return candidates.filter((at) => {
    const chain = outermostFirst.filter((range) => strictlyInside(range, at))
    const depths = executed.map((ran) => {
      const unexecuted = chain.findIndex((scope) => !ran(scope, at))
      return unexecuted === -1 ? chain.length : unexecuted
    })
    const deepest = Math.max(...depths)
    const authorities = runs.filter((_, i) => depths[i] === deepest)
    return (
      authorities.every((run) => run.has(at)) || authorities.some((run) => (run.get(at) ?? 0) > 0)
    )
  })
}

/**
 * One lcov from several Bun runs over disjoint test files, giving the same
 * `LF` and `LH` per file as a single run over all of them. Each line keeps the
 * most hits any run recorded. `functionRanges` is consulted only for a file
 * whose runs disagree on its line set. `FNH` takes the largest per-run value,
 * a lower bound (Bun names no functions).
 */
export function mergeLcov(
  reports: readonly string[],
  functionRanges: (path: string) => readonly FunctionRange[]
): string {
  const byFile = new Map<string, FileRecord[]>()
  for (const report of reports) {
    for (const [path, record] of parseLcov(report)) {
      byFile.set(path, [...(byFile.get(path) ?? []), record])
    }
  }
  const out: string[] = []
  for (const path of [...byFile.keys()].sort()) {
    const records = byFile.get(path) ?? []
    const runs = records.map((record) => record.lines)
    const [first = new Map<number, number>()] = runs
    const lines = runs.every((run) => sameLines(run, first))
      ? [...first.keys()]
      : resolveLines(runs, functionRanges(path))
    const das = lines
      .sort((a, b) => a - b)
      .map((at) => [at, Math.max(...runs.map((run) => run.get(at) ?? 0))] as const)
    const fnFound = Math.max(...records.map((record) => record.fnFound))
    const fnHit = Math.max(...records.map((record) => record.fnHit))
    out.push('TN:', `SF:${path}`, `FNF:${fnFound}`, `FNH:${fnHit}`)
    for (const [at, hits] of das) out.push(`DA:${at},${hits}`)
    const hit = das.filter(([, hits]) => hits > 0).length
    out.push(`LF:${das.length}`, `LH:${hit}`, 'end_of_record')
  }
  return `${out.join('\n')}\n`
}
