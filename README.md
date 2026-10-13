# SURef

[![CI](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/ci.yml/badge.svg)](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/ci.yml)
[![Deploy](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/deploy-cloudflare.yml/badge.svg?branch=main)](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/deploy-cloudflare.yml)
[![E2E (nightly)](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/e2e-nightly.yml/badge.svg?branch=main)](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/e2e-nightly.yml)
[![CodeQL](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/SalvageUnion-io/SU-SRD/actions/workflows/codeql.yml)

[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun&logoColor=000)](https://bun.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=fff)](https://react.dev)
[![Convex](https://img.shields.io/badge/Convex-backend-ee342f)](https://convex.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare&logoColor=fff)](https://workers.cloudflare.com)
[![Biome](https://img.shields.io/badge/lint%20%26%20format-Biome-60a5fa?logo=biome&logoColor=fff)](https://biomejs.dev)

[![SRD](https://img.shields.io/badge/SRD-salvageunion.io-1f2a44)](https://salvageunion.io)
[![In the Union now](https://img.shields.io/badge/ITUN-salvageunion.io%2Fbuild-1f2a44)](https://salvageunion.io/build)
[![JSON API](https://img.shields.io/badge/API-salvageunion.io%2Fapi-1f2a44)](https://salvageunion.io/api/)
[![Discord](https://img.shields.io/badge/Discord-join-5865f2?logo=discord&logoColor=fff)](https://discord.gg/kMwD2bWgtC)
[![Licence: Salvage Union OGL 1.0b](https://img.shields.io/badge/licence-Salvage%20Union%20OGL%201.0b-8a8a8a)](https://leyline.press/pages/salvage-union-open-game-licence-1-0b)

A Bun monorepo of tools for **Salvage Union**, the tabletop RPG by
[Leyline Press](https://leyline.press/).

| Workspace | What it is |
| --- | --- |
| [`apps/srd`](apps/srd) | The SRD reference site, [salvageunion.io](https://salvageunion.io): a static Vite SSG with React islands and a public [JSON API](https://salvageunion.io/api/). |
| [`apps/itun`](apps/itun) | In the Union now, the character builder and game manager at [salvageunion.io/build](https://salvageunion.io/build): React, TanStack Router, Convex. |
| [`apps/discord-bot`](apps/discord-bot) | The Discord bot: roll on tables, look up entities, play in an ITUN Game. |
| [`apps/su-assets`](apps/su-assets) | The Worker serving licensed entity artwork from R2. |
| [`apps/catalog`](apps/catalog) | The dev-only component catalog (`bun run stories`). |
| [`packages/salvageunion-reference`](packages/salvageunion-reference) | The schema-validated game dataset and its TypeScript ORM. |
| [`packages/component-lib`](packages/component-lib) | The shared React components and design tokens. |
| [`packages/itun-domain`](packages/itun-domain) | The schemas and rules ITUN, its Convex backend and the bot share. |
| [`packages/observability`](packages/observability) | The Sentry wiring for Workers and browsers. |
| [`packages/gates`](packages/gates) | The library behind the repo's gates, run from [`tools/`](tools). |

## Getting started

```bash
bun install        # Bun at the version package.json pins; also installs the git hooks
bun run dev        # the SRD
bun run dev:itun   # ITUN on a local Convex backend
bun run check      # every gate, ending in a pass/fail table
```

[AGENTS.md](AGENTS.md) is the command reference; each workspace's `CLAUDE.md`
adds what is particular to it. [docs/README.md](docs/README.md) maps a task to
its doc, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) records what is true
and why.

Commits are conventional, with a scope (`feat(itun):`, `fix(bot):`, `ci:`):
the squash title becomes each site's changelog. Report security issues through
[SECURITY.md](SECURITY.md).

## Licence and credits

The game data is published under the Salvage Union Open Game Licence 1.0b. It
was first copied from
[wfreinhart/salvage-union-tracker](https://github.com/wfreinhart/salvage-union-tracker)
and later forked from
[sbergot/salvageunion-data](https://github.com/sbergot/salvageunion-data).

Salvage Union is copyrighted by Leyline Press. Salvage Union and the "Powered
by Salvage" logo are used with permission of Leyline Press, under the Salvage
Union Open Game Licence 1.0b.
