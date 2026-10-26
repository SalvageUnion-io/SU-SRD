# SUSRD Docs

Intent → doc. Area links and "ADR-N" resolve in [ARCHITECTURE.md](ARCHITECTURE.md): an entry, or the Area whose headline names it.

1. **UI component** — [ruleset.md](design-system/ruleset.md) and [chrome.md](design-system/chrome.md) (the laws), [hard-rules.md](design-system/hard-rules.md) (gates); [display](ARCHITECTURE.md#display).
2. **Drawing an entity** — [entity-display-language.md](design-system/entity-display-language.md); chips and actions: [chips-and-actions.md](design-system/chips-and-actions.md).
3. **Styling** — ADR-046; the working rules: [`.claude/rules/styling.md`](../.claude/rules/styling.md).
4. **Data flow or persistence** — [data flow](ARCHITECTURE.md#data-flow) to [the replica](ARCHITECTURE.md#stores); ADR-030, ADR-034.
5. **Where a rule is enforced, combat** — [surfaces](ARCHITECTURE.md#surfaces) to [combat](ARCHITECTURE.md#combat); ADR-021, ADR-007.
6. **Play mode** — [play.md](architecture/play.md), its state and rules driver §14; ADR-051, ADR-038.
7. **A Game's page** — Play's: [play.md](architecture/play.md) §16; ADR-030, ADR-052.
8. **NPCs** — [npc-builder.md](architecture/npc-builder.md); ADR-044.
9. **Sharing** — ADR-032, ADR-036.
10. **Accounts, Games, the rooms** — ADR-030, ADR-064; [deployments](ARCHITECTURE.md#deployments) to [conventions](ARCHITECTURE.md#room-conventions); procedures: the [`site-ops`](../.claude/skills/site-ops/SKILL.md) skill.
11. **Invites, links between entities** — ADR-030, ADR-037.
12. **Feature names in copy (Game, Shelf, assign)** — [glossary.md](architecture/glossary.md).
13. **Discord bot** — [Game client](ARCHITECTURE.md#bot-game-client); [its CLAUDE.md](../apps/discord-bot/CLAUDE.md)
14. **Package API, public dataset** — [packages](ARCHITECTURE.md#packages) to [dataset API](ARCHITECTURE.md#dataset-api); ADR-040, ADR-043.
15. **Static pages (Astro)** — [`apps/web/astro/DESIGN.md`](../apps/web/astro/DESIGN.md); ADR-065, ADR-050.
16. **Hosting, CI, deploys** — ADR-033; [CI](ARCHITECTURE.md#ci) to [previews](ARCHITECTURE.md#previews).
17. **Dependencies** — [dependencies](ARCHITECTURE.md#dependencies) to [dead code](ARCHITECTURE.md#dead-code).
18. **Services, MCP, cloud sessions** — [MCP](ARCHITECTURE.md#mcp) to [identifiers](ARCHITECTURE.md#identifiers); [cloud-environment.md](ops/cloud-environment.md).
19. **A Salvage Union rule** — the [`rules-lookup`](../.claude/agents/rules-lookup.md) agent, or `bun run rules:find <term>`; setup is AGENTS.md's Rules text.
