# ADR-022: Per-Entity Change Log (Provenance) & Stat Overrides

## Status

Accepted — **built**: the `changeLog` store (`apps/itun/src/lib/db/changeLog.ts`,
schema in `lib/schemas/changeLog.ts`) is written at the `entityStore.update`
chokepoint and read through `ChangeLogDrawer` behind the sheet menu; Live-Sheet
cap overrides ship with the derived-baseline callout and revert. Replay/time-travel
is still unbuilt. Subordinate to
[ADR-021](ADR-021-itun-surface-taxonomy.md), which establishes the surface/mode
model this ADR serves.

**Amended 2026-07** — an override is now an **absolute pin**, not a signed delta
in the same field the rules derivation reads. See
[Amendment](#amendment-2026-07-overrides-become-absolute-pins); the amendment is a
hard prerequisite for
[ADR-029](ADR-029-contribution-model-and-stat-provenance.md).

## Context

[ADR-021](ADR-021-itun-surface-taxonomy.md) makes the **Live Sheet** a Free-Edit
surface: players may override caps, bypass lifecycle costs, and hand-edit state to
patch reality at the table. Two capabilities fall out of that decision and need
their own record:

1. **Overrides must be distinguishable from derived values.** If a player pins max
   SP above its computed value, the sheet has to show that the number is an
   override, not a derivation — and ideally let them revert.
2. **Manual edits need provenance.** The whole point of Free Edit is off-rules
   change. Six months later, "why does this mech have 4 extra cargo?" must be
   answerable. Enforced Dashboard transactions deserve the same trail. Without a log,
   the free surface becomes an un-auditable one.

Both touch the IndexedDB persistence layer
([ADR-002](ADR-002-indexeddb-idb-zod.md),
[ADR-003](ADR-003-zustand-hydration.md)) and are event-sourcing-shaped, so they
are a distinct decision from the surface taxonomy.

## Decision

### Change Log (the provenance log)

The player-facing name for the provenance log is the **Change Log**.

**Every mutation to a player entity, on every surface, appends to a per-entity,
append-only Change Log** — _all_ changes, not just overrides. Both classes are
recorded, each tagged with its provenance:

- **Transaction** entries — enforced lifecycle events from Guided Creation / Guided
  Play (`spent 3 scrap to install Coilgun`, `Push: +2 heat, Heat Check → 14`).
- **Override / manual** entries — free edits from the Live Sheet
  (`manual override: currentHeat → 0`, `cap override: maxSP 12 → 16`,
  `installed Coilgun (no cost)`).

Properties:

- **Append-only and ordered** — entries are never mutated or deleted in place; the
  log is the entity's history, not a cache.
- **Emitted at one chokepoint** — the entry is written where all persistence
  already funnels: the `entityStore.update` write-through
  ([ADR-003](ADR-003-zustand-hydration.md)). "Every mutation is logged" then holds
  by construction, not by remembering to log at each call site; a surface that
  mutates an entity outside the store is the visible anti-pattern, not a silent gap.
- **Replay-shaped, replay-deferred** — entries carry enough structure
  (target field, before/after, provenance kind, source surface) to _reconstruct_
  state by replay. A player-facing replay / time-travel surface is **explicitly out
  of scope for now** — we build the log so replay is _possible_, not the replay UI.
- **Local only** — the log lives in IndexedDB and **does not travel with a
  published snapshot**. A snapshot stays a frozen, historyless, bare-entity payload
  ([ADR-004](ADR-004-snapshot-netlify-functions.md),
  [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md)). Provenance is a
  local-first, owner-only concern; it is not part of the share contract.
- **Viewed behind a menu, never inline** — the Change Log is reached from a menu
  (a "Change Log" drawer / item), **not rendered in the Live Sheet body**. The
  sheet shows current state; the full history lives one tap away. This keeps the
  free surface clean while still auditable.

### Stat overrides

**An overridden stat retains its derived baseline.** A cap/maximum override stores
both the pinned value and the value it would derive to, so the UI can render an
"overridden from N" callout and offer a one-click revert to derived. Overrides are
therefore **non-destructive and reversible**: reverting drops the pin and the stat
resumes tracking its derivation.

- **An override is an absolute pin, not a delta** (amended 2026-07 — see
  [Amendment](#amendment-2026-07-overrides-become-absolute-pins)). The stored value is
  the pinned maximum itself; the derived baseline is recomputed live and never
  persisted.
- The override marker is a small, visible graphical indicator on the affected stat
  — enough to tell an overridden value from a derived one at a glance. It appears
  **on the Live Sheet only**; a published snapshot renders the value plainly (a
  frozen view has no revert —
  [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md)). This inline indicator
  is distinct from the Change Log above: the indicator flags a _currently_
  overridden stat on the sheet; the Change Log (behind a menu) records _all_
  changes over time.
- Overrides apply to quantitative caps and maxima (per ADR-021). Structural
  coherence is never overridable; free state needs no override concept (it is
  already free).

## Consequences

- The Live Sheet's freedom becomes auditable rather than opaque — the audit trail
  is strongest exactly where the app stops enforcing.
- Overrides are safe to make: nothing is lost, the derived baseline is always
  recoverable, and the sheet never silently hides that a number was pinned by hand.
- New cost: schema + migration work in `src/lib/db/` (an append-only log store and
  an override representation on entity records). Routing the log entry through the
  `entityStore.update` chokepoint ([ADR-003](ADR-003-zustand-hydration.md)) keeps
  "every mutation is logged" structural rather than a per-call-site discipline —
  the requirement lives in one place instead of scattered across components.
- Replay is preserved as a future option at low present cost — the log is designed
  for it even though no replay surface ships now.
- Snapshot payloads and their privacy surface are unchanged: history stays local.

## Amendment (2026-07): overrides become absolute pins

### What was wrong

As built, an override is stored as a **signed delta** in the same field the rules
derivation reads — `maxSpModifier`, `maxHpModifier`, `maxApModifier`,
`maxEpModifier`, `maxHeatModifier`, `maxCargoModifier` — and the "derived
baseline" this ADR requires is recovered by **subtracting it back out**:

```ts
const derivedMaxSP = maxSP - (mech.maxSpModifier ?? 0) // MechSheet.tsx
```

So one field carries two incompatible meanings: the Free-Edit override pin _and_
the only channel through which any rules modifier reaches a maximum today (which
is why hand-entering Beefcake works at all, and why the Eldridge Coast pregens
write these fields directly).

The consequence is blocking. The moment a contribution applies automatically
([ADR-029](ADR-029-contribution-model-and-stat-provenance.md)), it must not be
written there — or a **rules-legal bonus renders as a hand override**, complete
with an "overridden from N" callout and an offer to revert it. The sheet would
actively lie. No data backfill can proceed until this is separated.

### The amendment

1. **An override stores the pinned value absolutely** (`max*Override`), not a
   delta. The derived baseline is recomputed live from contributions and is never
   persisted — which is closer to what this ADR always specified ("stores both the
   pinned value and the value it would derive to") than the delta ever was.
2. **`overridden` becomes an explicit flag**, not an inference. `VitalGauge` must
   not decide whether a value was pinned by comparing two numbers.
3. **Rules modifiers are never persisted on the entity.** They are derived
   contributions, resolved at read time.
4. **An override appends to the breakdown; it never replaces it.** The provenance
   panel shows every derived contribution, subtotals them, and applies the pin as
   the final line. This makes the retained baseline _visible_ rather than merely
   stored, and makes the revert self-explanatory: the player can see the number it
   falls back to and why that number is what it is.

### Migration — none required

Existing `max*Modifier` values are an unrecoverable mixture of hand overrides and
rules bonuses players typed in manually because the app would not apply them. A
migration cannot distinguish the two.

The original plan was to convert every existing value into an absolute pin. Two
findings during implementation ruled that out, and revealed a better option:

1. **A migration cannot compute a pin.** Turning a delta into an absolute value
   needs each record's full derived total — chassis `structurePoints`, the
   installed `statBonus` sum, tech-level base, injury penalties. A migration may
   only await IndexedDB operations on its versionchange transaction; awaiting
   reference data lets the transaction auto-commit mid-migration (see the header
   of `8-crawler-battle-sp-to-derived.ts`, which hardcodes frozen snapshots for
   exactly this reason). Deferring the conversion to hydration instead would make
   the result depend on _when_ the user next opened the app — a player who
   upgraded across the contribution work would have their hand-entered bonus
   converted against a derivation that already included the real one.
2. **A pin stops tracking derivation — that is what a pin is for.** Converting
   every legacy modifier into a pin would freeze that maximum permanently. The
   affected population is precisely the players who hand-entered Beefcake because
   the app would not apply it; they would be the ones whose sheets then _ignored_
   Beefcake once it became a real contribution.

**Decision: split the two meanings into two fields and migrate nothing.**

- `max*Modifier` keeps its stored values and its current arithmetic, and is
  re-documented as what it has always actually been: a **manual adjustment**
  that contributes to the derived total.
- `max*Override` is the new **absolute pin**, written only by the Live Sheet's
  override control from this point on.

This is lossless by construction — not one stored byte changes and not one
displayed number moves — and it needs no migration, no hydration pass, and no
version-skew reasoning. The legacy adjustment keeps composing with future
contributions instead of freezing them out, and once the provenance panel lands
it appears as its own labelled line (`Manual adjustment +6`), so a hand-entered
bonus that duplicates a real one becomes **visible and removable** rather than
silently doubled.

The five Eldridge Coast pregens are the unambiguous case in the other direction:
those are **authored content**, not player overrides, and become real
contributions rather than manual adjustments. `eldridgeCoast.ts` said so in its
own header (that seed module was deleted in
[ADR-030](ADR-030-accounts-games-server-of-record.md) Phase 0; the quotation is
preserved from git history because the argument still stands) — "class/ability bonuses ... are encoded via `maxHpModifier` /
`maxApModifier`" — which is precisely the conflation this amendment removes.
`pilotInventory.ts` carries the same admission for the third field ("base 6 +
`maxInventorySlotsModifier` (Beefcake +4)"), a bonus no UI can even write today.

### Also fixed alongside

Three gaps in this ADR's own "every mutation is logged" guarantee, all found by
inspection and none of them behavioural changes to the log's design:

- `kind: 'transaction'` is defined in the schema, documented at
  `entityStore.ts`, and badged in `ChangeLogDrawer` — but **emitted nowhere**. Every
  Dashboard lifecycle transaction currently logs as a manual edit.
- `source` is **never passed** by any call site; every persisted entry reads
  `'unknown'`.
- `entityStore.transfer()` performs cross-entity writes and **never calls
  `emitChangeLog`**, so cargo stow/load and scrap hand-offs leave no trace. This is
  the one true hole in the chokepoint guarantee.
