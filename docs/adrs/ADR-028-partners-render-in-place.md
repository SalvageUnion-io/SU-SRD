# ADR-028: A Partner Renders In Place, As The Reference Entity It Already Is

## Status

Accepted. Supersedes [ADR-027](ADR-027-partners-owned-by-host.md), whose
**model** it keeps in full and whose **surface** it removes.

## Context

[ADR-027](ADR-027-partners-owned-by-host.md) established the right data model: a
partner is a `PartnerInstance` owned intrinsically by its host, with `hostSchema`
disambiguating the two grant paths. Nothing here disturbs that.

What it got wrong was the surface. It gave a partner a dedicated live sheet at
`/sheet/partner/:id`, and with it a sixth ontology hue, an `EntityRowType`, a
`BadgeTone`, a `SheetVariant`, an id-scan (`findPartner`), and a `SheetKind` that
had to be `EntityRef['type'] | 'partner'` because the vocabularies did not
otherwise meet. That is a large surface for a thing the same ADR describes as
having "no independent existence" and being "not a roster citizen".

Two facts make the sheet the wrong shape:

- **A partner is already a reference entity.** It is an `equipment` record or a
  `drones` record. `ReferenceEntityCard` renders exactly this today in the SRD:
  `titleOverride` puts the instance name over the stat block ("Shield Drone"
  over Big Brother Drone) and `droneLoadout` renders its systems and modules as
  listings _inside_ the card. The read-only half of what a partner sheet did
  already existed, in the shared library, for the same entities.
- **A separate sheet moves the partner away from the thing that grants it.** On
  the pilot sheet, `survey-drone` sat in the equipment list as an inert card
  while the actual drone lived behind a link in the Linked Units rail — the
  grant and the granted thing rendered as two unrelated objects in two regions.

## Decision

**A partner renders in place, on its host's sheet, as an ordinary
`ReferenceEntityCard` decorated with its instance state.** There is no partner
sheet and no partner route.

