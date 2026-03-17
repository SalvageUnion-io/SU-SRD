# ADR-003: Damage Target Selection

## Status

Accepted

## Context

Critical Damage and Reactor Overload can result in a Module or System being destroyed. The Salvage Union rules say the destroyed item is chosen "by the Mediator or at random."

Two implementation options were considered:

1. **Mediator-driven selection:** The Mediator picks the target from a separate view and pushes the choice to the affected player.
2. **Player-driven selection:** The affected player picks from their own equipment list, or taps "Random" for a random selection. The Mediator announces the result verbally.

## Decision

The damaged player selects the target from their own equipment list. A "Random" button is also available, which picks uniformly from valid intact or damaged equipment of the relevant type (Module or System).

The Mediator informs the player verbally what happened. The player applies it using the target picker in the damage modal.

This decision is consistent with ADR-001 (self-service model). Cross-player writes are not used.

## Consequences

- No remote target selection UI is required. The damage modal handles all target picking locally.
- The Mediator's role in destruction is social (announcement), not technical.
- Random selection is a client-side operation: `Math.random()` over the filtered equipment list at the time of the roll.
- If the mech has no valid targets (all equipment of the relevant type already destroyed), the player dismisses the prompt and notes it at the table.
- RLS remains unchanged. The player writes only to their own `entity_refs` rows.
