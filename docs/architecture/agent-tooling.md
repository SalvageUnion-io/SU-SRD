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
| `cloudflare-bindings` | http — `https://bindings.mcp.cloudflare.com/mcp` | OAuth on first connect | Workers, R2, KV, D1, Hyperdrive on the account that hosts everything |
| `cloudflare-observability` | http — `https://observability.mcp.cloudflare.com/mcp` | OAuth on first connect | Worker logs, analytics and errors for the four production Workers |
| `sentry`  | http — `https://mcp.sentry.dev/mcp`              | OAuth on first connect                                              | The `susrd` org's six projects, issues     |
| `convex`  | stdio — `bunx convex mcp start --project-dir apps/itun` | The Convex CLI's own device credentials (`~/.convex/config.json`) | The ITUN Convex deployments                |
| `context7` | http — `https://mcp.context7.com/mcp`           | None — keyless on the free tier                                     | Version-pinned docs for this repo's dependencies |

**That is the whole set — five servers, and this table is now asserted against
`.mcp.json` by `tools/check-doc-drift.ts`.** It had drifted in both directions
at once, which is why the assertion exists: it claimed *"Cloudflare — the actual
host. No MCP server is declared; use `wrangler`"* while two Cloudflare servers
WERE declared, and it carried live rows for `netlify`, `render` and `github`,
none of which are. Commit `aaff8f0` updated `.mcp.json`, `CLAUDE.md` and
`cloudflare-cutover.md` and did not touch this file — and because root prose
matched no CI path filter at the time, `validate:all` never ran on that PR.

CLAUDE.md sends agents here *instead of* enumerating accounts, so a wrong row
here is followed rather than checked. There is no `github` MCP server: use the
`gh` CLI. The `netlify` and `render` servers were deleted with the hosts they
reached.

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

### `context7` is advisory, and that is the whole point

It answers "what is the API in **this** version", which is the failure this repo
keeps paying for — TypeScript 7 alongside a load-bearing `typescript-classic` 6
alias, Vite 8, Tailwind 4.3, Convex 1.43, TanStack Router 1.170, Biome 2.5, knip
6.29. Most of that is newer than any model's training data.

Two caveats, neither disqualifying: what it returns is **condensed
documentation, not the source** — verify anything load-bearing against
`node_modules` or the project's own types — and library-name queries leave the
machine, though no repo content does. It exposes two tools, the smallest context
cost of any server here.

## Cloudflare

**This is where everything runs** (ADR-033). Account `alxjrvs@gmail.com` — the
same personal account that hosts RANDSUM, which is why the CI token's blast
radius is not contained (ADR-033 §6, and it is an accepted risk, not a solved
one).

| Worker            | Serves                                        | Bindings                          |
| ----------------- | --------------------------------------------- | --------------------------------- |
| `su-srd`          | `salvageunion.io`, `www.` (redirect)          | none — Static Assets, no script    |
| `su-itun`         | `intheunionnow.com`, `www.`, the snapshot API | `ASSETS`, R2 `SNAPSHOTS`, `RATE_LIMITER` |
| `su-assets`       | `assets.salvageunion.io`                      | R2 `LP_ASSETS`, `IMAGES`           |
| `su-discord-bot`  | Discord HTTP interactions + a 5-minute cron   | none; secrets only                 |

**R2 buckets:** `su-itun-snapshots` (shared sheets), `su-lp-assets` (licensed
artwork). **Zones:** `salvageunion.io` and `intheunionnow.com`, both on
Cloudflare nameservers since 2026-08-31.

**Preview URLs** live under `alxjrvs.workers.dev` — one subdomain per account,
shared with RANDSUM, so it could not be named for this project.

Re-derive any of this rather than trusting the table: `wrangler deployments
list`, `wrangler r2 bucket list`, and the four `apps/*/wrangler.jsonc` files,
which are the source of truth for every binding above.

**Two things are configured OUTSIDE the repo and are invisible to `grep`:** the
zone-level Redirect Rule that sends `www` to the apex (a `_redirects` file
cannot express a domain-level rule), and Images Transformations, which must be
enabled per zone in the dashboard.

## Netlify — retired

Team **SalvageUnion.io** (`salvageunion-io`, `6a3b41d74a67a34e3aae3ede`, Pro) —
[team dashboard](https://app.netlify.com/teams/salvageunion-io).

**Nothing in this repo reaches Netlify, and no Netlify site serves any traffic.**
ADR-033 P7 completed 2026-08-31: every production hostname resolves to a
Cloudflare Worker (see the Cloudflare section above, which is the live one).
There is no `netlify.toml` anywhere in the tree, no `netlify/` function trees,
no `@netlify/blobs` dependency, and no `netlify` MCP server. Builds are stopped
on both repo-linked sites.

| Site               | App it used to build | Site id                                |
| ------------------ | -------------------- | -------------------------------------- |
| `suindex`          | `apps/srd`           | `62482841-12dd-4e35-a4ed-900f357675dc` |
| `in-the-union-now` | `apps/itun`          | `801d6f8d-1ad4-42c1-a29d-126b2d69ee69` |
| `su-assets`        | `apps/su-assets`     | `19faf088-1c54-4bae-9312-74d7b0a94cea` |

The ids are kept for one reason: **deleting these sites is the remaining half of
P8**, and an agent doing that must target a site by id — the account also carries
unrelated teams (RANDSUM, Binfinite, JRVS Softworks). Note `suindex` is
`apps/srd`; the name does not match the directory, which has misled agents
before.

A site still answering on its `.netlify.app` hostname is **decommission debris,
not an origin**. This section previously carried the live production URLs in a
"Production URL" column and described build configuration in `apps/*/netlify.toml`
in the present tense — months after those files were deleted — which is exactly
the kind of row an agent acts on rather than checks.

## Render — retired

| Service             | Type              | Service id                | Workspace                                   | Dashboard                                                                  |
| ------------------- | ----------------- | ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `suref-discord-bot` | background worker | `srv-d600r21r0fns73el5kk0` | `tea-cspvcb0gph6c739fv6s0` (Alex Jarvis's) | [↗](https://dashboard.render.com/worker/srv-d600r21r0fns73el5kk0)          |

This is the **only** SU-SRD service on Render. The workspace also holds services
for unrelated repos (`hermuz`, `randsum-discord-bot`, `gear`), so **the Render
MCP will refuse to act until you pass a `workspaceId`** — pass the id above, and
target the service by id.

It WAS Blueprint-managed from a `render.yaml` with `autoSync`, so that file was
the source of truth for build config — a change made in the
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
| Netlify sites + ids    | `netlify sites:list` (retired host — needed only to DELETE them, per ADR-033 P8)            |
| Render service id      | the Render dashboard (retired host; the service is dormant, not production)                |
| Sentry org + projects  | Sentry MCP `find_organizations` / `find_projects`                                          |
| Convex deployments     | `bunx convex mcp start` → `status`, or the Convex dashboard                                |
| Sentry wiring is live  | `bun run validate:observability` (and `--live` against production, which the tool supports) |

If a re-derivation disagrees with this file, **believe the platform and fix this
file** — a stale identifier here is worse than no identifier, because an agent
will act on it.
