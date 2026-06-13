# ADR-001: Self-Service Combat Model

## Status

Accepted — **mechanics partially superseded by the local-first rebuild.**

> The _decision_ still holds: the app is a self-service shared character sheet
> that never crosses player write boundaries or enforces turn order. The
> _mechanism_ described below (Supabase RLS policies scoped to `user_id`,
> realtime subscriptions) no longer exists — ITUN is now local-first
> (IndexedDB, no auth, no backend; see [ADR-010](ADR-010-snapshot-backend.md)
> and [data-flow.md](../architecture/data-flow.md)). Read the references to
> "RLS", "`user_id`", and "realtime sync" below as historical context for why
> the self-service model was chosen, not as a description of the current
> implementation.

## Context

The combat loop requires a mutation model for resource spending (AP, EP, heat) and damage application. The options were:

1. Self-service: each player writes their own state. No server-side coordination.
2. Mediator-driven: the Mediator (GM) initiates mutations on behalf of players.
3. Turn-enforced: the server gates mutations behind a turn order check.

Salvage Union does not have a formal turn order enforced by rules. Initiative is tracked socially at the table. Any server-side enforcement would add complexity without matching how the game is played.

## Decision

Use a self-service honor system. Each player manages their own mech and pilot state. The app does not cross player write boundaries, does not enforce turn order, and does not require Mediator approval for any resource mutation.

The current RLS policies (owner-only writes, scoped to `user_id`) are correct and sufficient. No security-definer RPCs are needed for the combat loop. The Mediator sees all changes live via realtime sync but does not initiate them remotely.

The app is a shared living character sheet, not a game engine.

## Consequences

- RLS remains unchanged. No new policies.
- Realtime subscriptions already in `usePilotSheet` provide live visibility for all players at the table.
- Mediator cannot remotely apply damage or spend resources on behalf of a player. Players are always responsible for their own sheet.
- The failure mode is table etiquette, not a technical constraint. This is appropriate for a cooperative tabletop RPG.
- Any future multiplayer moderation features (Mediator view, damage proposals) are additive and do not require changing this model.
