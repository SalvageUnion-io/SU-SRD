# SURef Docs

Intent → doc. "Areas N" and "ADR-N" are entries in [ARCHITECTURE.md](ARCHITECTURE.md).

1. **UI component** — [ruleset.md](design-system/ruleset.md) (the laws); Areas 21–22.
2. **Drawing an entity anywhere (forms, modes, the entity model)** — [entity-display-language.md](design-system/entity-display-language.md).
3. **Styling off Tailwind** — [tailwind-removal.md](design-system/tailwind-removal.md).
4. **Data flow or persistence** — Areas 9–12; ADR-030, ADR-034.
5. **Where a rule is enforced, combat** — Areas 17–20; ADR-021, ADR-007.
6. **Dashboard** — [dashboard.md](architecture/dashboard.md); ADR-038, ADR-045.
7. **Mediator Dashboard, a Game's page** — [mediator-dashboard.md](architecture/mediator-dashboard.md); ADR-030, ADR-038.
8. **NPCs** — [npc-builder.md](architecture/npc-builder.md); ADR-044.
9. **Sharing** — ADR-032, ADR-036.
10. **Accounts, Games, Convex** — ADR-030; Areas 14–16; procedures: the [`convex-ops`](../.claude/skills/convex-ops/SKILL.md) skill.
11. **Invites, links between entities** — ADR-039, ADR-037.
12. **Discord bot** — Areas 23; [its CLAUDE.md](../apps/discord-bot/CLAUDE.md).
13. **Package API, public dataset** — Areas 1–7; ADR-040, ADR-043.
14. **srd build** — [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md); ADR-031.
15. **Hosting, CI, deploys** — ADR-033; Areas 26–29.
16. **Dependencies** — Areas 30–32.
17. **Services, MCP, cloud sessions** — Areas 33–37; [cloud-environment.md](ops/cloud-environment.md).
18. **Domain transfer** — [domain-transfer.md](ops/domain-transfer.md) (one-off runbook).
19. **A Salvage Union rule** — `bun run rules:extract`, then grep `rules/extracted/*.txt` (cloud: the attached `su-rules` repo).
20. **Per-package guidance** — each workspace's `CLAUDE.md` loads when you work there; path rules in [`.claude/rules/`](../.claude/rules/).
