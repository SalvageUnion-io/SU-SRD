# ADR-027: Partners Are Instances Owned by a Pilot or a Mech

## Status

Superseded by [ADR-028](ADR-028-partners-render-in-place.md). Supersedes
[ADR-023](ADR-023-drone-equipment-installed-loadout.md).

**The MODEL below still stands** — a `PartnerInstance` owned intrinsically by its
host, `hostSchema` disambiguating the two grant paths, derived tech level,
displayed-not-enforced caps, partners as cargo nodes. ADR-028 changes only the
**surface**: the dedicated live sheet at `/sheet/partner/:id`, the sixth ontology
hue, and the linked-unit rows described under "Surfaces" are removed in favour of
rendering a partner in place on its host's sheet.

## Context

Salvage Union has a category of granted thing that is mech-shaped without being a
mech. The Core Book states the same formula four separate times — Auto-Turret
(p. 29), Survey Drone (p. 48), Mecha Companion (p. 68), Sestra Drone (p. 128):

> \[It] uses the same rules as Mechs for attaching Systems and Modules; taking
> damage and being repaired; as well as Heat and Heat Checks. **Your \[partner]
> cannot Push.**

They act on their own turn, repair and refit through the normal mech channels,
and are re-acquired during Downtime if lost. We call these **Partners**.

ITUN modelled them in two unrelated half-measures, and neither could carry a
partner as a thing you could look at, link to, or load cargo onto.

**On the pilot side**, [ADR-023](ADR-023-drone-equipment-installed-loadout.md)
stored a companion's installed loadout in `Pilot.equipmentLoadouts`, keyed by
equipment **slug**. It named the single-instance restriction an accepted
limitation. It is not: **Mecha Packmaster (p. 69) grants two Mecha Companions**,
which under slug keying shared one loadout, one name, and one condition set. A
partner also had no current SP/heat, no conditions, no cargo, and no identity
beyond free text in `equipmentChoices`.

**On the mech side**, nothing existed at all. A chassis ability can field drones
— Little Sestra's Sestra Drone, Big Brother's four — and the reference package
models them, but `Mech` had no drone field, so building a Little Sestra in ITUN
silently dropped its drone.

Two further facts constrained the design:

- **Tech level is not the host's.** Pilot-granted partners take the **Union
  Crawler's** tech level and upgrade with it (Mecha Companion floored at Tech 3);
  mech-granted drones are fixed by their stat block and never scale.
- **Partners are cargo nodes.** The Load action reads "onto your Mech or an
  allied Mech", and partners use the mech rules, so they carry: Survey Drone 1,
  Mecha Companion 3, Sestra Drone 3.

## Decision

A partner is a **`PartnerInstance` owned by its host** — an additive-optional
`partners: PartnerInstance[]` on **both** `PilotSchema` and `MechSchema`.

- **One shape, two grant paths.** `hostSchema: 'equipment' | 'drones'` selects
  which reference file `hostRef` resolves against. This is load-bearing, not
  tidiness: **"Survey Drone" is a record in both files** — the player's partner
  (SP 2, EP 4, 3 system slots) and an opposition stat block (SP 1, nothing else).
  Resolving without it picks the wrong record roughly half the time.
- **Every instance carries its own `id`**, which is what fixes both multiplicity
  cases (Packmaster's two, Big Brother's four).
- **Ownership is intrinsic, not a soft link.** Deleting a host removes its
  partners with no orphan cleanup, and they ride through snapshots and export
  bundles with that host. A partner has no independent existence — it is granted
  by an ability and cannot outlive the thing granting it.
- **Tech level is derived, never stored** (`partnerTechLevel`), with the two
  branches above. `techLevelOverride` exists only as a Free-Edit escape hatch
  ([ADR-021](ADR-021-itun-surface-taxonomy.md)).
- **Per-host caps are displayed, never enforced** ([ADR-007](ADR-007-automation-boundary.md)).
  The cap is a property of the host's ability _set_ — Packmaster raises it — not
  a constant on the stat block.
- **Surfaces:** partner rows on both host sheets in a new sixth ontology tone
  (blue), and a live sheet at `/sheet/partner/:id`. **No index route**: a partner
  is not a roster citizen, and this falls out of not being in a store.
- **Cargo:** `cargoTransfer` is renamed from mech/crawler to **carrier/depot**.
  Nothing in its arithmetic ever cared which entity owned either side; a partner
  is a capped carrier in exactly the sense the reducer already meant.

## Consequences

- The Mecha Packmaster and Big Brother multiplicity bugs are fixed, and
  mech-granted drones exist in ITUN for the first time.
- **`EntityRef` is deliberately NOT widened.** A `partner` member would ripple
  into SoftLink, snapshots, export bundles and `deepStrip` for something that can
  never be either end of a link. `SheetKind = EntityRef['type'] | 'partner'`
  lives at the route — the only place the two vocabularies meet.
- **Lookup is a linear scan** over pilots and mechs (`findPartner`). This is the
  price of intrinsic ownership. The alternative — a fourth store — buys O(1) and
  pays in orphaned partners, a widened `EntityRef`, and a roster citizen to
  special-case out of every listing.
- **A pilot-granted partner now reads state two hops away** (pilot → crawler link
  → crawler tech level). An unlinked pilot degrades to the stat block's base
  level rather than throwing; a crawler upgrade changes its partners' stats.
- **A sixth ontology hue** (`--color-partner`) has cross-app blast radius. Blue
  rather than the mech sage because partner rows sit directly beneath a mech's
  own linked units; blue rather than `adversary` because that is the
  world/opposition tone and a partner is player-side.
- **`equipmentLoadouts` is deprecated but retained.** `PilotSchema` is `.strict()`,
  so deleting the field would fail the parse of every already-migrated record;
  and keeping it leaves the v11 migration reversible from a pre-v11 export.
  Removing it needs a follow-up migration that strips the key from stored pilots
  first — a separate, irreversible change.
- **Carrier→carrier handoff is not built.** The rules permit mech→allied-mech
  transfer and ITUN could not express it before partners either. It needs a
  target picker and an N-node reducer, so it is left visibly unbuilt rather than
  half-built.
