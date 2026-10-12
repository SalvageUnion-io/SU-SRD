# SURef Docs

Intent → doc. "Areas N" and "ADR-N" are entries in [ARCHITECTURE.md](ARCHITECTURE.md).

1. **UI component** — [ruleset.md](design-system/ruleset.md) (the laws); Areas 21–22.
2. **Drawing an entity anywhere (forms, modes, the entity model)** — [entity-display-language.md](design-system/entity-display-language.md).
3. **Styling off Tailwind** — [tailwind-removal.md](design-system/tailwind-removal.md).
4. **Design refresh: phases, refit PRs, the origin's boards** — [refresh-ledger.md](design-system/refresh-ledger.md).
5. **Data flow or persistence** — Areas 9–12; ADR-030, ADR-034.
6. **Where a rule is enforced, combat** — Areas 17–20; ADR-021, ADR-007.
7. **Dashboard** — [dashboard.md](architecture/dashboard.md); ADR-038, ADR-045.
8. **Mediator Dashboard, a Game's page** — [mediator-dashboard.md](architecture/mediator-dashboard.md); ADR-030, ADR-038.
9. **NPCs** — [npc-builder.md](architecture/npc-builder.md); ADR-044.
10. **Sharing** — ADR-032, ADR-036.
11. **Accounts, Games, Convex** — ADR-030; Areas 14–16; procedures: the [`convex-ops`](../.claude/skills/convex-ops/SKILL.md) skill.
12. **Invites, links between entities** — ADR-039, ADR-037.
13. **Discord bot** — Areas 23; [its CLAUDE.md](../apps/discord-bot/CLAUDE.md), [ideas](architecture/discord-bot-refresh.md)
14. **Package API, public dataset** — Areas 1–7; ADR-040, ADR-043.
15. **srd build** — [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md); ADR-031.
16. **Hosting, CI, deploys** — ADR-033; Areas 26–29.
17. **Dependencies** — Areas 30–32.
18. **Services, MCP, cloud sessions** — Areas 33–37; [cloud-environment.md](ops/cloud-environment.md).
19. **Domain transfer** — [domain-transfer.md](ops/domain-transfer.md) (one-off runbook).
20. **A Salvage Union rule** — `bun run rules:extract`, then grep `rules/extracted/*.txt` (cloud: the attached `su-rules` repo).
21. **Per-package guidance** — each workspace's `CLAUDE.md` loads when you work there; path rules in [`.claude/rules/`](../.claude/rules/).
