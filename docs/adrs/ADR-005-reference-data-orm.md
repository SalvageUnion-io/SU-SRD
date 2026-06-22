# ADR-005: Game-Data ORM — Zod as Source, Generated JSON Schema, Lazy Data Loading

## Status

Accepted

## Context

Every app consumes the same Salvage Union reference data (chassis, systems,
modules, equipment, abilities, NPCs, roll tables, …). That data needs to be:
typed at the call site, validated against a schema, queryable by id/slug/cross-
reference, and shareable across a static site, a React app, and a Node Discord
bot — without each app re-implementing access or shipping the whole dataset when
it only needs part of it.

## Decision

`packages/salvageunion-reference` is a **typed ORM over a schema-validated JSON
dataset**:

- **Zod schemas (`lib/schemas/`) are the source of truth.** `*.schema.json`
  files are **generated** from them by `bun run build:package`; they are never
  hand-edited. `dist/` is likewise generated.
- Models extend `BaseModel<T>`, are created via `ModelFactory`, and are reached
  through static accessors: `SalvageUnionReference.Chassis.find(...)`, etc.
- **Data JSON is imported lazily/dynamically** so consumers code-split and don't
  pull the entire dataset eagerly; Zod schemas stay statically imported.
- Consumers must `preload(...)` the schemas they use before synchronous data
  access (the Discord bot preloads everything at startup).
- All Zod usage goes through `lib/zod.ts`, which configures CSP-safe parsing (see
  [ADR-013](ADR-013-csp-zod-jitless.md)).

## Consequences

- One change to a Zod schema updates types, runtime validation, and the
  generated JSON Schema together — no drift between them.
- Apps pay only for the data they load; the dataset doesn't bloat every bundle.
- Access is uniform and typed across all consumers (web, ITUN, bot), and the data
  layer carries no UI or backend dependency, which lets rules logic build on it
  ([ADR-006](ADR-006-pure-rules-logic.md)).
- The build step is a hard prerequisite: apps can't resolve types until
  `bun run build:package` has run. This is the most common first-run gotcha.
- Forgetting `preload` surfaces as empty/missing data at runtime rather than a
  type error — a known sharp edge of lazy loading.
