# Agent Tooling & Service Registry

The operational reference for every external service this repo deploys to, and
for the MCP servers an agent uses to reach them. If you are an agent and you
need a site id, a service id, a deployment name, an org slug, or a dashboard
URL — it is here, and you should read it rather than guessing or listing every
project on an account.

**Scope note.** [`accounts-and-games.md`](accounts-and-games.md) is the runbook
for _standing up and debugging sign-in_ (Discord OAuth, Convex env vars, the
bot credential). This file is the _registry_: which projects exist, what their
identifiers are, and which tool reaches them. Where the two overlap (the Convex
deployment names, the Netlify site names) that file is the one with the
surrounding narrative — this one has the identifiers.

## What is safe to write down here

Everything in this file is a **public or semi-public identifier**: a site id, a
service id, an org slug, a deployment name, a dashboard URL. None of it is a
credential, and none of it grants access on its own — every one of these still
requires an auth token that lives in 1Password or in a platform CLI's own
credential store.

**Never** add to this file: API tokens, Sentry DSNs, the Discord bot token or
OAuth client secret, `ITUN_BOT_SECRET`, or any Convex env var _value_. If you
find yourself pasting something that would be dangerous in a public repo, stop —
it belongs in 1Password and gets referenced by name, not by value.

## MCP servers

[`.mcp.json`](../../.mcp.json) is committed and project-scoped; Claude Code
prompts each contributor to approve it per project. It is **secret-free by
design** — transport, command and URL only. No `Authorization` headers, no
tokens, and deliberately **no `${VAR}` placeholders** (#291 removed those on
purpose; do not reintroduce them). Every server below authenticates through
something outside the file.

| Server    | Transport                                        | Auth model                                                         | Reaches                                    |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| `netlify` | stdio — `npx -y @netlify/mcp`                    | Netlify CLI / OAuth on first connect                                | The three Netlify sites, deploys, env vars |
| `sentry`  | http — `https://mcp.sentry.dev/mcp`              | OAuth on first connect                                              | The `susrd` org's six projects, issues     |
| `render`  | http — `https://mcp.render.com/mcp`              | OAuth on first connect, or a machine-local API-key header           | The `suref-discord-bot` worker, logs       |
| `convex`  | stdio — `bunx convex mcp start --project-dir apps/itun` | The Convex CLI's own device credentials (`~/.convex/config.json`) | The ITUN Convex deployments                |
| `github`  | http — `https://api.githubcopilot.com/mcp/`      | **Machine-local PAT header — see below.** Does not work unconfigured | The `SalvageUnion-io/SU-SRD` repo, PRs, CI |

**Verify the whole set at once with `claude mcp list`.** A server that reports
anything other than `✔ Connected` is not a server you can rely on, and "zero
tool calls" is indistinguishable from "broken" without running this.

### `github` needs machine-local auth, and fails loudly without it

The committed entry carries the right URL and transport, but the endpoint does
**not** support dynamic client registration, so Claude Code cannot OAuth into it.
Unconfigured, `claude mcp list` reports:

```
github: https://api.githubcopilot.com/mcp/ (HTTP) - ✘ Failed to connect —
        Incompatible auth server: does not support dynamic client registration
```

That is expected, not a repo defect. The fix is a **local-scope** override in
your own `~/.claude.json` (never in the committed `.mcp.json`, which would
either leak a token or hard-code a path that only exists on one machine) that
supplies an `Authorization` header from a PAT:

```jsonc
// ~/.claude.json → projects["/path/to/SU-SRD"].mcpServers
"github": {
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headersHelper": "<command that prints {\"Authorization\":\"Bearer <PAT>\"}>"
}
```

A local-scope entry **shadows** the same-named `.mcp.json` entry, so this is
additive — nothing needs to be removed from the committed file. The `render`
entry is already overridden the same way on the maintainer's machine, which is
why `render` connects while `github` does not.

