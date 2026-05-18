# Ontology updates — itun-revamp-wave-3

## Proposed terms

- **Pilot wizard** — Multi-step or tabbed form for assembling a complete pilot (class, abilities, equipment, motto/keepsake/appearance, roll-table results). Standalone — no mech/crawler prompt.
- **Mech builder** — Chassis-first form: chassis selector → systems/modules grid → cargo. Enforces capacity/scrap/cargo rules via the Wave 1 utilities. Auto stand-in pilot on preview.
- **Crawler builder** — TL-first form: tech level → bays → systems. No pilot assignment required.
- **Dashboard** — Entry-point listing route showing existing pilots/mechs/crawlers with delete affordance per item. The user's home base for managing builds.
- **ConditionToggle** — Shared component for setting intact/damaged/destroyed on individual items (mech systems/modules, pilot equipment). State persists via entityStore.update.

## Reused terms

(All prior wave terms: entityStore, workspaceStore, SoftLink, EntityRef, Soft warning, App shell)

## Notes

- 5 new terms in Wave 3 brings the total to 13 proposed terms across Waves 0-3.
- Pilot/Mech/Crawler builders form the "MVP build flow" — together they make the app fully usable for solo character creation. Sheet view (Wave 4 / M2) makes builds usable AT THE TABLE.
