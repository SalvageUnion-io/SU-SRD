# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) that document key design decisions made during the development of the SURef monorepo.

## What is an ADR?

An ADR is a document that captures a significant architectural decision along with its context and consequences. It helps future developers and AI agents understand the "why" behind design choices.

## ADR Template

When creating a new ADR, use the following template:

```markdown
# [Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded]

**Context:**
[Describe the issue motivating this decision]

**Decision:**
[Describe the decision that was made]

**Consequences:**
[Describe the positive and negative consequences of this decision]
```

## ADR Index

- [001: Monorepo with Bun Workspaces](./001-monorepo-with-bun-workspaces.md)
- [002: TanStack Query for Server State](./002-tanstack-query-for-server-state.md)
- [003: Relative Imports over Aliases](./003-relative-imports-over-aliases.md)
- [004: Entity Normalization Strategy](./004-entity-normalization-strategy.md)
- [005: SalvageUnion Reference ORM Pattern](./005-salvageunion-reference-orm-pattern.md)

## When to Create an ADR

Create an ADR when you make a significant architectural decision such as:
- Choosing a framework or library
- Defining architectural patterns
- Making trade-offs between different approaches
- Establishing conventions that affect multiple parts of the codebase

## Status Values

- **Proposed** - Decision is under consideration
- **Accepted** - Decision has been accepted and implemented
- **Deprecated** - Decision is being phased out
- **Superseded** - Decision has been replaced by another ADR
