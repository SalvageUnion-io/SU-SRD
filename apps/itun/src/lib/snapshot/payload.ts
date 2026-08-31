/**
 * What a snapshot publish request is allowed to contain.
 *
 * ## The gap this closes
 *
 * Publish accepted any non-array JSON object under the size cap. `{}` minted a
 * real id and a real share URL, and the failure only surfaced when somebody
 * opened the link and got "Could not render snapshot". So the store could hold
 * objects that were never renderable, and the person who shared the link found
 * out from their reader.
 *
 * The invariant this establishes is the one worth stating plainly:
 *
 * > **A snapshot that cannot be rendered cannot be published.**
 *
 * ## Why it reuses the renderer's own parse
 *
 * The check is `parseFrozenEntity` — the *same* function `/s/$id` runs on the
 * way out (`lib/schemas/frozenEntity.ts`). A second, looser server-side notion
 * of validity would drift from the renderer's, and the drift would be invisible
 * until it produced exactly the class of snapshot this is meant to stop. One
 * parse, two call sites, no daylight between them.
 *
 * That includes the legacy normalisers (`normalizeLegacyPilotRecord`,
 * `normalizeLegacyCargoRecord`): publish accepts precisely what render accepts,
 * including the older record shapes, rather than a stricter subset that would
 * refuse a build the app is perfectly able to display.
 *
 * ## Cost, measured on the real Worker
 *
 * The schemas pull in `salvageunion-reference/lib/zod` only — no game dataset,
 * checked by grepping the bundle rather than assumed. `wrangler deploy
 * --dry-run` on the itun Worker before and after:
 *
 * | | Uncompressed | Gzipped |
 * | --- | --- | --- |
 * | before | 10.08 KiB | 3.09 KiB |
 * | after (at the time) | 601.56 KiB | 94.10 KiB |
 * | **the whole Worker today** | **3,619 KiB** | **1,185 KiB** |
 *
 * Against Cloudflare's **3 MB compressed** limit that is ~39% of the ceiling.
 *
 * The last row is the one to read, and the reason it was added: the "after"
 * figure describes the Worker as it stood when this was written, and by the
 * time anyone came to check it it was low by roughly 11x — the og:image
 * renderer's resvg wasm alone is 2.5 MB. A stale measurement in a budget note
 * is worse than none, because it is consulted instead of taken. Re-measure with
 * `wrangler deploy --dry-run` rather than trusting any row here.
 *
 * (An isolated bundle of the three schemas measured 63 KiB gzipped; the
 * in-Worker figure is the one to trust, and is why this table records a
 * measurement rather than that estimate.)
 *
 * The other budget is the 1 s startup limit, which Cloudflare enforces at
 * deploy time: these schemas are constructed at module scope, so a regression
 * there fails the deploy rather than a request.
 *
 * ## Unknown top-level keys are ALLOWED, deliberately
 *
 * `context` was added to the v1 `{ kind, entity }` shape additively, and the
 * reader treats an absent one as "no contributions" rather than an error. A
 * strict-key policy here would invert that: the next additive field would be
 * refused by whatever Worker version is already deployed. Known keys are
 * validated strictly; unknown ones ride along inside the 256 KB cap that
 * already bounds what a caller can store.
 */

import { parseFrozenEntity } from '../schemas/frozenEntity'

/** Accepted, or the reason it was refused — phrased for a client developer. */
export type PayloadCheck = { ok: true } | { ok: false; reason: string }

/**
 * `context.pilotAbilities` carries the ability refs of the pilot a mech was
 * published with, because a live mech's maxima depend on its pilot (ADR-029).
 * Optional on every kind and absent on every pre-`context` snapshot, so a
 * missing one is accepted — an ill-formed one is not, since it would silently
 * change the numbers a reader sees.
 */
function checkContext(context: unknown): PayloadCheck {
  if (context === undefined) return { ok: true }
  if (typeof context !== 'object' || context === null || Array.isArray(context)) {
    return { ok: false, reason: 'context must be a JSON object when present.' }
  }

  const refs = (context as Record<string, unknown>).pilotAbilities
  if (refs === undefined) return { ok: true }
  if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== 'string')) {
    return { ok: false, reason: 'context.pilotAbilities must be an array of strings.' }
  }
  return { ok: true }
}

/**
 * Validate a publish request body.
 *
 * Returns a reason on rejection rather than a bare boolean, and the handler
 * sends it back on the 400. The reasons are safe to expose: they describe this
 * app's own public payload contract and the game-data schema behind it, which
 * ships in the client bundle and is already shown to any viewer by the
 * snapshot error state. There is no account, session or storage detail to leak.
 */
export function validateSnapshotPayload(payload: unknown): PayloadCheck {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'Payload must be a JSON object.' }
  }

  const body = payload as Record<string, unknown>

  const context = checkContext(body.context)
  if (!context.ok) return context

  // parseFrozenEntity owns both halves — the kind must be one it knows, and the
  // entity must satisfy that kind's schema. Its reasons are already written for
  // a human reading a failure, so they pass straight through.
  const parsed = parseFrozenEntity(body.kind, body.entity)
  if (!parsed.ok) return { ok: false, reason: parsed.reason }

  return { ok: true }
}
