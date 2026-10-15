---
name: convex-ops
description: Use when setting up or checking a Cantina Convex deployment, when Discord sign-in fails with a 500 or "deployment unreachable", when the bot replies "The Cantina is not configured for this bot", answers `unavailable` or `unauthorized`, or its `/health` returns 503, when a Convex tool says "No CONVEX_DEPLOYMENT set", when rotating JWT_PRIVATE_KEY/JWKS or AUTH_DISCORD_SECRET, when running a one-off data repair, or when enabling or re-verifying Convex error reporting (the log stream into Workers Issues).
allowed-tools: Bash, Read
---

# Convex operations

Every failure on this path is **silent, and misattributes**. A missing
`SITE_URL` reports a 500 that looks like a server fault; a `.convex.cloud` where
`.convex.site` belongs reports "deployment unreachable", which points at the
network rather than at the typo. The commands are trivial; the traps are not.

The deployments: [Convex deployments](../../../docs/ARCHITECTURE.md#deployments);
the variables: [Convex environment](../../../docs/ARCHITECTURE.md#convex-env).
This skill is the procedures.

## Before anything: which deployment?

Production is `exuberant-porpoise-183` (`--prod`, or `--deployment
alex-jarvis:susrd:prod`). Staging is the cloud dev deployment
`perfect-donkey-72` (`--deployment perfect-donkey-72`), the Worker
Previews' backend: only `deploy-preview.yml` pushes to it, never `dev:cantina`.
Without either flag, `bunx convex` targets the **local** deployment `bun run
dev:cantina` runs. Confirm which one you mean before running anything, and say so in your
report.

## Local backend

`bun run dev:cantina` runs `convex dev --start vite` on a local deployment: it
pushes `convex/` on every save and writes `CONVEX_DEPLOYMENT`,
`VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` into `apps/cantina/.env.local`. It
signs in through the test seam, not Discord: the `dev` script sets
`VITE_TEST_AUTH=true`, and the deployment needs `CANTINA_TEST_AUTH`. Production
has neither. It refuses to start on a cloud `CONVEX_DEPLOYMENT`
(`scripts/assert-local-convex.ts`): `.worktreeinclude` copies `.env.local` into
every worktree, so a cloud dev deployment is one backend that every worktree's
pushes overwrite. One-time setup, from `apps/cantina`:

```bash
# Pick a local deployment. Not signed in to Convex: run `bun run dev:cantina` and
# choose "Start without an account (run Convex locally)". Signed in, or with a
# .env.local that names a cloud deployment:
bunx convex dev --configure existing --team alex-jarvis --project susrd \
  --dev-deployment local --once

# Then, with `bun run dev:cantina` running, in a second terminal:
bunx @convex-dev/auth --web-server-url http://localhost:5173/build   # SITE_URL + JWT keys
bunx convex env set CANTINA_TEST_AUTH true
```

To sign in, run `await __cantinaTestSignIn('<any email>', '<8+ char password>')`
in the browser console on `http://localhost:5173/build/`. Each call signs up a new
password account (a repeated email is refused), and the session survives
reloads. `bun run e2e:cantina` starts `dev:cantina` itself (or reuses a running one),
so its signed-in specs fail until this setup is done.

## Secrets never touch argv or stdout

- **Pipe a secret in on stdin; never pass it as an argument.** A PEM begins
  `-----BEGIN`, which the CLI parses as flags; and Node's `execFileSync` embeds
  the whole command line in its error message, so a failure prints the secret
  even with output suppressed.
- **Check presence by length, never by exit code.** `bunx convex env get`
  exits 0 for a variable that does not exist and prints in the clear:

  ```bash
  bunx convex env get AUTH_DISCORD_SECRET | tr -d '[:space:]' | wc -c
  ```

  A plausible length means present; `0` means absent.

## 1. Set the sign-in variables

```bash
bunx convex env set --prod AUTH_DISCORD_ID <client-id>
bunx convex env set --prod SITE_URL        https://salvageunion.io/build
```

`AUTH_DISCORD_SECRET` and the `JWT_PRIVATE_KEY` / `JWKS` pair go in on stdin,
as in the rotation sections below. `SITE_URL` is the **frontend** address,
base included (`https://salvageunion.io/build`, ADR-048), not
`VITE_CONVEX_SITE_URL` and not the `.convex.site` host; every production
deploy of cantina sets it (`deploy-cloudflare.yml`), so set it by hand only on a
new deployment. Without the JWT pair, sign-in
fails only after Discord redirects back, which the probe in step 3 never
reaches, so check both by length.

## 2. Wire the Discord bot

Generate a long random `CANTINA_BOT_SECRET` into 1Password first; both sides take
that one value on stdin.

```bash
# Convex: enables /bot/*. Unset, no bot can talk to the deployment at all.
op read 'op://<vault>/<item>/credential' | bunx convex env set --prod CANTINA_BOT_SECRET

# The bot Worker: both required; its /health answers 503 until they are set.
cd apps/discord-bot
bunx wrangler secret put CANTINA_CONVEX_SITE_URL   # https://<deployment>.convex.site
op read 'op://<vault>/<item>/credential' | bunx wrangler secret put CANTINA_BOT_SECRET
```

`CANTINA_CONVEX_SITE_URL` is the HTTP-actions origin (`.convex.site`), not the
client URL (`.convex.cloud`) and not the web origin.

## 3. Verify sign-in without signing in

```bash
curl -s -D - -o /dev/null https://<deployment>.convex.site/api/auth/callback/discord | grep -i location
curl -s -D - -o /dev/null https://<deployment>.convex.site/api/auth/callback/bogusprovider
```

| Discord callback                       | Means                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| **302** → your `SITE_URL`              | Correctly configured.                                      |
| **500** `Missing environment variable` | `SITE_URL` unset.                                          |
| **404**                                | Auth routes not mounted: check `convex/http.ts` deployed.  |

The bogus-provider control must return **500**. Without it, a router that
answers everything looks identical to one correctly configured for Discord.

## Rotating `JWT_PRIVATE_KEY` / `JWKS`

Rotating the pair **signs every user out**; old sessions were signed by the key
you replaced. Generate both together: `bunx @convex-dev/auth`, with the
deployment's flag, generates a matching RS256 pair and writes both (it asks
before overwriting). A pair made elsewhere goes in on stdin, both halves:

```bash
printf '%s' "$PEM" | bunx convex env set JWT_PRIVATE_KEY --deployment-name <name>
printf '%s' "$JWKS" | bunx convex env set JWKS --deployment-name <name>
```

Verify against the public endpoint, which needs no secret: the modulus `n` must
change. Unchanged means the write did not land and the old key is still live,
which looks identical to success from the CLI.

```bash
curl -s https://<deployment>.convex.site/.well-known/jwks.json
```

## Rotating `AUTH_DISCORD_SECRET`

Resetting it in the Discord portal invalidates the old value **immediately**, so
sign-in is broken until Convex is updated. Have the command ready, then reset,
copy, and run it back to back:

```bash
pbpaste | tr -d '\n' | bunx convex env set AUTH_DISCORD_SECRET --deployment-name <name>
```

Guard on **length 32** before writing: if the copy silently failed, refusing
beats writing garbage into production auth. Only a real sign-in proves it.

## Convex error reporting

Convex reports through a **log stream**: Convex dashboard → the production
deployment → **Settings → Integrations → Log Streams → Webhook**, URL
`https://salvageunion.io/build/__convex-logs`. The Cantina Worker verifies each
delivery's `x-webhook-signature` against `CONVEX_LOG_STREAM_SECRET` (copy the
secret the dashboard shows into `wrangler secret put CONVEX_LOG_STREAM_SECRET`
in `apps/cantina`) and logs every failed function and every `console.error` for
Workers Issues (`packages/observability/src/cloudflare.ts`). There is no code
to add in `convex/`: queries and mutations have no network egress. Log streams
need the Convex Pro plan.

