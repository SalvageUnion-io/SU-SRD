/**
 * The guard for `localStorage`: `localStore()` resolves it, or `null`.
 *
 * ## Why a helper rather than the global
 *
 * `localStorage` fails in three unrelated ways, and hand-rolled access tends to
 * guard against one of them:
 *
 *  - **It may not exist.** Anything that runs outside a browser (a Bun test, a
 *    prerender, a worker) has no `localStorage` binding at all. Reaching for a
 *    global that was never declared throws `ReferenceError` — which a bare
 *    `try` around a *later* line does not catch, because the throw happens on
 *    evaluation.
 *  - **It may exist and refuse.** Safari private mode and a full quota both
 *    throw on `setItem`.
 *  - **It may hold nonsense.** The value came from a previous build, another
 *    tab, or the user's own devtools.
 *
 * The guard that holds is the global's evaluation inside the `try`, and
 * `localStore()` is that guard written once. A module that keeps its own small
 * reader (or one for `sessionStorage`) follows the same rule: the global is
 * named only inside its `try`, never hoisted above it.
 *
 * ## Contract
 *
 * Every operation is best-effort and total: no storage reads as `null`, and a
 * caller wraps its own read or write in a `try`. Persistence here is a
 * convenience — a remembered choice — so a failure must degrade the
 * preference, never the app.
 */

/**
 * Resolve the backing store, or `null` when there isn't one.
 *
 * `typeof` rather than a truthiness check on the identifier: only `typeof` is
 * safe against a binding that was never declared. Resolved per call rather than
 * cached at module load, because module evaluation can precede the environment
 * being ready (SSR, a test that installs a stub after import).
 */
export function localStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    // Some embedders throw on the *property access* itself when storage is
    // disabled by policy, rather than leaving it undefined.
    return null
  }
}

/**
 * Deliberately no `readLocal` / `writeLocal` / `removeLocal`, nor the JSON
 * helpers: nothing needs them. Their last caller, the remembered current
 * container, was retired (ADR-052 §3), and the dead-code gate treats an export
 * with no consumer as dead. Add them here — `localStore()` and a `try` round
 * each call — in the change that first needs them, not before.
 */
