# SUSRD Docs

Intent → doc. Area links and "ADR-N" are entries in [ARCHITECTURE.md](ARCHITECTURE.md).

1. **UI component** — [ruleset.md](design-system/ruleset.md) (the laws); [display](ARCHITECTURE.md#display).
2. **Drawing an entity (forms, modes, the model)** — [entity-display-language.md](design-system/entity-display-language.md).
3. **Styling** — ADR-046; the working rules: [`.claude/rules/styling.md`](../.claude/rules/styling.md).
4. **Design sources, the origin's boards** — [sources.md](design-system/sources.md).
5. **Data flow or persistence** — [data flow](ARCHITECTURE.md#data-flow) to [stores](ARCHITECTURE.md#stores); ADR-030, ADR-034.
6. **Where a rule is enforced, combat** — [surfaces](ARCHITECTURE.md#surfaces) to [combat](ARCHITECTURE.md#combat); ADR-021, ADR-007.
7. **Dashboard** — [dashboard.md](architecture/dashboard.md); ADR-038, ADR-045.
8. **Mediator Dashboard, a Game's page** — [mediator-dashboard.md](architecture/mediator-dashboard.md); ADR-030, ADR-038.
9. **NPCs** — [npc-builder.md](architecture/npc-builder.md); ADR-044.
10. **Sharing** — ADR-032, ADR-036.
11. **Accounts, Games, Convex** — ADR-030; [deployments](ARCHITECTURE.md#deployments) to [conventions](ARCHITECTURE.md#convex-conventions); procedures: the [`convex-ops`](../.claude/skills/convex-ops/SKILL.md) skill.
12. **Invites, links between entities** — ADR-030, ADR-037.
13. **Feature names in copy (Game, Shelf, assign)** — [glossary.md](architecture/glossary.md).
14. **Discord bot** — [Game client](ARCHITECTURE.md#bot-game-client); [its CLAUDE.md](../apps/discord-bot/CLAUDE.md)
15. **Package API, public dataset** — [packages](ARCHITECTURE.md#packages) to [dataset API](ARCHITECTURE.md#dataset-api); ADR-040, ADR-043.
16. **Static pages (SSG)** — [`apps/web/ssg/DESIGN.md`](../apps/web/ssg/DESIGN.md); ADR-031, ADR-050.
17. **Hosting, CI, deploys** — ADR-033; [CI](ARCHITECTURE.md#ci) to [previews](ARCHITECTURE.md#previews).
18. **Dependencies** — [dependencies](ARCHITECTURE.md#dependencies) to [dead code](ARCHITECTURE.md#dead-code).
19. **Services, MCP, cloud sessions** — [MCP](ARCHITECTURE.md#mcp) to [identifiers](ARCHITECTURE.md#identifiers); [cloud-environment.md](ops/cloud-environment.md).
20. **A Salvage Union rule** — the [`rules-lookup`](../.claude/agents/rules-lookup.md) agent, or `bun run rules:find <term>`; setup is AGENTS.md's Rules text.
