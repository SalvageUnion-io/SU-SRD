---
name: convex-ops
description: Use when setting up or checking the app's Convex deployment, when Discord sign-in fails or answers 503, when the bot replies "salvageunion.io is not configured for this bot", answers `unavailable` or `unauthorized`, or its `/health` returns 503, when a Convex tool says "No CONVEX_DEPLOYMENT set", when rotating the sign-in key or DISCORD_CLIENT_SECRET, when running a one-off data repair, or when enabling or re-verifying Convex error reporting (the log stream into Workers Issues).
allowed-tools: Bash, Read
---

# Convex operations

Every failure on this path is **silent, and misattributes**. A sign-in key
whose public half Convex does not hold signs the player in on the Worker and
leaves every Convex call signed out; a `.convex.cloud` where `.convex.site`
belongs reports "deployment unreachable", which points at the network rather
than at the typo. The commands are trivial; the traps are not.

The deployments: [Convex deployments](../../../docs/ARCHITECTURE.md#deployments);
the variables: [Convex environment](../../../docs/ARCHITECTURE.md#convex-env).
This skill is the procedures.

## Before anything: which deployment?

Production is `exuberant-porpoise-183` (`--prod`, or `--deployment
alex-jarvis:susrd:prod`). Staging is the cloud dev deployment
`perfect-donkey-72` (`--deployment perfect-donkey-72`), the Worker
Previews' backend: only `deploy-preview.yml` pushes to it, never `bun run dev`.
Without either flag, `bunx convex` targets the **local** deployment `bun run
dev` runs. Confirm which one you mean before running anything, and say so in your
report.

## Local backend

`bun run dev` runs `convex dev` beside the dev server on a local deployment: it
pushes `convex/` on every save and writes `CONVEX_DEPLOYMENT`,
`VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` into `apps/web/.env.local`. It
signs in through the test seam, not Discord: the `dev` script sets
`VITE_TEST_AUTH=true`, which the dev server's sign-in (`astro/build/devAuth.ts`) reads
too, and the deployment needs `TEST_AUTH`. Production has neither. It refuses to start on a cloud `CONVEX_DEPLOYMENT`
(`scripts/assert-local-convex.ts`): `.worktreeinclude` copies `.env.local` into
every worktree, so a cloud dev deployment is one backend that every worktree's
pushes overwrite. One-time setup, from `apps/web`:

```bash
# Pick a local deployment. Not signed in to Convex: run `bun run dev` and
# choose "Start without an account (run Convex locally)". Signed in, or with a
# .env.local that names a cloud deployment:
bunx convex dev --configure existing --team alex-jarvis --project susrd \
  --dev-deployment local --once

# Then, with `bun run dev` running, in a second terminal: the dev server
# prints the AUTH_JWKS command on its first start (its key is
# apps/web/.wrangler/dev-auth-key.json).
bunx convex env set AUTH_JWKS "$(bun scripts/authKeys.ts .wrangler/dev-auth-key.json)"
bunx convex env set TEST_AUTH true
```

To sign in, run `await __appTestSignIn('<any email>', '<8+ char password>')`
in the browser console on `http://localhost:4321/build/`. Each call signs up a new
password account (a repeated email is refused), and the session survives
reloads. `bun run e2e` starts `bun run dev` itself (or reuses a running one),
so its signed-in specs fail until this setup is done.

## Agent backend

An agent (a cloud container, a Remote Control sandbox) has no Convex login, so
`bun run dev` cannot start. `bun run dev:backend` (`tools/dev-backend.ts`) needs
none: it runs CI's pinned self-hosted backend on 3310/3311 (state in the
gitignored `.dev-backend/`), sets the auth env, pushes `convex/`, serves the
site on the checkout's port with the test seam, and on first start seeds
`agent@example.com` (Bonesaw, the Mazona, Tenacity, the Game "The Long Haul")
into `.dev-backend/seed.json`. Run it in the background. It never reads
`.env.local` and leaves `bun run dev`'s deployment alone, but its dev server
takes the checkout's port, so stop a `bun run dev` there (or use a worktree).

```bash
bun run dev:backend &                       # rerun to push a convex/ edit; --fresh wipes the data
bun run shot :game --signed-in --width phone # also :pilot, :mech, :crawler, app:/route
```

In a browser: `await __appTestSignIn('agent@example.com', 'agent-dev-pass-1', 'signIn')`.

## Secrets never touch argv or stdout

- **Pipe a secret in on stdin; never pass it as an argument.** Node's `execFileSync` embeds
  the whole command line in its error message, so a failure prints the secret
  even with output suppressed.
- **Check presence by length, never by exit code.** `bunx convex env get`
  exits 0 for a variable that does not exist and prints in the clear:

  ```bash
  bunx convex env get BOT_SECRET | tr -d '[:space:]' | wc -c
  ```

  A plausible length means present; `0` means absent.

## 1. Set up sign-in

Sign-in runs on the su-srd Worker (`apps/web/src/worker/auth/`): Discord OAuth,
accounts and sessions in D1 (`SHARED`: `su-shared`; Previews `su-shared-preview`), and
a ten-minute ES256 token Convex accepts as a custom JWT provider
(`convex/auth.config.ts`). Three Worker secrets and one Convex variable, from
`apps/web`. Previews take theirs from the Preview base config (`wrangler
preview base-config secret put`) and staging's `AUTH_JWKS` (`--deployment
perfect-donkey-72`): a Preview's own secrets (`wrangler preview secret put`)
are replaced by its next ship, so they last only until the next push.

```bash
bunx wrangler secret put DISCORD_CLIENT_ID       # op://SUSRD/discord-bot,
bunx wrangler secret put DISCORD_CLIENT_SECRET   # the OAuth client, on stdin
umask 077; bun scripts/authKeys.ts key.json > jwks.txt   # a fresh pair
bunx wrangler secret put AUTH_SIGNING_KEY < key.json
bunx convex env set --prod AUTH_JWKS "$(cat jwks.txt)"
rm key.json jwks.txt
```

The Discord application lists `<origin>/auth/callback` as a redirect for
every origin that signs in. A Preview with `AUTH_CALLBACK_ORIGIN` in its vars
(`wrangler.jsonc`'s `previews`) comes back through that origin's callback,
which hands the code to `pr-<n>-su-srd.alxjrvs.workers.dev`, so Discord lists
production's alone. Without the Discord pair `/auth/sign-in` answers 503.

## 2. Wire the Discord bot

Generate a long random `BOT_SECRET` into 1Password first; both sides take
that one value on stdin.

```bash
# Convex: enables /bot/*. Unset, no bot can talk to the deployment at all.
op read 'op://<vault>/<item>/credential' | bunx convex env set --prod BOT_SECRET
# Convex: where Play's rolls are posted from (the bot Worker's origin, which
# serves /relay/post-roll). Not a secret. Unset, every postRoll to a bound
# channel answers `failed` and logs it; nothing posts.
bunx convex env set --prod BOT_URL https://su-discord-bot.<subdomain>.workers.dev

# The bot Worker: both required; its /health answers 503 until they are set.
cd apps/discord-bot
bunx wrangler secret put BACKEND_SITE_URL   # https://<deployment>.convex.site
op read 'op://<vault>/<item>/credential' | bunx wrangler secret put BOT_SECRET
```

`BACKEND_SITE_URL` is the HTTP-actions origin (`.convex.site`), not the
client URL (`.convex.cloud`) and not the web origin.

The secret works in both directions: the bot presents it to Convex's `/bot/*`,
and Convex presents it to the Worker's `/relay/post-roll` when a roll posts to
a channel bound with `/su bind`. The Worker posts with its own `DISCORD_TOKEN`,
so Convex holds no Discord token. A post that fails says why in Play's Feed.

## 3. Verify sign-in without signing in

```bash
curl -s -D - -o /dev/null https://salvageunion.io/auth/sign-in | grep -iE '^(HTTP|location)'
curl -s -o /dev/null -w '%{http_code}\n' https://salvageunion.io/auth/token
```

A **302** to `discord.com/oauth2/authorize` with this origin's
`/auth/callback` means the Discord pair is set; **503** means it is not. The
token endpoint answers **401** signed out. Only a real sign-in proves the
`AUTH_JWKS` half: after it, `account:me` must answer the player, not `null`.

## Rotating the sign-in key

The key signs only ten-minute tokens, so rotating it signs nobody out of the
Worker: set the new `AUTH_SIGNING_KEY` and the new `AUTH_JWKS` (step 1) back
to back, and Convex refuses tokens for at most ten minutes in between.

## Rotating `DISCORD_CLIENT_SECRET`

Resetting it in the Discord portal invalidates the old value **immediately**, so
sign-in is broken until the Worker is updated. Have the command ready, then
reset, copy, and run it back to back:

```bash
pbpaste | tr -d '\n' | bunx wrangler secret put DISCORD_CLIENT_SECRET
```

Guard on **length 32** before writing: if the copy silently failed, refusing
beats writing garbage into production auth. Only a real sign-in proves it.

## Convex error reporting

Convex reports through a **log stream**: Convex dashboard → the production
deployment → **Settings → Integrations → Log Streams → Webhook**, URL
`https://salvageunion.io/__convex-logs`. The su-srd Worker verifies each
delivery's `x-webhook-signature` against `CONVEX_LOG_STREAM_SECRET` (copy the
secret the dashboard shows into `wrangler secret put CONVEX_LOG_STREAM_SECRET`
in `apps/web`) and logs every failed function and every `console.error` for
Workers Issues (`apps/web/src/worker/errorReports.ts`). There is no code
to add in `convex/`: queries and mutations have no network egress. Log streams
need the Convex Pro plan.

**A reporting integration that reports nothing looks exactly like a healthy one
with no errors.** Verify by probe, never by status line: force an error, then
check the deployment log (ground truth) and Workers Issues (the thing being
tested).

```bash
cd apps/web
bunx convex run --deployment alex-jarvis:susrd:prod \
  botClient:me '{"discordId":0}'      # forces one ArgumentValidationError
bunx convex logs --deployment alex-jarvis:susrd:prod --history 6 --jsonl
```

then the su-srd Worker's **Issues** tab in the Cloudflare dashboard, for a
`ConvexFunctionError` naming `botClient:me`. In the log but not in Issues means
the stream has stopped delivering: a `401` in the su-srd Worker's logs is a
secret mismatch, a `503` an unset secret.

## Running a one-off data repair

A repair is not kept in the repo. Write it as an `internalMutation` (or an
`internalAction` driving one mutation per page, once a table outgrows a single
mutation's read limit) that reports what it would change unless passed
`{ "apply": true }`. Ship it, run it from the Convex dashboard's function
runner on production, dry run first, and apply only on a non-zero count.
Record the counts in the PR that deletes it.

## There is no rollback by unsetting `VITE_CONVEX_URL`

Production builds with `VITE_CONVEX_URL` from `PRODUCTION_CONVEX_URL` in
`.github/workflows/deploy-cloudflare.yml`, whose `push-convex` job refuses to
push if it differs from the URL the deploy key resolves to; a change takes
effect on the next deploy. Unset, the web build fails (`requireConvexUrl` in
`apps/web/astro.config.ts`), and with it the deploy: there is no build without
a deployment, so taking Convex out of the path is an outage, not a toggle.

## Report

State which deployment you touched, which variables you set (**names only,
never values**), and the literal status each probe returned. "Sign-in works" without the probe output is not a
verification.
