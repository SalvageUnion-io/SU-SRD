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
deployment names) that file is the one with the
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
matched no CI path filter at the time, the doc-drift check never ran on that PR.

CLAUDE.md sends agents here *instead of* enumerating accounts, so a wrong row
here is followed rather than checked. There is no declared `github` server: use
the `gh` CLI, or the session's `mcp__github__*` tools where `gh` is absent. The `netlify` and `render` servers were deleted with the hosts they
reached.

**Verify the whole set at once with `claude mcp list`.** A server that reports
anything other than `✔ Connected` is not a server you can rely on, and "zero
tool calls" is indistinguishable from "broken" without running this.

### GitHub is not a declared server

`.mcp.json` declares no GitHub server, on purpose: the endpoint
(`https://api.githubcopilot.com/mcp/`) does **not** support dynamic client
registration, so Claude Code cannot OAuth into it, and a committed entry could
only ever report `✘ Failed to connect` on every machine that had not added a
token by hand.

- **On a laptop**, use the `gh` CLI. If you want the MCP tools as well, add a
  **local-scope** entry in your own `~/.claude.json` (never in the committed
  `.mcp.json`, which would either leak a token or hard-code a path that only
  exists on one machine) that supplies an `Authorization` header from a PAT:

  ```jsonc
  // ~/.claude.json → projects["/path/to/SU-SRD"].mcpServers
  "github": {
    "type": "http",
    "url": "https://api.githubcopilot.com/mcp/",
    "headersHelper": "<command that prints {\"Authorization\":\"Bearer <PAT>\"}>"
  }
  ```

