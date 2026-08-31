---
name: convex-deploy-verify
description: Configure and verify an ITUN Convex deployment end-to-end without signing in — the three required env vars, the bot credential, and the curl probe that tells the three failure modes apart
allowed-tools: Bash, Read
---

# Convex Deploy & Verify

Every failure mode on this path is **silent, and misattributes**. A missing
`SITE_URL` reports a 500 that looks like a server fault; a `.convex.cloud` where
`.convex.site` belongs reports "deployment unreachable", which points at the
network rather than at the typo. That is why this is a skill and not a one-line
script — the commands are trivial, the traps are not.

Full narrative: [`docs/architecture/accounts-and-games.md`](../../../docs/architecture/accounts-and-games.md).
Identifiers: [`docs/architecture/agent-tooling.md`](../../../docs/architecture/agent-tooling.md).

## Before anything: which deployment?

|              | Dev                                     | Production                 |
| ------------ | --------------------------------------- | -------------------------- |
| Deployment   | `dev/alex-jarvis` (`perfect-donkey-72`) | `exuberant-porpoise-183`   |
| `SITE_URL`   | `http://localhost:5173`                 | `https://intheunionnow.com` |

`bunx convex env set` targets **dev** unless you add `--prod`. Confirm which one
you mean before running anything, and say so out loud in your report.

## 1. Set the three required variables

**All three, or sign-in fails.** Per deployment.

```bash
bunx convex env set AUTH_DISCORD_ID     <client-id>
bunx convex env set AUTH_DISCORD_SECRET <client-secret>
bunx convex env set SITE_URL            <frontend origin>
# add --prod to target production
```

**`SITE_URL` is the one that bites.** It is the **frontend** origin — _not_
`VITE_CONVEX_SITE_URL`, not the `.convex.site` host. Nothing prompts for it, and
omitting it fails with an opaque `Missing environment variable SITE_URL` 500
from the OAuth callback rather than anything that points at configuration.

For production the frontend origin is the **custom domain**
(`https://intheunionnow.com`), which is now the Worker's own route — the
`.netlify.app` subdomain it used to be distinguished from is decommission
debris, and the `VITE_SITE_URL` that pointed at it is gone with the Netlify
site's build config.

## 2. Bot credential, only if wiring the Discord bot

```bash
# Convex — enables the /bot/* route. UNSET disables the surface entirely, so a
# deployment that has not opted in cannot be talked to by a bot at all.
bunx convex env set ITUN_BOT_SECRET <a long random string>

# Render (suref-discord-bot) — BOTH, or the bot silently stays in Solo mode.
ITUN_CONVEX_SITE_URL=https://<deployment>.convex.site
ITUN_BOT_SECRET=<the same value>
```

`ITUN_CONVEX_SITE_URL` is the **HTTP-actions** origin (`.convex.site`) — not the
client URL (`.convex.cloud`), not the web origin.

`ITUN_BOT_SECRET` is a **bearer credential**: whoever holds it can act as any
Discord user who has linked an account. Bounded — it cannot invent a
membership, reach an unlinked account, read somebody's shelf, or see
`encounterNpcs` — but real. 1Password, never git, set it in the Render
dashboard.

## 3. Verify without signing in

Curl the callback. The status distinguishes all three failure modes:

```bash
curl -s -D - -o /dev/null https://<deployment>.convex.site/api/auth/callback/discord | grep -i location
```

| Result                                 | Means                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| **302** → your `SITE_URL`              | Correctly configured.                                      |
| **500** `Missing environment variable` | `SITE_URL` unset.                                          |
| **404**                                | Auth routes not mounted — check `convex/http.ts` deployed. |

**Always run the bogus-provider control too:**

```bash
curl -s -D - -o /dev/null https://<deployment>.convex.site/api/auth/callback/bogusprovider
```

It must return **500**. Without this control a router that answers *everything*
looks identical to one correctly configured for Discord — a 302 on the Discord
path alone proves nothing.

## 4. Checking a secret is present — never by exit code

`bunx convex env get` **exits 0 for a variable that does not exist**, so the
exit code is not a presence check. It also prints in the clear, so never echo it
into a terminal or a transcript. Test presence by length:

```bash
bunx convex env get AUTH_DISCORD_SECRET | tr -d '[:space:]' | wc -c
```

A plausible length means present; `0` means absent.

## 5. Switching production on (or off)

Production builds in **Solo mode** until `VITE_CONVEX_URL` reaches the itun
build. That is safe and deliberate, not an outage — a build with no Convex URL
is the pre-accounts app, fully working.

The build moved from Netlify to GitHub Actions (ADR-033 §4), so this is no
longer a site setting:

1. Add the prod redirect URI to the Discord application.
2. `VITE_CONVEX_URL` is supplied by `convex deploy --cmd-url-env-var-name` in
   `.github/workflows/deploy-cloudflare.yml`, so it is set by the Convex deploy
   itself rather than pasted anywhere. It is a **build-time** variable: it takes
   effect on the next deploy, not immediately.

Reversing means changing that step. Local builds are unaffected either way.

## Report

State which deployment you touched, which variables you set (**names only —
never values**), and the literal status code each probe returned including the
bogus-provider control. "Sign-in works" without the probe output is not a
verification.
