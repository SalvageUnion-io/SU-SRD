# Phase 2 — Pattern Builder + CRUD

## Scope

The Pattern Builder is the first interactive feature. It is fully self-contained (no pilot/mech/crawler dependencies), exercises the core DisplayCard-based UI pattern, and establishes the slot-constraint validation logic reused by later phases.

**What ships:**

- Pattern Builder: DisplayCard-based interface for designing abstract mech loadouts
- Pattern library view on dashboard
- Pattern CRUD (create, read, update, delete)
- Dashboard pattern section (replacing Phase 1 placeholder)

**What does NOT ship:**

- Pilot/Mech creation (Phase 3)
- Crawler/Campaign management (Phase 4)
- User invites, visibility sharing (Phase 5)
- Live editing, real-time (Phase 6)

---

## User Stories

### Pattern Builder

- **US-P1**: As a player, I can design abstract mech loadout templates by selecting a chassis and adding systems/modules — unrestricted by scrap costs but enforcing slot limits.
- **US-P2**: The pattern builder presents as a single large DisplayCard — the familiar header/content/footer card shape — with selected chassis, systems, and modules appearing as compact entity display listings inside it.
- **US-P3**: I must give my pattern a name before saving it to the database.

### Pattern Library

- **US-P4**: As a player, I can browse my pattern library on the dashboard.
- **US-P5**: As a player, I can edit an existing pattern (reopens the Pattern Builder pre-populated).
- **US-P6**: As a player, I can delete a pattern.

---

## Pattern Builder — Interaction Model

### Key Rules

- **No scrap cost restriction** — the pattern builder exists in an abstract world
- **Slot limits enforced** — no more systems than chassis `systemSlots`, no more modules than chassis `moduleSlots`
- **Name required to save** — save button disabled until a name is provided
- Selected chassis/systems/modules appear as **compact entity display listings** inside the DisplayCard

### DisplayCard Usage

The Pattern Builder is built on top of the extracted `DisplayCard` component from Phase 1. This establishes the pattern that **all major screens** in ITUN use DisplayCard as their container: pattern builder, pilot sheets, crawler views, wizard steps, and game manager views all share the same header/content/footer visual structure.

### Interaction Flow

1. **Select Chassis**: Modal/drawer with all chassis as compact entity listings. Clicking one sets it. Changing chassis clears incompatible systems/modules.
2. **Add Systems**: "+" button opens selection modal. Each system's `slotsRequired` tracked against chassis `systemSlots`. Button disabled at capacity.
3. **Add Modules**: Same as systems, against `moduleSlots`.
4. **Remove Items**: Click installed system/module -> remove option.
5. **Name**: Text input in header. Required for save (pattern builder mode).
6. **Save**: Persists to `mech_patterns` table with `pattern_items` JSONB.

### Unified MechBuilder Component

The Pattern Builder uses a **MechBuilder** component designed to be reusable across three contexts:

| Context             | Scrap Restriction   | Slot Restriction | Starting State            | Saves To                         | Phase   |
| ------------------- | ------------------- | ---------------- | ------------------------- | -------------------------------- | ------- |
| **Pattern Builder** | None                | Yes              | Empty or existing pattern | `mech_patterns`                  | Phase 2 |
| **Mech Creation**   | 20 TL1 scrap budget | Yes              | Empty (starting mech)     | `mechs` + `entity_refs`          | Phase 3 |
| **Mech Editor**     | Available scrap     | Yes              | Current mech loadout      | `mechs` + `entity_refs` (update) | Phase 3 |

The core component accepts constraint props to adapt its behavior. For Phase 2, only the Pattern Builder context is implemented. The scrap budget and tech level filter props exist in the type but are wired in Phase 3.

---

## Acceptance Criteria

### AC-1: Pattern Builder

- [ ] Builder presents as a DisplayCard (header/content/footer with themed colors)
- [ ] User can select a chassis from a modal showing all chassis as compact entity listings
- [ ] Selected chassis appears in the header with stats (SP, EP, HC, slots)
- [ ] User can add systems via modal — each shows as compact entity display listing inside the card
- [ ] User can add modules via modal — same compact listing presentation
- [ ] System slot limit enforced: cannot add more systems than chassis `systemSlots`
- [ ] Module slot limit enforced: cannot add more modules than chassis `moduleSlots`
- [ ] Multi-slot systems/modules (`slotsRequired > 1`) counted correctly
- [ ] No scrap cost restriction in pattern builder
- [ ] User can remove installed systems/modules
- [ ] Pattern name input — required for save (save button disabled without name)
- [ ] Changing chassis clears systems/modules if new chassis has fewer slots
- [ ] Footer shows slot usage summary

### AC-2: Pattern Persistence

- [ ] Save creates row in `mech_patterns` with correct `chassis_ref`, `name`, `pattern_items`
- [ ] `pattern_items` JSONB contains `[{schema_name, schema_ref_id, sort_order}]`
- [ ] Edit route loads existing pattern data into builder
- [ ] Update saves changes to existing pattern
- [ ] Delete removes pattern from database

### AC-3: Pattern Library

- [ ] Dashboard shows pattern section with grid of pattern cards
- [ ] Each card shows: name, chassis name, system/module count
- [ ] "Create a Pattern" button navigates to builder
- [ ] Click card navigates to edit
- [ ] Empty state message when no patterns exist
- [ ] Loading state with skeleton cards

### AC-4: Unified MechBuilder Component

- [ ] Component accepts `scrapBudget` prop (null = unlimited for pattern builder)
- [ ] Component accepts `techLevelFilter` prop (not used in Phase 2 but typed)
- [ ] Component accepts `entityFilter` prop (not used in Phase 2 but typed)
- [ ] Component accepts `nameRequired` prop (true for pattern builder)
- [ ] Same component shape will be reused for mech creation and mech editing in Phase 3
