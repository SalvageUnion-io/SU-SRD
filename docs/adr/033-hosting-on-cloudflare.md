# ADR-033: Hosting on Cloudflare

Current Workers, buckets and zones: [Cloudflare](../ARCHITECTURE.md#cloudflare).
The one app's single `su-srd` Worker: [ADR-050](050-one-app.md).

## Decision

**1. Hosting is Cloudflare.** The app is Workers Static Assets, `su-assets` a
Worker over R2, the Discord bot a Worker answering HTTP interactions.

**4. Builds run in GitHub Actions; deploys use `wrangler`.** Not Workers
Builds: the build provisions Chromium for OG images, and one build path keeps
one place for path filters and the gates in front of every deploy.

**5. Convex stays, and nothing here may foreclose moving it.** The
Worker↔Convex boundary stays plain HTTP with a bearer token.

**6. Everything runs on the existing `alxjrvs@gmail.com` account**, shared with
RANDSUM's Workers (`randsum-rdn`, `randsum-site`) on one Workers Paid plan and
the `alxjrvs.workers.dev` subdomain (renaming it moves RANDSUM's Workers).
Preview URLs are `<alias>-<worker>.alxjrvs.workers.dev`.

**7. A failed gate halts the deploy.** No gate is worked around, relaxed, or
retried with different parameters to obtain a pass.

## Consequences

- **The bot shows as permanently offline** (presence needs a gateway); its
  liveness is `/health`, checked by `tools/smoke-production.sh` after every
  deploy and nightly. Its endpoint is application-wide: no canary, so the
  signed replay harness is the pre-deploy gate.
- **Workers module scope forbids timers, async I/O and randomness** (`new
  REST()` throws there; so would module-scope observability).
- **Zod's `jitless` is load-bearing for the runtime** (workerd bans `new
  Function`): never revert `packages/salvageunion-reference/lib/zod.ts`.

## Credentials

- The Cloudflare API token is scoped to *Workers Scripts: Edit* and R2
  **narrowed to the named buckets**. Workers cannot be scoped per script, so it
  can edit any Worker on the account: do not describe it as contained.
- It is a secret of the `production` Environment (restricted to `main`, no
  reviewers), never repository-level, in a `wrangler.jsonc` or a tracked
  `.env`. That Environment also holds `DISCORD_TOKEN`; `plan` refuses a bot
  deploy without it.
- The `preview` Environment admits every branch and holds a copy of the token,
  with no reviewer: the `preview` label on a same-repository PR is the gate.
- Every deploy follows a merge of an up-to-date branch that passed `CI Success`.

## Accepted risks

- **No automatic rollback:** recovery is a dispatched deploy of a known-good
  `sha` ([deploy](../ARCHITECTURE.md#deploy)).
- **The CI token reaches the whole account**, RANDSUM's Workers included; with
  an agent PAT and no required human review, merging reaches production.
- **A labelled preview hands its branch the token**; only triage access can
  label, forks never ship, later pushes to a labelled PR ship too.

## Configuration outside the repo

Invisible to `grep`, set in the Cloudflare dashboard: Images Transformations,
**Always Use HTTPS** (both zones; HSTS alone protects only returning
browsers), **Minimum TLS 1.2**, **Tiered Cache** (Smart), **Block AI bots**,
and **Web Analytics** (the edge injects its beacon into every HTML page; each
`_headers` CSP allows its two origins; never add the beacon by hand). A missing
chunk's 404 is the Worker's `no-store`, not a dashboard rule.
`tools/smoke-production.sh` asserts the https 301s and the 404.

| Zone                | When host equals        | Then                                          |
| ------------------- | ----------------------- | --------------------------------------------- |
| `salvageunion.io`   | `www.salvageunion.io`   | 301 → `https://salvageunion.io` + path, query |
| `intheunionnow.com` | `www.intheunionnow.com` | 301 → `https://intheunionnow.com` + path, query |
| `intheunionnow.com` | `intheunionnow.com`     | 301 → `https://salvageunion.io/build` + path, query |

`_redirects` cannot do this (domain-level redirects are ignored silently).
Building one from the "Redirect from WWW to root" template: tick **Preserve
query string**, and **decline** its proxied `www` record (wrangler's
custom-domain attach creates it and 409s on a duplicate). `www` stays a Worker
custom domain, so a missing rule serves the site rather than an error.
