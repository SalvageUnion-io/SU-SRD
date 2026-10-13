# CLAUDE.md

@AGENTS.md

Claude-only additions to [AGENTS.md](AGENTS.md), imported above.

## `.claude/`

- **Rules** (`.claude/rules/`) and workspace `CLAUDE.md`s load automatically by path.
- **Skills** (`.claude/skills/`): `/convex-ops` (Convex setup, probes, rotations, repairs), `/open-pr` (PR title, body, cloud route, stacks).
- **Agents** (`.claude/agents/`): `rules-lookup`, `design-reviewer`, `gate-fixer`.

## MCP Servers

Servers, deployments and opt-in: [MCP](docs/ARCHITECTURE.md#mcp). `convex` targets the **local** deployment `bun run dev:itun` runs (`CONVEX_DEPLOYMENT` in `apps/itun/.env.local`); `context7` serves version-pinned library docs (this repo runs ahead of training data).

- [`.mcp.json`](.mcp.json) is **secret-free by design**: no auth headers, no tokens, no `${VAR}` placeholders.
- `claude mcp list` is the only way to know a server works. GitHub: the `gh` CLI; in a cloud session it is REST only (`gh api` or `mcp__github__*`) — [cloud sessions](docs/ARCHITECTURE.md#cloud).
