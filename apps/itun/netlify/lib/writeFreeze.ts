/**
 * The snapshot write freeze (ADR-033 P6).
 *
 * ## Why a freeze exists at all
 *
 * The migration copies the `snapshots` Blobs store into R2 while writes are
 * still live, then runs a delta pass that must reconcile to **zero**. That
 * second pass can only mean anything if nothing is still writing to Netlify —
 * so the freeze is what makes "zero" a proof rather than a coincidence.
 *
 * Both write verbs are frozen, and the DELETE case is the one that matters
 * most:
 *
 * - a **publish** that lands on Netlify after the final sync never reaches R2,
 *   so its share link 404s from the moment the flip completes;
 * - a **revoke** that lands on Netlify after the final sync removes the object
 *   from Blobs but leaves the copy in R2 — so a snapshot the owner deliberately
 *   revoked stays readable at its original URL.
 *
 * The second is a privacy failure and is strictly worse than the first, which
 * is why freezing DELETE is not an afterthought.
 *
 * ## Why it freezes every method, not just POST and DELETE
 *
 * `probeSnapshotService` in `src/lib/snapshot/client.ts` feature-detects the
 * backend with `HEAD /api/snapshots` and treats **only** 405 or 204 as
 * available. Freezing HEAD too therefore makes the client hide the share
 * affordance entirely, which is a better outcome than leaving a button that
 * fails once pressed: the user never acts on a control that cannot work.
 *
 * Reads are deliberately untouched — `snapshot-retrieve` is a separate function
 * and is never frozen, so every existing share link keeps resolving throughout
 * the window. The freeze stops the store from *changing*, not from serving.
 *
 * ## Lifetime
 *
 * Temporary by construction: this lives in the Netlify adapter layer rather
 * than in the shared handlers, so P8 deletes this file and two one-line calls
 * and nothing else. The Workers side has no freeze — it is the destination.
 */

/** Set to `1` / `true` on the Netlify site to freeze snapshot writes. */
export const FREEZE_ENV = 'SNAPSHOT_WRITES_FROZEN'

/**
 * Read per-call rather than at module scope.
 *
 * `apps/discord-bot/src/config.ts` is the cautionary example this repo already
 * carries: a module-scope `process.env` read is captured once at import, which
 * makes the value impossible to vary per test and, on a warm serverless
 * instance, pins it for the life of the container. The freeze must be able to
 * be lifted by changing the variable and redeploying, so it is read on every
 * request.
 */
function frozen(): boolean {
  const raw = process.env[FREEZE_ENV]?.trim().toLowerCase()
  return raw === '1' || raw === 'true'
}

/**
 * The 503 served while writes are frozen, or `null` when they are not.
 *
 * 503 rather than 403 or 410: this is explicitly temporary, and the other two
 * would tell a client — and a crawler — that the endpoint is permanently gone.
 * `Retry-After` carries the same message in a form software reads.
 *
 * `Cache-Control: no-store` is load-bearing, not hygiene. A cached 503 outlives
 * the freeze it describes, and the whole point of the window is that it ends;
 * a CDN or browser holding this response would keep sharing broken after
 * writes resumed, with nothing left to point at as the cause.
 */
export function writeFreezeResponse(): Response | null {
  if (!frozen()) return null
  return Response.json(
    {
      error: 'snapshot_writes_frozen',
      message:
        'Sharing is briefly paused while snapshots move to their new home. Existing share links keep working.',
    },
    {
      status: 503,
      headers: {
        'retry-after': '3600',
        'cache-control': 'no-store',
      },
    }
  )
}
