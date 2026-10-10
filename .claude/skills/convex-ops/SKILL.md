---
name: convex-ops
description: Use when setting up or checking an ITUN Convex deployment, when Discord sign-in fails with a 500 or "deployment unreachable", when the bot replies "In The Union Now is not configured for this bot", answers `unavailable` or `unauthorized`, or its `/health` returns 503, when a Convex tool says "No CONVEX_DEPLOYMENT set", when rotating JWT_PRIVATE_KEY/JWKS or AUTH_DISCORD_SECRET, when running a one-off data repair, or when enabling or re-verifying Convex error reporting to Sentry.
allowed-tools: Bash, Read
---

# Convex operations

Every failure on this path is **silent, and misattributes**. A missing
`SITE_URL` reports a 500 that looks like a server fault; a `.convex.cloud` where
`.convex.site` belongs reports "deployment unreachable", which points at the
network rather than at the typo. The commands are trivial; the traps are not.

The deployments and the seven deployment variables (what each is, what
breaks when it is unset):
[accounts and Games operations](../../../docs/ARCHITECTURE.md#accounts-and-games-operations).
This skill is the procedures.

## Before anything: which deployment?

Production is `exuberant-porpoise-183` (`--prod`, or `--deployment
alex-jarvis:suref-itun:prod`). There is no cloud dev deployment: without
`--prod`, `bunx convex` targets the **local** deployment `bun run dev:itun`
runs. Confirm which one you mean before running anything, and say so in your
report.

## Local backend

`bun run dev:itun` runs `convex dev --start vite` on a local deployment: it
pushes `convex/` on every save and writes `CONVEX_DEPLOYMENT`,
`VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` into `apps/itun/.env.local`. It
signs in through the test seam, not Discord: the `dev` script sets
`VITE_TEST_AUTH=true`, and the deployment needs `ITUN_TEST_AUTH`. Production
has neither. It refuses to start on a cloud `CONVEX_DEPLOYMENT`
(`scripts/assert-local-convex.ts`): `.worktreeinclude` copies `.env.local` into
every worktree, so a cloud dev deployment is one backend that every worktree's
pushes overwrite. One-time setup, from `apps/itun`:

```bash
# Pick a local deployment. Not signed in to Convex: run `bun run dev:itun` and
# choose "Start without an account (run Convex locally)". Signed in, or with a
# .env.local that names a cloud deployment:
bunx convex dev --configure existing --team alex-jarvis --project suref-itun \
  --dev-deployment local --once

# Then, with `bun run dev:itun` running, in a second terminal:
bunx @convex-dev/auth --web-server-url http://localhost:5173   # SITE_URL + JWT keys
bunx convex env set ITUN_TEST_AUTH true
```

To sign in, run `await __itunTestSignIn('<any email>', '<8+ char password>')`
in the browser console on `http://localhost:5173`. Each call signs up a new
password account (a repeated email is refused), and the session survives
reloads. `bun run e2e:itun` starts `dev:itun` itself (or reuses a running one),
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
bunx convex env set --prod SITE_URL        <frontend origin>
```

`AUTH_DISCORD_SECRET` and the `JWT_PRIVATE_KEY` / `JWKS` pair go in on stdin,
as in the rotation sections below. `SITE_URL` is the **frontend** origin
(`https://intheunionnow.com`), not `VITE_CONVEX_SITE_URL` and not the
`.convex.site` host; nothing prompts for it. Without the JWT pair, sign-in
fails only after Discord redirects back, which the probe in step 3 never
reaches, so check both by length.

## 2. Wire the Discord bot

Generate a long random `ITUN_BOT_SECRET` into 1Password first; both sides take
that one value on stdin.

```bash
# Convex: enables /bot/*. Unset, no bot can talk to the deployment at all.
op read 'op://<vault>/<item>/credential' | bunx convex env set --prod ITUN_BOT_SECRET

# The bot Worker: both required; its /health answers 503 until they are set.
cd apps/discord-bot
bunx wrangler secret put ITUN_CONVEX_SITE_URL   # https://<deployment>.convex.site
op read 'op://<vault>/<item>/credential' | bunx wrangler secret put ITUN_BOT_SECRET
```

`ITUN_CONVEX_SITE_URL` is the HTTP-actions origin (`.convex.site`), not the
client URL (`.convex.cloud`) and not the web origin.

For `/su invite`, set `DISCORD_PUBLIC_KEY` to the application's public key from
`apps/discord-bot/wrangler.jsonc`. It is not a secret, so an argument is fine.
Set to the wrong application's key, every `/su invite` fails as unverified while
every other command keeps working: check it first when only invites break.

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
you replaced. Generate both together, in the formats the
[deployment variables](../../../docs/ARCHITECTURE.md#deployment-variables)
table gives, and write both:

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

Convex reports through the dashboard's Exception Reporting integration (Convex
dashboard → the deployment → **Settings → Integrations → Sentry**, the
`itun-convex` DSN). There is no code to add: queries and mutations have no
network egress, and the default runtime is not Node.

**A reporting integration that reports nothing looks exactly like a healthy one
with no errors.** Verify by probe, never by status line: force an error, then
check the deployment log (ground truth) and Sentry (the thing being tested).

```bash
cd apps/itun
bunx convex run --deployment alex-jarvis:suref-itun:prod \
  botClient:me '{"discordId":0}'      # forces one ArgumentValidationError
bunx convex logs --deployment alex-jarvis:suref-itun:prod --history 6 --jsonl
```

then <https://susrd.sentry.io/issues/?project=itun-convex>. In the log but not in
Sentry means it has stopped delivering.

## Running a one-off data repair

A repair is not kept in the repo. Write it as an `internalMutation` (or an
`internalAction` driving one mutation per page, once a table outgrows a single
mutation's read limit) that reports what it would change unless passed
`{ "apply": true }`. Ship it, run it from the Convex dashboard's function
runner on production, dry run first, and apply only on a non-zero count.
Record the counts in the PR that deletes it.

## There is no rollback by unsetting `VITE_CONVEX_URL`

Production builds with `VITE_CONVEX_URL` from `ITUN_CONVEX_URL` in
`.github/workflows/deploy-cloudflare.yml`, whose `push-convex` job refuses to
push if it differs from the URL the deploy key resolves to; a change takes
effect on the next deploy. Unset, the itun build fails (`requireConvexUrl` in
`apps/itun/vite.config.ts`), and with it the deploy: there is no build without
a deployment, so taking Convex out of the path is an outage, not a toggle.

## Report

State which deployment you touched, which variables you set (**names only,
never values**), and the literal status each probe returned, including the
bogus-provider control. "Sign-in works" without the probe output is not a
verification.
