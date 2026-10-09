# SURef Monorepo

A Bun monorepo of tools for **Salvage Union**, the tabletop RPG by
[Leyline Press](https://leyline.press/):

- `apps/srd` — the static SRD reference site, [salvageunion.io](https://salvageunion.io),
  with a public JSON API ([salvageunion.io/api](https://salvageunion.io/api/)).
- `apps/itun` — In The Union Now, the character builder and game manager.
- `apps/discord-bot` — the Discord bot: roll on tables, look up entities, play
  in an ITUN Game.
- `apps/su-assets` — the Worker serving licensed entity artwork.
- `packages/salvageunion-reference` — the schema-validated game dataset and its
  TypeScript ORM; `packages/component-lib` — the shared React components;
  `packages/observability` — the Sentry wiring.

## Working in it

[Bun](https://bun.com) at the version `packageManager` pins in
[`package.json`](package.json), then `bun install`, which also installs the git
hooks. [CLAUDE.md](CLAUDE.md) is the one command reference: dev servers, the
`bun run check` gate, tests, hooks and how changes merge. Each workspace's own
`CLAUDE.md` adds what is particular to it. [docs/README.md](docs/README.md)
maps a task to the architecture section or decision record to read.

Commits are conventional, with a scope (`feat(itun):`, `fix(bot):`, `ci:`):
the squash title becomes the site changelogs. Security reports go through
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