- **The card is not a new component in any meaningful sense.** `PartnerCard` is
  props assembly over `ReferenceEntityCard`, using seams that already existed:
  `titleOverride` for the instance name, `statsOverride` for SP/EP/Heat (a
  `StatItem` carrying an `onChange` renders as an editable +/- cell, so the
  card's own stat axis is the vitals editor), `controls` for the advisory cap
  badge, and `afterExtraContent` for the identity fields, the Hold,
  and the installed systems/modules. No new visual language was invented.
- **Capability is preserved, not reduced.** Everything the live sheet did — name
  / A.I. personality / appearance, SP/EP/Heat, derived tech level and slot
  counts, the cargo hold, per-item conditions, uses and repair — the card does.
  The sheet is gone; nothing it could do is.
- **It renders where the grant is.** A pilot-granted partner renders **in place
  of** its granting equipment card in the Inventory section: the slug and the
  instance are one thing to the player, so they are one card. A chassis-granted
  drone gets its own `Partners` region in the mech body — part of the mech's own
  kit, not a linked roster entity.
- **Always full width, never a masonry cell.** A partner card carries a nested
  loadout and a cargo hold; a column crushes it. Callers render it outside their
  `MasonryColumns`.
- **Multiplicity falls out of it.** One card per `PartnerInstance` means Mecha
  Packmaster's two Mecha Companions are two cards over one equipment slug, with
  no special case.
- **The sixth ontology hue is deleted.** `--color-partner` existed because
  partner rows sat directly beneath a mech's linked units, where "reads like a
  mech" stopped being harmless. With the rows gone the rationale goes: a partner
  now renders in its native tone, equipment on a pilot and drone on a mech.
- **`DroneSchema` gains `bonusPerTechLevel`**, mirroring `EquipmentSchema`. The
  two files that can supply a player-facing companion now describe scaling the
  same way, so _absence_ of the field is the statement "this stat block is flat"
  — a fact in the data rather than one the consuming app knows from which file a
  record came out of.

## Consequences

- `SheetKind` is exactly `EntityRef['type']` again. The one place the two
  vocabularies met is gone, and `EntityRef` still never needed widening.
- `findPartner` is deleted. Nothing addresses a partner by a bare id any more —
  a partner renders where its host is already in hand — so the linear scan
  ADR-027 accepted as the price of intrinsic ownership turns out not to be a
  price at all. `replacePartner` remains: writes still go through the host.
- **Four surface concepts are removed** (`--color-partner`, `EntityRowType`'s
  `partner`, `BadgeTone`'s `partner`, `SheetVariant`'s `partner`), along with
  `SheetPartner`, `PartnerSheetPage`, `PartnerRows`, `partnerRailItems` and
  `partnerRoleLabel`.
- **A partner is no longer linkable.** ADR-027's sheet could be sent as a URL;
  now the only way to a partner is its host's sheet. This is the intended
  reading of "no independent existence", but it is a real capability that was
  briefly there and is now not.
- **`StatItem` is exported from `component-lib`.** It was already the element
  type of the public `statsOverride` prop, so a consumer could not name the type
  of a prop it had to pass.
- **The Auto-Turret's hold is structurally absent, still.** Cargo capacity 0 plus
  the Immobile trait means it is not a container with nothing in it — the Hold
  and the Cargo stat are both omitted rather than rendered as `0/0`.
- **Carrier→carrier handoff remains unbuilt**, exactly as ADR-027 left it.

## Amendment — the grant is the lifecycle

ADR-027 and this record both describe a partner as a thing that "cannot outlive
what grants it", and both were right about the model and silent about the
lifecycle. That silence was load-bearing: **nothing in the app ever created a
`PartnerInstance`.** The only writers were `removePartner` and the two v11/v12
migrations, so every partner in existence was a converted legacy record.
Building a Little Sestra dropped its Sestra Drone and a Big Brother on the
DronTek pattern dropped all four, which made the `Partners` region on the mech
sheet live code that could never render; equipping a pilot's Survey Drone
produced an inert equipment card with no structure, energy or loadout.

`apps/itun/src/lib/rules/partnerGrants.ts` closes it, and settles the lifecycle
question the earlier records left open:

- **A partner is a projection of its grant, in both directions.** It is created
  when the grant appears and destroyed when the grant goes — unequip the Survey
  Drone equipment and the drone goes with it; change a mech's chassis and its
  drones change with it. Reconciliation runs on the pilot sheet's equipment
  toggle and on both wizards' create and `afterUpdate` paths.
- **There is therefore no standalone remove control**, and its absence is the
  point rather than an omission. A partner that could be dropped on its own
  would be unrecoverable, because nothing would ever grant it back. This is
  what replaces `removePartner` on both sheet action sets.
- **A mech's roster is exact; a pilot's is additive.** The pattern determines
  how many drones a mech fields and what each carries, so a pattern change
  re-cuts the roster and each drone's loadout — exactly as the wizard already
  re-cuts the mech's own. `pilot.equipment` records only *which* stat blocks are
  granted, never how many are fielded (Mecha Packmaster raises the Mecha
  Companion cap off a second ability), so a surplus instance is left alone.
- **Reconciliation never costs live state.** A surviving partner keeps its id,
  structure, energy, heat, conditions, name, appearance, A.I. personality and
  cargo. Re-seeding a drone's guns on a pattern change is correct; re-seeding
  its damage is data loss.
- **A drone's systems are the union of two sources.** Integrated hardware lives
  on the `drones` record (both player-facing drones carry a Hover Locomotion
  System); the fitted loadout lives on `pattern.drones[].systems`. A live drone
  needs both, which is a deliberate divergence from the SRD pattern card —
  that card is describing a pattern, not accounting for slots in play.
- **`partnerCap` gained a second raiser.** It knew Mecha Packmaster but assumed
  every stat block capped at one, so the moment Big Brother's four were seeded
  each would have read "4 of 1". The Big Brother's own controller fields four
  (False Flag p. 62).

One thing this does **not** fix: Mecha Packmaster's second Mecha Companion still
has no creation path, because a pilot's equipment list is a set and the cap
lives on an ability. It had none before either — the additive rule exists so
that reconciliation cannot destroy one if it ever gains one.