**A reporting integration that reports nothing looks exactly like a healthy one
with no errors.** Verify by probe, never by status line: force an error, then
check the deployment log (ground truth) and Workers Issues (the thing being
tested).

```bash
cd apps/cantina
bunx convex run --deployment alex-jarvis:susrd:prod \
  botClient:me '{"discordId":0}'      # forces one ArgumentValidationError
bunx convex logs --deployment alex-jarvis:susrd:prod --history 6 --jsonl
```

then the su-cantina Worker's **Issues** tab in the Cloudflare dashboard, for a
`ConvexFunctionError` naming `botClient:me`. In the log but not in Issues means
the stream has stopped delivering: a `401` in the su-cantina Worker's logs is a
secret mismatch, a `503` an unset secret.

## Running a one-off data repair

A repair is not kept in the repo. Write it as an `internalMutation` (or an
`internalAction` driving one mutation per page, once a table outgrows a single
mutation's read limit) that reports what it would change unless passed
`{ "apply": true }`. Ship it, run it from the Convex dashboard's function
runner on production, dry run first, and apply only on a non-zero count.
Record the counts in the PR that deletes it.

## There is no rollback by unsetting `VITE_CONVEX_URL`

Production builds with `VITE_CONVEX_URL` from `CANTINA_CONVEX_URL` in
`.github/workflows/deploy-cloudflare.yml`, whose `push-convex` job refuses to
push if it differs from the URL the deploy key resolves to; a change takes
effect on the next deploy. Unset, the cantina build fails (`requireConvexUrl` in
`apps/cantina/vite.config.ts`), and with it the deploy: there is no build without
a deployment, so taking Convex out of the path is an outage, not a toggle.

## Report

State which deployment you touched, which variables you set (**names only,
never values**), and the literal status each probe returned, including the
bogus-provider control. "Sign-in works" without the probe output is not a
verification.
