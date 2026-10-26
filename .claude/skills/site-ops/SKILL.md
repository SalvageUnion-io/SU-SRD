---
name: site-ops
description: Use when setting up or checking the site Worker's sign-in, when Discord sign-in fails or answers 503, when the bot replies "salvageunion.io is not configured for this bot", answers `unavailable`, or its `/health` returns 503, when rotating DISCORD_CLIENT_SECRET, when an agent needs the app signed in (`bun run dev:backend`), or when anything would touch the retired Convex project.
allowed-tools: Bash, Read
---

# Site operations

Every failure on this path is **silent, and misattributes**. A missing service
binding answers every Game command `unavailable`, which reads as an outage
rather than a config gap. The commands are trivial; the traps are not.

## Local and agent backends

`bun run dev` runs the site Worker under `wrangler dev` beside `astro dev`
(`apps/web/astro/build/devWorker.ts`), rooms, shared database and the test
sign-in included. There is no setup. To sign in, run
`await __appTestSignIn('<any email>', '<8+ char password>')` in the browser
console on `http://localhost:4321/build/`.

An agent (a cloud container, a Remote Control sandbox) runs
`bun run dev:backend` (`tools/dev-backend.ts`) in the background instead: the
same server on the checkout's port, its state in the gitignored
`.dev-backend/`, and on first start the seeded account in
`.dev-backend/seed.json`. `--fresh` wipes it. Its dev server takes the
checkout's port, so stop a `bun run dev` there (or use a worktree).

```bash
bun run dev:backend &
bun run shot :game --signed-in --width phone # also :pilot, :mech, :crawler, app:/route
```

## Secrets never touch argv or stdout

- **Pipe a secret in on stdin; never pass it as an argument.** Node's
  `execFileSync` embeds the whole command line in its error message, so a
  failure prints the secret even with output suppressed.
- **Check presence by name, never by value**: `bunx wrangler secret list`
  prints names only.

## 1. Set up sign-in

Sign-in runs on the su-srd Worker (`apps/web/src/worker/auth/`): Discord OAuth,
accounts and sessions in D1 (`SHARED`: `su-shared`; Previews
`su-shared-preview`). Two Worker secrets, from `apps/web`. Previews take
theirs from the Preview base config (`wrangler preview base-config secret
put`): a Preview's own secrets (`wrangler preview secret put`) are replaced by
its next ship.

```bash
bunx wrangler secret put DISCORD_CLIENT_ID       # op://SUSRD/discord-bot,
bunx wrangler secret put DISCORD_CLIENT_SECRET   # the OAuth client, on stdin
```

The Discord application lists `<origin>/auth/callback` as a redirect for
every origin that signs in. A Preview with `AUTH_CALLBACK_ORIGIN` in its vars
(`wrangler.jsonc`'s `previews`) comes back through that origin's callback,
which hands the code to `pr-<n>-su-srd.alxjrvs.workers.dev`, so Discord lists
production's alone. Without the Discord pair `/auth/sign-in` answers 503.

## 2. Wire the Discord bot

The bot and the site reach each other by service binding, with no shared
secret: the bot's `SITE` binding calls the site's `BotGateway` for every Game
command, and the site's `BOT` binding calls the bot's `Relay` to post a Play
roll or a Stop Sign to a bound channel. The bot posts with its own
`DISCORD_TOKEN` (required: its `/health` answers 503 until it is set).

**Deploy order:** the bot ships its `Relay` before the site's `BOT` binding
deploys, or the site's deploy fails on a missing entrypoint. A Preview has no
`BOT` binding, so it never posts to a real channel.

## 3. Verify sign-in without signing in

```bash
curl -s -D - -o /dev/null https://salvageunion.io/auth/sign-in | grep -iE '^(HTTP|location)'
curl -s -o /dev/null -w '%{http_code}\n' https://salvageunion.io/auth/session
```

A **302** to `discord.com/oauth2/authorize` with this origin's
`/auth/callback` means the Discord pair is set; **503** means it is not. The
session endpoint answers **401** signed out. Only a real sign-in proves the
whole round trip.

## Rotating `DISCORD_CLIENT_SECRET`

Resetting it in the Discord portal invalidates the old value **immediately**, so
sign-in is broken until the Worker is updated. Have the command ready, then
reset, copy, and run it back to back:

```bash
pbpaste | tr -d '\n' | bunx wrangler secret put DISCORD_CLIENT_SECRET
```

Guard on **length 32** before writing: if the copy silently failed, refusing
beats writing garbage into production auth. Only a real sign-in proves it.

## Convex, the retired fallback

The site no longer talks to Convex (ADR-030). The Convex project, its data and
its keys stay intact as a fallback, and nothing in `main` deploys to it; its
code is at the `convex-last` tag. Never run a `convex` command against it, and
never delete or change its data, without the owner's word in the thread.

## Report

State which Worker you touched, which secrets you set (**names only, never
values**), and the literal status each probe returned. "Sign-in works" without
the probe output is not a verification.
