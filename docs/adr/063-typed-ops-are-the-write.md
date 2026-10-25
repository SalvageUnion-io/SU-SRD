# ADR-063: Typed Ops Are the Write

Decided 2026-10-25 for 4.5.0 (the clean-sheet plan, tracker #1798; Jrvs:
"this is a plan", a stepwise migration). Built on Convex by #1778 and #1779,
so the move to Cloudflare rooms (#1781) copies data instead of redesigning it.

- **Amends** [ADR-008](../ARCHITECTURE.md#decisions): one op is one atomic
  change to one unit, and a transfer is one atomic batch of ops.
- **Amends** [ADR-022](../ARCHITECTURE.md#decisions): the Change Log is the
  op log, not a record written beside the write.
- **Amends** [ADR-030](030-accounts-games-server-of-record.md) §4: a proposal
  is an op in `proposed` state on the target's unit; and §1: offline, an op
  on the player's own unit is queued, not blocked (decision 9).
- **Replaces** [ADR-058](058-device-copy.md)'s read-only device copy: the
  copy stays, and the player edits it offline (decision 9).

## Context

A write today replaces a whole entity body (`v.any()`, Zod-parsed per
mutation) and then, separately, the client appends one `changeLog` row per
field it moved. The log describes the write; it is not the write. A lost
append loses history, a stale body is refused by a row version
(`staleWrite.ts`), a crawler alone merges its patch, a proposal is applied by
its own mutation, and a Downtime step is kept from applying twice by its own
bookkeeping (`downtime.claimStep`, `claimed`, `doneSteps`). Undo and an
offline queue would each be one more mechanism.

## Decision

1. **A unit** is one pilot, mech, crawler or NPC: a row with a body. Its
   body changes only through an **op**:

   | Field     | Meaning |
   | --------- | ------- |
   | `id`      | Minted by the author's client, stable: sending it twice is a no-op. |
   | `unitId`  | The unit's app id. |
   | `seq`     | The unit's next sequence number, assigned when the op is applied; none while proposed or declined. |
   | `baseSeq` | The `headSeq` of the copy the author edited. |
   | `author`  | The account that wrote it. |
   | `at`      | When it was authored. |
   | `kind`    | ADR-022's `transaction`, `override` or `manual`. |
   | `source`  | The surface it came from (`surfaceProvenance.ts`). |
   | `state`   | `applied`, `proposed`, `declined` or `superseded`. |
   | `patch`   | Top-level body fields and their new values. |
   | `before`  | The values those fields held, written when the op is applied. |
   | `reason`  | Optional, the Mediator's words on a proposal. |

2. **`applyOp(unit, op)` returns the next unit or a refusal.** It is a pure
   function in `game-domain`, run by the client to show the result at once
   and by the server to decide it; the server's answer wins. It merges the
   patch, parses the result with the unit's schema, and refuses an op whose
   patched fields an op after `baseSeq` has already changed. Fields nobody
   else touched merge, as a crawler's patch does today (ADR-030 §5). Game
   rules stay where ADR-021 puts them: the surface checks a lifecycle
   transaction before it authors the op, and Free Edit authors overrides.
3. **The server applies an op in one mutation:** it checks who may write the
   unit, runs `applyOp`, stores the op with its `seq` and `before`, and
   writes the new body with `headSeq = seq`. Nothing is written for a
   refusal. A transfer (cargo, scrap) is one batch of ops on several units,
   applied all or none.
4. **A unit's body is a snapshot**: its applied ops folded in order, cached
   with its `headSeq`. Every body written before this ADR is its unit's
   snapshot at seq 0, so no history is lost and nothing is backfilled.
5. **A proposal is an op in `proposed` state** on the target's unit. Only the
   unit's writer (its assigned member, ADR-055) may apply it, which runs it
   through decision 3; declining marks it `declined`. ADR-030 §4 holds by
   construction: no path applies a proposal for the player, and a newer
   proposal on the same field still supersedes the older.
6. **A Downtime step is an op with a stable id** per pilot and step, so
   applying it twice is a no-op and the claim bookkeeping goes.
7. **What is not an op.** Rolls and the Mediator's alerts ("Tell the table")
   are a Game's feed, not changes to a unit. Container moves and assignment
   (`gameId`, `ownerId`, links) are server state about where a unit is
   (ADR-030 §2, ADR-037) and keep their own mutations and log rows, which the
   drawer reads beside the unit's ops. A body field that only bookkeeps (the
   `updatedAt` stamp) never conflicts.
8. **ADR-007 maps directly.** A destructive change is only ever an op its
   player authors; automation authors none.
9. **Offline, ops wait in an outbox** (Jrvs 2026-10-25: play your own units
   offline; Game-wide acts stay online). Disconnected, an op on the player's
   own pilot, mech or NPC is kept on the device beside the device copy,
   stamped with the account, and shown at once; an offline reload folds it
   over the copy. On reconnect the outbox goes up in
   the order made (`ops.replay`): each op runs through decision 3 against its
   `baseSeq`, and one no longer legal is kept `declined` with why, and the
   sheet says so. A crawler, a roll, a seat, a proposal, Downtime, a move or
   a transfer still needs the connection. Single-writer units (ADR-055) are
   why this needs no merge engine.

## Consequences

- The Change Log drawer reads ops; history cannot drift from the body.
- Undo is a new op carrying an op's `before`; it is not built by this ADR.
- `ops.replay` takes an outbox's ops on the server; the client's queue
  follows the local replica (#1791), and `e2e/app-offline.e2e.ts` then pins
  an offline edit surviving a reload and reaching the server.
- The stale-whole-body refusal becomes a field conflict: a second device's
  edit to a different field no longer bounces.
- On Cloudflare rooms (#1781) each room keeps its units' op log in SQLite and
  runs the same `applyOp`; the data move copies ops and snapshots.