- **In a cloud session**, `gh` is not installed and the session supplies its
  own `mcp__github__*` tools instead. See [Cloud sessions](#cloud-sessions).

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

## Cloud sessions

Everything above assumes a laptop: a `gh` CLI, OAuth'd MCP servers and a
Convex device login. A Claude Code on the web session has none of those, and
each one fails differently, so know what to expect before reading a failure as
a repo defect.

| Tool | Laptop | Cloud session |
| --- | --- | --- |
| `gh` CLI | installed | **absent** — use the session's `mcp__github__*` tools |
| `mcp__github__*` | only with a local-scope entry (above) | **provided by the session**, deferred: load with ToolSearch (`select:mcp__github__create_pull_request,…`) before the first call |
| `cloudflare-bindings`, `cloudflare-observability`, `sentry`, `context7` | OAuth / keyless | **fail to connect** — the egress proxy refuses the tunnel (`ERR_PROXY_TUNNEL`, 403) unless the host is allowed |
| `convex` (stdio) | device credentials in `~/.convex/config.json` | **no credentials** — every tool call fails; ask for data rather than working around it |
| Pinned Bun (`.bun-version`) | installed by you | the image's Bun may predate the pin and cannot read `bun.lock`; the SessionStart hook installs the pinned one under `~/.local/share/su-srd-bun/<version>/` |

**Network.** The remote MCP hosts are reachable only if the environment's
network policy allows them: `bindings.mcp.cloudflare.com`,
`observability.mcp.cloudflare.com`, `mcp.sentry.dev` and `mcp.context7.com`.
That is a setting on the cloud environment (Network access → allowed domains),
not something the repo can change. Until it is set, work that depends on those
servers — Sentry issues, Worker logs — is **unread**, and a report must say so
rather than imply the signal was clean (`/triage` does this explicitly).

**Bun.** If `bun --version` does not match `.bun-version`, put the pinned build
first on `PATH` for the command — `export
PATH="$HOME/.local/share/su-srd-bun/$(cat .bun-version):$PATH"` — and run
`bun install --frozen-lockfile` if `node_modules` is empty. The lefthook hooks
inherit the same `PATH`, so a commit or push needs it too.

**Workflows and skills.** `.claude/workflows/*.js` and `/triage` name the `gh`
command and the `mcp__github__*` fallback side by side, and the workflow prompts
forbid skipping or faking a GitHub step because `gh` is missing. Neither
workflow's result schema has a dedicated field for a step with no route at all;
`single_issue_resolve` reports it in its free-text `notes`, and `/triage`
reports it as an unread signal.

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

## Netlify — retired, deletion pending

Team **SalvageUnion.io** (`salvageunion-io`, `6a3b41d74a67a34e3aae3ede`, Pro) —
[team dashboard](https://app.netlify.com/teams/salvageunion-io).

**Nothing in this repo reaches Netlify, and no Netlify site serves any traffic.**
Every production hostname resolves to a Cloudflare Worker (see the Cloudflare
section above). ADR-033 P8 is done on the repo side (2026-09-25); deleting the
three sites and the team is the operator's step, decided the same day.

| Site               | App it used to build | Site id                                |
| ------------------ | -------------------- | -------------------------------------- |
| `suindex`          | `apps/srd`           | `62482841-12dd-4e35-a4ed-900f357675dc` |
| `in-the-union-now` | `apps/itun`          | `801d6f8d-1ad4-42c1-a29d-126b2d69ee69` |
| `su-assets`        | `apps/su-assets`     | `19faf088-1c54-4bae-9312-74d7b0a94cea` |

The ids are kept only so that deletion targets a site by id — the account also
carries unrelated teams (RANDSUM, Binfinite, JRVS Softworks). Note `suindex` is
`apps/srd`; the name does not match the directory. A site still answering on its
`.netlify.app` hostname is **decommission debris, not an origin**. Once the sites
are deleted, remove this section.

## Render — gone

The account was deleted on 2026-09-01. Nothing here is actionable.

## Sentry

Org **`susrd`**, **EU region** — API `https://de.sentry.io`, web
[`https://susrd.sentry.io`](https://susrd.sentry.io). The region matters: a DSN
issued in one region is silently unusable under another, and every project here
is EU.

| Project          | Surface                                   | DSN env var          |
| ---------------- | ----------------------------------------- | -------------------- |
| `srd`            | `apps/srd` browser bundle                 | `VITE_SENTRY_DSN` (repo variable `SRD_SENTRY_DSN`\*) |
| `itun`           | `apps/itun` browser bundle                | `VITE_SENTRY_DSN`    |
| `itun-functions` | `apps/itun` Worker                        | `SENTRY_DSN`         |
| `itun-convex`    | The ITUN Convex deployments               | _dashboard toggle_   |
| `su-assets`      | `apps/su-assets` function                 | `SENTRY_DSN`         |
| `su-discord`     | `apps/discord-bot` Cloudflare Worker      | `SENTRY_DSN`         |

\* **Operator follow-up, not yet done:** `SRD_SENTRY_DSN` may not exist yet —
the DSN still sits in the repository variable under its old name,
`PUBLIC_SENTRY_DSN`, and `deploy-cloudflare.yml` reads
`vars.SRD_SENTRY_DSN || vars.PUBLIC_SENTRY_DSN`. To finish: create
`SRD_SENTRY_DSN` with the same value, delete `PUBLIC_SENTRY_DSN`, then drop the
`||` fallback (both occurrences) and the `PUBLIC_*` rollback shim on the
"Build srd" step once `deployed/cloudflare` is past the rename.

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
halves together (`bun run check observability`, part of every `bun run check`)
and pins the ingest host as `https://*.ingest.de.sentry.io`. **If you change the
CSP or the Sentry region, change both in lockstep.**

**Sourcemaps.** `srd` and `itun` both upload through `@sentry/vite-plugin`,
gated on `SENTRY_AUTH_TOKEN`, so only `deploy-cloudflare.yml` ever uploads.
One org token and `vars.SENTRY_ORG` serve both; the project is
`vars.SENTRY_PROJECT` for itun and the literal `srd` for srd, so the token must
be able to write releases to both projects. srd had no upload until the
2026-09-25 audit (AP-20).

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
([ADR-024](../adrs/ADR-024-derived-release-changelogs.md)). On a laptop use the
`gh` CLI; in a cloud session use the session's `mcp__github__*` tools (see
[Cloud sessions](#cloud-sessions)).

## Verifying this file is still true

Identifiers drift. Each row below can be re-derived, and the check is cheap:

| Claim                  | How to re-derive                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| All MCP servers up     | `claude mcp list`                                                                          |
| Netlify sites + ids    | `netlify sites:list` (retired host — needed only to DELETE them, per ADR-033 P8)            |
| Sentry org + projects  | Sentry MCP `find_organizations` / `find_projects`                                          |
| Convex deployments     | `bunx convex mcp start` → `status`, or the Convex dashboard                                |
| Sentry wiring is live  | `bun run check observability` (and `bun run check:observability:live` against production) |

If a re-derivation disagrees with this file, **believe the platform and fix this
file** — a stale identifier here is worse than no identifier, because an agent
will act on it.
