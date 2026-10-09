---
name: convex-maintenance
description: Use when rotating ITUN auth secrets (JWT_PRIVATE_KEY/JWKS, AUTH_DISCORD_SECRET), running the dedupeAppIds or repairSoftLinks maintenance repairs, switching a Convex production deployment on, or enabling or re-verifying Convex error reporting to Sentry.
allowed-tools: Bash, Read
---

# Convex Maintenance

Operator procedures for the ITUN Convex deployments. Deployments, required
variables and secrets handling:
[`docs/ARCHITECTURE.md#accounts-and-games-operations`](../../../docs/ARCHITECTURE.md#accounts-and-games-operations).
Setting a deployment up and diagnosing sign-in is the `convex-deploy-verify`
skill.

## Enable Convex error reporting

Every other surface in this repo reports errors through a hand-written
`observability.ts` or `observability/cloudflare` (`apps/srd`, `apps/itun`'s
browser bundle and Worker, `apps/discord-bot`, `apps/su-assets`). **Convex is deliberately not
one of them.** It has a first-party
[Exception Reporting integration](https://docs.convex.dev/production/integrations/exception-reporting)
that is enabled in the Convex dashboard and needs no application code at all.

That is not merely the tidier option — it is the only one that covers the
surface:

- **Queries and mutations cannot report from inside a function.** They run in
  Convex's deterministic runtime, which has no `fetch` and no network egress by
  design. That is most of `convex/` (`games.ts`, `invites.ts`, `proposals.ts`,
  `crew.ts`, `ownership.ts`, …), so a code-level SDK could never see the bulk of
  the errors we would be adding it for.
- **`@sentry/node` does not run there either.** The default Convex runtime is
  not Node; this deployment has no `'use node'` actions, so adding the Node SDK
  would mean converting modules to the Node runtime purely to instrument them.
- **What is left is HTTP actions** (`http.ts`, `botHttp.ts`), where a
  hand-rolled `fetch` to Sentry's ingest endpoint would duplicate a built-in
  that already tags events with function name, function type, runtime, request
  id, deployment name, environment tier, and the caller's `tokenIdentifier` —
  none of which application code can reconstruct.

So the deliverable here is the runbook, not a module.

**Enabling it** (a human has to click this; it cannot be scripted from the
repo):

1. Create a Sentry project in the `susrd` org — **EU region**
   (`https://de.sentry.io`), like every other project here — and set its
   platform to **Node.js**, which is what Convex's integration expects for
   stack-trace processing. Slug: `itun-convex`, sitting alongside `itun`
   (browser) and `itun-functions` (the itun Worker). **This step is done** — the
   project exists (see the registry in
   [`docs/ARCHITECTURE.md#sentry`](../../../docs/ARCHITECTURE.md#sentry)).
   Whether step 2 has been clicked is only visible in the Convex dashboard, so
   check there rather than assuming.
2. Convex dashboard → the deployment → **Settings → Integrations → Sentry** →
   paste that project's DSN, on the production deployment
   `exuberant-porpoise-183`.

**Two caveats worth knowing before you go looking for events:**

- **Exception Reporting is a Convex Pro feature.** On the free plan the Sentry
  card is not available, and the honest state of this repo is then "Convex
  errors are visible in the Convex dashboard's function logs only". Do not
  paper over that with code — see above for why the code would not work.
- Events take a minute or two to propagate, and Convex does not expose the
  Sentry SDK for customisation. There is no release tagging to wire up, so
  Convex errors will not carry a commit SHA the way the browser and Worker
  surfaces do.

**Status: DELIVERING since 2026-08-12**, confirmed end to end — a forced error
was seen in `convex logs` and then in Sentry as `ITUN-CONVEX-1`, the first event
that project had ever received. Step 2 above (pasting the DSN) is what had been
missing; the Pro-plan caveat turned out not to apply.

It forwards `ArgumentValidationError` as well as handler throws, which was an
open question until the probe answered it.

**A reporting integration that reports nothing looks exactly like a healthy one
with no errors.** It once sat half-configured for a week, through 39 failed
mutations in one evening, and the incident arrived as a Discord message from a
player. Nothing can assert it: "zero events" is also what a quiet week looks
like.

**So verify by probe, never by status line.** Force an error, then check both
channels — the deployment log is the ground truth and Sentry is the thing being
tested:

```bash
cd apps/itun
bunx convex run --deployment alex-jarvis:suref-itun:prod \
  maintenance:dedupeAppIds '{"apply":"not-a-boolean"}'      # forces one error
bunx convex logs --deployment alex-jarvis:suref-itun:prod --history 6 --jsonl
```

then <https://susrd.sentry.io/issues/?project=itun-convex>. In the log but not
in Sentry means it has stopped delivering again.

Do not treat a quiet `itun-convex` as evidence that the backend is healthy.

**Events arriving is not the same as anyone reading them.** There is no alert
rule on this project yet, and Sentry's default is to collect silently — which
is how an evening of 39 backend errors reached a player before it reached us.

### What reaches Sentry, and what reaches the player

Convex splits everything `convex/` can throw in two, at the wire, and the split
is not configurable:

| thrown              | the client receives                       | good for                       |
| ------------------- | ----------------------------------------- | ------------------------------ |
| `ConvexError`       | its `data`, intact                        | refusals the rules make        |
| anything else       | `"[CONVEX M(fn)] […] Server Error"`        | defects nobody planned for     |

Both still reach Sentry and the function logs. The difference is entirely about
what a **player** may see, and the repo takes a deliberate position on it:

- **`NotAuthorized` extends `ConvexError`** (`convex/model/permissions.ts`), so
  every authorization message — around thirty-five of them — is copy that
  actually arrives. Until 2026-08-05 it did not: each one was written, thrown,
  and discarded at the boundary, and a player who tried something the rules
  refuse got the same opaque string as a crash.
- **Everything else stays a plain `Error`.** A Zod parse failure or a broken
  invariant is not a message to show anyone; it belongs in the logs.

On the client, `src/lib/connection/serverError.ts` is the only sanctioned way to
ask which one you have (`serverMessage` / `isServerRefusal`). Never string-match
`'Server Error'` at a call site, and never render `String(err)` from a mutation —
that string is the redacted one.

## Repairing duplicated app ids

`convex/maintenance.ts` holds operator-only repairs, reachable through
`bunx convex run` and not from any client: `dedupeAppIds` (below), the
one-off `repairContainers` (see "Running a maintenance function in production"
below), and `repairSoftLinks` (see "Repairing soft links" below). `dedupeAppIds` undoes the damage described under "Claiming
twice" in `convex/claim.ts`: rows sharing an
`appId`, which make `byAppId`'s `.unique()` throw and so break every mirrored
write for that entity, permanently and silently.

```bash
# report only — changes nothing
bunx convex run maintenance:dedupeAppIds --prod
# then, having read the report
bunx convex run maintenance:dedupeAppIds '{"apply": true}' --prod
```

It is an action that walks each table a page at a time along `by_app_id`
(where every copy of an app id sits next to its siblings), one mutation per
page, so it keeps working as the tables grow past what one mutation may read.
A run is therefore not one transaction; it is idempotent, so a failed run is
resumed by running it again.

It keeps one row per app id (an owned row over an unclaimed one, then the most
recently written) and reports how many `changeLog` rows — audit history and
pending Mediator proposals alike — still point at a copy it would delete. Rows
name an entity by its `appId` and follow the survivor; the count is of the
legacy rows written before #1130, which name it by Convex id and do not.

### Running a maintenance function in production

To run a maintenance function in production, dispatch the **Convex
maintenance** workflow (`.github/workflows/convex-maintenance.yml`, `main`
only); it runs the function with the `production` environment's
`CONVEX_DEPLOY_KEY`. From a machine with production access the same thing is:

```bash
cd apps/itun
bunx convex run maintenance:repairContainers --prod
```

## Repairing soft links

[ADR-037](../../../docs/ARCHITECTURE.md#adr-037) gave mechs their own
`mech-to-crawler` link and made the writers keep three invariants (cardinality,
one container, `gameId` = that container). Rows written before it may break all
three, and a mech that reached its bay through its pilot has no direct link.
`repairSoftLinks` fixes both, across every account, **dry run by default**:

```bash
# report only — changes nothing
bunx convex run maintenance:repairSoftLinks --prod
# then, having read the report
bunx convex run maintenance:repairSoftLinks '{"apply": true}' --prod
```

Run it once, right after the deploy that ships `mech-to-crawler`; until it has,
those mechs show undocked. It pages, and is idempotent: a re-run resumes, and an
applied run followed by a dry run reports nothing left (orphaned links — an end
with no row — are only counted, never touched). It is not on the
`convex-maintenance.yml` allowlist, which runs each task with `{}` and so could
only ever dry-run it.

## Switching production on

A build with no `VITE_CONVEX_URL` has no server of record, so every visitor is
anonymous and gets the **in-memory backend** — nothing they build survives the
tab. Since ADR-034/ADR-035 retired the durable anonymous backend there is no
"pre-accounts app" to fall back to: such a build is fine for CI and a fresh
checkout, and is **not** a working production configuration. To switch
accounts on:

1. Add the prod redirect URI to the Discord application (see
   [`docs/ARCHITECTURE.md#discord`](../../../docs/ARCHITECTURE.md#discord)).
   **Done.**
2. Build with `VITE_CONVEX_URL` pointing at the production deployment
   (`https://exuberant-porpoise-183.convex.cloud`). **Done** —
   `.github/workflows/deploy-cloudflare.yml` sets it from the workflow's
   `ITUN_CONVEX_URL`, and its `push-convex` job refuses to push if that is not
   the canonical URL the deploy key resolves to. It is a build-time variable,
   so a change only takes effect on the next deploy.

**There is no rollback by unsetting it.** Doing so would silently turn off
saving for every player: all writes would go to the tab's memory, and the
account data would be unreachable until the variable came back. If Convex has
to be taken out of the path, that is an outage to announce, not a toggle.

## Rotating `JWT_PRIVATE_KEY` / `JWKS`

Rotating the signing keypair **signs every user out**. That is inherent, not a
bug — old sessions were signed by the key you just replaced.

The two must be generated as a pair and written together, in the format
`@convex-dev/auth` expects, or sign-in breaks in the quiet way this document
already warns about:

| Variable          | Format                                            |
| ----------------- | ------------------------------------------------- |
| `JWT_PRIVATE_KEY` | PKCS8 PEM, newlines replaced by **spaces**, trimmed |
| `JWKS`            | `{"keys":[{"use":"sig", …public JWK}]}`            |

**Pipe the value in on stdin; never pass it as an argument.** Two separate
failures make this non-negotiable, both observed:

- the PEM begins `-----BEGIN`, which the CLI parses as **flags** — the command
  simply fails;
- Node's `execFileSync` embeds the whole command line in its **error** message,
  so a failure prints the private key even when stdout and stderr are
  suppressed. Suppressing output is not enough; keep the secret out of `argv`.

```bash
printf '%s' "$PEM" | bunx convex env set JWT_PRIVATE_KEY --deployment-name <name>
```

**Verify against the public endpoint, which needs no secret.** Convex serves the
public half, so the modulus must visibly change:

```bash
curl -s https://<deployment>.convex.site/.well-known/jwks.json
```

Compare `n` before and after. Unchanged means the write did not land and the old
key is still live — which looks identical to success from the CLI's side.

## Rotating `AUTH_DISCORD_SECRET`

Resetting it in the Discord portal invalidates the old value **immediately**, so
Discord sign-in is broken from that moment until Convex is updated. Have the
update command ready first, then reset, copy, and run it back to back.

Clipboard → stdin keeps it out of `argv`, shell history and transcripts:

```bash
pbpaste | tr -d '\n' | bunx convex env set AUTH_DISCORD_SECRET --deployment-name <name>
```

Guard on **length 32** before writing. A Discord client secret is 32 characters;
if the copy silently failed, refusing beats writing garbage into production auth
and rediscovering it later as an unexplained login failure.

Only a real sign-in proves it. Nothing server-side can compare the stored secret
against the one Discord now holds.
