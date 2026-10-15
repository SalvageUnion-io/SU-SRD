/**
 * A gate that scans a file tree must prove it actually scanned one.
 *
 * ## Why this exists
 *
 * A gate that walks a directory list and swallows a failed `readdirSync`
 * reports the same success for a scan that matched nothing as for a healthy
 * one, so renaming or moving a scanned directory leaves it green forever,
 * having checked nothing. Neither its output nor its timing tells the two
 * apart.
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
 * The counterpart worth copying is `apps/web/src/lib/__tests__/cn.test.ts`,
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