`gh` on the command line is unaffected and remains the fallback for everything
the MCP server would have done.

### `convex` is read-only against dev by default, and that is deliberate

`convex mcp start` refuses production deployments unless explicitly flagged
(`--dangerously-enable-production-deployments`) and refuses PII-bearing reads on
production unless flagged (`--cautiously-allow-production-pii`). **Neither flag
is in `.mcp.json` and neither should be added.** An agent that needs production
data should be asked for, not defaulted into.

It resolves the deployment from `CONVEX_DEPLOYMENT` in `apps/itun/.env.local`,
which `bunx convex dev` writes and which is gitignored. **Before that file
exists, the server starts fine and every tool call fails** with:

```
{"error":"No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project"}
```

So a green `claude mcp list` is not proof the Convex tools work — run
`bunx convex dev` once to link a dev deployment first.

## Netlify

Team **SalvageUnion.io** (`salvageunion-io`, `6a3b41d74a67a34e3aae3ede`, Pro) —
[team dashboard](https://app.netlify.com/teams/salvageunion-io). The account also
carries unrelated teams (RANDSUM, Binfinite, JRVS Softworks); **an agent must
target a site by id**, not by picking from a listing.

| Site               | App              | Production URL                   | Site id                                | Dashboard                                                 |
| ------------------ | ---------------- | -------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| `suindex`          | `apps/srd`       | `https://salvageunion.io`        | `62482841-12dd-4e35-a4ed-900f357675dc` | [↗](https://app.netlify.com/projects/suindex)             |
| `in-the-union-now` | `apps/itun`      | `https://intheunionnow.com`      | `801d6f8d-1ad4-42c1-a29d-126b2d69ee69` | [↗](https://app.netlify.com/projects/in-the-union-now)    |
| `su-assets`        | `apps/su-assets` | `https://assets.salvageunion.io` | `19faf088-1c54-4bae-9312-74d7b0a94cea` | [↗](https://app.netlify.com/projects/su-assets)           |

**The site name does not match the app directory for `srd`.** `suindex` is
`apps/srd`. This has misled agents before — it is the single most useful fact in
this table.

Build configuration is per-app in `apps/*/netlify.toml`; `srd` is static with no
functions, `itun` adds the snapshot Functions + Blobs
([ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md)), and `su-assets` is
one function over the `lp-assets` Blobs store.

For ITUN specifically, **the production origin is the custom domain, not the
`.netlify.app` subdomain** — `SITE_URL` and the Discord OAuth redirect must both
use `https://intheunionnow.com`. See
[`accounts-and-games.md`](accounts-and-games.md).

## Render

| Service             | Type              | Service id                | Workspace                                   | Dashboard                                                                  |
| ------------------- | ----------------- | ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `suref-discord-bot` | background worker | `srv-d600r21r0fns73el5kk0` | `tea-cspvcb0gph6c739fv6s0` (Alex Jarvis's) | [↗](https://dashboard.render.com/worker/srv-d600r21r0fns73el5kk0)          |

This is the **only** SU-SRD service on Render. The workspace also holds services
for unrelated repos (`hermuz`, `randsum-discord-bot`, `gear`), so **the Render
MCP will refuse to act until you pass a `workspaceId`** — pass the id above, and
target the service by id.

Blueprint-managed from [`render.yaml`](../../render.yaml) with `autoSync`, so
**the file is the source of truth for build config** — a change made in the
dashboard gets reverted on the next sync. `buildFilter` deliberately restricts
rebuilds to paths the bot actually bundles; the reasoning is in that file and is
worth reading before widening it.

Secrets (`DISCORD_TOKEN`, `SENTRY_DSN`, `ITUN_BOT_SECRET`, …) are `sync: false`
and set in the dashboard, never in the repo.

## Sentry

Org **`susrd`**, **EU region** — API `https://de.sentry.io`, web
[`https://susrd.sentry.io`](https://susrd.sentry.io). The region matters: a DSN
issued in one region is silently unusable under another, and every project here
is EU.

| Project          | Surface                                   | DSN env var          |
| ---------------- | ----------------------------------------- | -------------------- |
| `srd`            | `apps/srd` browser bundle                 | `PUBLIC_SENTRY_DSN`  |
| `itun`           | `apps/itun` browser bundle                | `VITE_SENTRY_DSN`    |
| `itun-functions` | `apps/itun` Netlify Functions             | `SENTRY_DSN`         |
| `itun-convex`    | The ITUN Convex deployments               | _dashboard toggle_   |
| `su-assets`      | `apps/su-assets` function                 | `SENTRY_DSN`         |
| `su-discord`     | `apps/discord-bot` worker (Render)        | `SENTRY_DSN`         |

`itun-convex` has **no DSN env var in this repo on purpose.** Convex reports
through its first-party Exception Reporting integration, configured in the
Convex dashboard per deployment — there is no application code to write. The
full reasoning (queries/mutations run in a runtime with no `fetch`, so a
code-level SDK could never see most of the errors) is in
[`accounts-and-games.md`](accounts-and-games.md).

**Sentry's failure mode is silent, and CI guards it.** Both browser apps
env-gate the SDK on a DSN, so with no DSN Vite tree-shakes Sentry out and the
build looks identical to a working one; and even with a DSN, a `connect-src`
that omits the ingest origin blocks every event while still looking healthy.
[`tools/check-observability.ts`](../../tools/check-observability.ts) checks both
halves together (`bun run validate:observability`, wired into `validate:all`)
and pins the ingest host as `https://*.ingest.de.sentry.io`. **If you change the
CSP or the Sentry region, change both in lockstep.**

## Convex

Project **`alex-jarvis:suref-itun`** —
[dashboard](https://dashboard.convex.dev/t/alex-jarvis/suref-itun).

|            | Dev                                      | Production                                    |
| ---------- | ---------------------------------------- | --------------------------------------------- |
| Deployment | `dev/alex-jarvis` (`perfect-donkey-72`)  | `exuberant-porpoise-183`                      |
| Client URL | `https://perfect-donkey-72.convex.cloud` | `https://exuberant-porpoise-183.convex.cloud` |
| HTTP actions | `https://perfect-donkey-72.convex.site` | `https://exuberant-porpoise-183.convex.site`  |

`.convex.site` is the **HTTP-actions** origin and `.convex.cloud` is the client
URL; they are not interchangeable, and swapping them presents as "the deployment
is unreachable" rather than as a typo. Backend modules live in
[`apps/itun/convex/`](../../apps/itun/convex/);
[ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md) governs.

## GitHub

Repo [`SalvageUnion-io/SU-SRD`](https://github.com/SalvageUnion-io/SU-SRD),
default branch `main`. CI is GitHub Actions; releases are release-please
([ADR-024](../adrs/ADR-024-derived-release-changelogs.md)). With the `github`
MCP unconfigured (see above), use the `gh` CLI.

## Verifying this file is still true

Identifiers drift. Each row below can be re-derived, and the check is cheap:

| Claim                  | How to re-derive                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| All MCP servers up     | `claude mcp list`                                                                          |
| Netlify sites + ids    | Netlify MCP `get-projects`, or `netlify sites:list`                                        |
| Render service id      | Render MCP `list_services` with the workspace id above                                     |
| Sentry org + projects  | Sentry MCP `find_organizations` / `find_projects`                                          |
| Convex deployments     | `bunx convex mcp start` → `status`, or the Convex dashboard                                |
| Sentry wiring is live  | `bun run validate:observability` (and `--live` against production, which the tool supports) |

If a re-derivation disagrees with this file, **believe the platform and fix this
file** — a stale identifier here is worse than no identifier, because an agent
will act on it.
