# ADR-023: Drone/Companion Equipment Hosts an Installed Systems/Modules Loadout

## Status

Accepted.

## Context

Some Salvage Union pilot abilities (Mecha Companion, Survey Drone, Auto-Turret)
`grants` a same-named **equipment** entity that is drone-chassis-like: it carries
its own `structurePoints` / `energyPoints` / `heatCapacity` / `systemSlots` /
`moduleSlots` / `bonusPerTechLevel`. In play these companions are built up with
Systems and Modules, exactly like a mech — but ITUN modeled them either as
standalone mechs (unresolved "chassis", 0 base stats) or as plain pilot equipment
with no place to record an installed loadout.

The reference `choices` mechanism ([ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md))
resolves only stat-modifying effects and free text, so it cannot represent a
browsable, per-owner list of installed Systems/Modules rendered as cards. Building
that into the shared choice layer would be a large change to `suref-react`.

## Decision

A pilot's granted drone/companion equipment carries a **real installed loadout**
stored per equipment instance on the owning pilot, edited through the **same
"Add System / Add Module" collection UX** mechs and the crawler Armament Bay
already use — not the choice mechanism.

- **Persistence (ITUN):** a new additive-optional `Pilot.equipmentLoadouts`
  field — `Record<equipmentSlug, { systems: string[]; modules: string[] }>` —
  mirroring the existing `equipmentChoices` / `equipmentConditions` per-slug maps.
  Absent reads as no loadout; no DB migration; it rides through snapshots with the
  pilot. Keyed by slug, so two of the same drone slug on one pilot share an entry —
  an accepted limitation identical to `equipmentChoices`.
- **Identity stays on `equipmentChoices`.** Name / Appearance / A.I. Personality
  remain free-text choices on the equipment; the loadout store is purely
  `{ systems, modules }`.
- **Rendering (ITUN-local, no `suref-react` change):** a `PilotEquipmentLoadout`
  section reuses `SheetSectionCard` + `SheetPickerModal` + `EntitySearcher`
  (`mode="count"`) + a `useEquipmentLoadout` hook (analogue of `useEntityChoices`).
  It mounts on the equipment card when the resolved entity is a loadout host
  (data-shape check: `systemSlots`/`moduleSlots` present), so normal gear never
  shows it. Because nothing is added to `suref-react`, there is no generated-schema
  drift and no suref-web / discord-bot blast radius.
- **Slot budget is soft** ([ADR-007](ADR-007-automation-boundary.md)): the picker
  shows `used/max` from the equipment's own slot fields but never blocks — the
  Live Sheet is a Free-Edit surface ([ADR-021](ADR-021-itun-surface-taxonomy.md)).
- **Prerequisite fix:** `resolveEquipment` / `resolveAbility` matched by id/name
  only, so every seeded kebab slug (`survey-drone`, `remote-mine`, …) rendered as a
  raw chit. Both now use the slug-tolerant `matchesRef`, so seeded equipment and
  abilities resolve to full cards (the drone card must resolve to host a loadout).

Per-instance condition/uses tracking for installed drone systems/modules is
deferred (v1 renders them read-only) to keep scope tight.

## Consequences

- Companions become correctly-modeled granted equipment with their real
  loadouts, proper drone stats, and no "unknown chassis" artifact; they leave the
  mech roster.
- One new persistence field and two small ITUN modules (`useEquipmentLoadout`,
  `PilotEquipmentLoadout`); the reference data change is minimal (a `Name` choice
  added to Survey Drone for naming parity).
- Fixing the equipment/ability resolvers is a strict, visible improvement across
  all seeds (Starter Set included): seeded gear and abilities now render as cards.
- The slug-keyed loadout map cannot distinguish two identical drone slugs on one
  pilot — accepted, matching `equipmentChoices`; revisit with instance ids if a
  build ever needs it.
