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
  badge and removal, and `afterExtraContent` for the identity fields, the Hold,
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
