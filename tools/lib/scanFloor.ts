/**
 * A gate that scans a file tree must prove it actually scanned one.
 *
 * ## Why this exists
 *
 * Three gates in `validate:all` — `check-architecture`, `check-design-tokens`
 * and `check-styling-ownership` — walk a hardcoded set of directories, count
 * violations, and exit 0 when the count is not worse than a committed baseline.
 * All three baselines are currently all-zero, and every one of their `walk()`
 * helpers swallows a failed `readdirSync` and returns `[]`. So a scan that
 * matched NOTHING produced byte-identical output to a healthy run:
 *
 *     ✓ design tokens: no new violations (0 known, burning down)
 *
 * Rename or move a scanned directory and the gate keeps reporting success
 * forever, having checked nothing. There was no timing tell either — in CI the
 * token check runs in 0s and the styling check in 1s, so "checked 998 files"
 * and "found no files" are indistinguishable from the outside.
 *
 * `check-architecture` even printed the file count in its success message
 * (`✓ ... (584 files checked)`) — but printed is not asserted, and nothing ever
 * read it.
 *
 * ## What a floor is and is not
 *
 * The floor is a **catastrophe detector**, not a coverage target. It answers
 * one question: did this gate look at roughly the tree it was written for? Set
 * it well below today's count (~65%) so ordinary growth, refactors and file
 * deletions never trip it, and only a structural break — a renamed directory, a
 * moved workspace, a bad glob — does.
 *
 * Do NOT ratchet these upward as the repo grows. A floor that tracks the real
 * count closely becomes a second baseline to maintain, and the failure it
 * exists to catch is order-of-magnitude, not incremental.
 *
 * The counterpart worth copying is `packages/component-lib/src/utils/__tests__/cn.test.ts`,
 * which parses `theme.css` and asserts the file was actually read
 * (`expect(themeCss).toContain('@utility')`) before making any claim about its
 * contents. Same idea, applied to a file tree instead of a file.
 */
export function assertScanFloor(label: string, scanned: number, floor: number): void {
  if (scanned >= floor) return

  console.error(`\n✗ ${label}: scanned ${scanned} files, expected at least ${floor}.\n`)
  console.error(
    '  This gate did not look at the tree it was written for, so its "no violations"\n' +
      '  result would have been meaningless. Almost always this means a scanned\n' +
      '  directory was renamed, moved between workspaces, or deleted — check the\n' +
      "  gate's directory list against the current tree.\n\n" +
      '  If the drop is legitimate (a workspace really did shrink), lower the floor\n' +
      '  in the same commit that shrinks it, and say why in the message.'
  )
  process.exit(1)
}
