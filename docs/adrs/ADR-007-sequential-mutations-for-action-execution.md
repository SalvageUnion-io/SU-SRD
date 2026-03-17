# ADR-007: Sequential Mutations for Action Execution

## Status

Accepted

## Context

Action execution involves multiple writes:

1. Spend EP (`mechs.current_ep`)
2. Apply heat (`mechs.current_heat`)
3. Decrement action uses on the entity ref (if applicable)
4. Write to `change_log` (fire-and-forget)

Two approaches were considered:

1. **Sequential client-side mutations** via existing `useUpdateMech` and `useUpdateMechEntityRef` hooks.
2. **Atomic Supabase RPC** (`activate_action`) that performs all writes in a single database transaction.

## Decision

Use sequential client-side mutations via existing hooks. This matches the established pattern throughout `usePilotSheet` and the broader ITUN mutation layer.

The known failure mode — EP spent but heat not applied, or heat applied but uses not decremented — is accepted. This matches the existing risk profile for other multi-step mutations in the app (e.g., HP change followed by change log write). These edge cases are recoverable at the table with minimal disruption.

Damage application (Story 3) does use an RPC (`apply_mech_damage`) because multi-row condition updates require atomicity. SP reaching zero and triggering condition changes across multiple `entity_refs` rows cannot be safely done sequentially.

## Consequences

- No new Supabase functions are required for Story 1.
- Action execution mutations use `useUpdateMech` and `useUpdateMechEntityRef` as they exist today.
- Partial failure (e.g., EP spent but network drops before heat write) results in a slightly inconsistent sheet state. The player can correct this manually.
- If partial failures prove disruptive in practice, an atomic RPC can be introduced in a follow-up story without changing the public API or hook signatures.
- Damage application (Story 3) follows a different path and does use an RPC. The two stories are not required to be consistent on this point — they have different atomicity requirements.
