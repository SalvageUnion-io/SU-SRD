/**
 * A repo-wide gate must prove it looked at every workspace, not just at *a* tree.
 *
 * ## Why this exists, and why `assertScanFloor` is not enough
 *
 * `packages/gates/lib/scanFloor.ts` catches a scanned directory that was RENAMED, MOVED
 * or DELETED — the count collapses and the floor trips. It is structurally
 * blind to the opposite failure: a workspace that was never in the list at all.
 * Adding a workspace only makes the count go UP, so the floor is satisfied
 * while the new surface is silently unguarded. Its own docstring says as much:
 * a catastrophe detector, not a coverage target.
 *
 * ## The contract
 *
 * Every directory under `apps/` and `packages/` that carries a `package.json`
 * must either be covered by the caller's scan set, or appear in `exemptions`
 * WITH A STATED REASON. There is deliberately no third option and no silent
 * default: an unrecognised workspace is a hard failure, so adding a fifth app
 * fails every adopting gate until someone decides, in writing, whether it
 * belongs.
 *
 * An exemption is a decision, not a snooze button. Prefer scanning the
 * workspace — most of these gates cost milliseconds per directory. Reach for an
 * exemption only when the gate genuinely cannot apply (a Worker with no UI has
 * no design tokens to check), and say that in the reason.
 */
/**
 * Every workspace directory under `root`, discovered rather than listed: each
 * `apps/*` and `packages/*` carrying a `package.json`, sorted, then `tools`
 * when `withTools` is set and it has a manifest.
 */
export declare function discoverWorkspaceDirs(root?: string, { withTools }?: {
    withTools?: boolean | undefined;
}): string[];
/**
 * Assert that `scanned` reaches every workspace, or that the gaps are declared.
 *
 * `scanned` holds repo-relative paths — directories or globs, as the calling
 * gate happens to express them. A workspace counts as covered when some entry
 * is that workspace directory or sits beneath it, so `apps/web/src` and
 * `apps/web/src/**\/*.tsx` both cover `apps/web`.
 */
export declare function assertCoversWorkspaces(label: string, scanned: readonly string[], exemptions?: Readonly<Record<string, string>>): void;
