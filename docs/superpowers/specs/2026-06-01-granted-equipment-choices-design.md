# Granted Equipment, Choice Cards & Live Dataview — Design

**Date:** 2026-06-01
**Status:** Draft (awaiting review)
**Exemplar:** Custom Sniper Rifle (ability → equipment → choices)

## 1. Motivation

Several pilot abilities **grant a piece of equipment** that the player then **customizes through choices** (a weapon type, a set of modifications, a name). Today this is modeled across three loosely-coupled entities with duplicated prose, and rendered as a static "Choices" list that the player cannot interact with. We want:

1. The granted **equipment to be self-contained** — it carries its own base stats (Damage, Range) as a datavalue row.
2. **Choices rendered as interactive cards** with a Chosen / Not-Chosen status, that the player can select and deselect.
3. Selecting a choice to **live-edit the displayed dataview** — applying the choice's mechanical effect (add a trait, raise Range, add damage) and replacing the unresolved-choice prompt with the resolved value.
4. The **granting ability to collapse to a lead sentence + a `Grants` block** containing the full nested equipment, visible in compact mode, with the `Grants` header styled like the existing `Actions` divider.

The Custom Sniper Rifle is the richest example and drives this design, but the mechanic is general (see Scope).

## 2. Scope

### In scope

The "ability grants equipment with choices" pattern, sized from the data:

- **6 abilities** grant equipment → **5 distinct granted equipment**: Custom Sniper Rifle, Auto-Turret, Holo Companion, Mecha Companion, Survey Drone.
- **5 equipment carry `choices`**: Custom Sniper Rifle (Weapon Type + Modification), Custom Missile Launcher (Modification), Holo Companion / Mecha Companion (Name, Appearance), Auto-Turret (Name, A.I. Personality).
- Each granted equipment has a same-named `action`.

This design covers all of them, with two choice shapes:

- **Option choices** — `schemaEntities` (e.g. Ballistic / Energy) or `choiceOptions` (e.g. Rangefinder…). Render as **one selectable card per option**.
- **Free-text choices** — Name, Appearance, A.I. Personality. Render as a **card shell wrapping an editable field**.

### Out of scope (follow-ups)

- **Deleting the now-redundant `action` entities.** Once the equipment carries base stats and the ability nests the equipment, each same-named `action` is redundant. We stop rendering it under the ability, but we do **not** delete the action data here. Tracked as a follow-up.
- **Structured effects for non-stat options.** Options that are pure ability-text (Laser Guidance, Pinpoint Targeter, Compact Design) carry no structured effect — they toggle Chosen but do not alter the dataview. Encoding those as machine-applicable effects is a later enhancement.
- **Authoring base stats that cannot be derived from existing text.** See §5.2.

## 3. The unified mechanic

An **ability grants an equipment**. The equipment has a **base dataview** (datavalues + traits) plus **choices**. Choices render as **selectable cards** with a Chosen / Not status stamp.

Selecting a choice **live-edits the dataview**:

- An **unresolved** required choice shows as a prompt tag in the datavalue row, e.g. `Choose: Ballistic or Energy`.
- Once **chosen**, the prompt disappears and the choice's **effect** is applied to the row — adds the `Ballistic` trait, raises Range to Far, +1 SP damage, etc.

Selection state is **ephemeral local** in suref-web (lost on refresh) and **persisted** in ITUN — the same component, different state owner (controlled / uncontrolled).

The **granting ability** collapses to a **lead sentence** (the granted equipment's intro sentence) above a `Grants` divider (styled like `Actions`), with the **full nested compact equipment** beneath. No Actions section, no old Choices section. Visible in compact mode.

### Worked example — Custom Sniper Rifle ability

```
┌─ CUSTOM SNIPER RIFLE   (Sniper · L3) ───────────────┐
│  You acquire and train in the use of a Custom        │   ← lead: equipment's intro sentence (rendered once)
│  Sniper Rifle that only you can use.                 │
│                                                      │
│  ─────────────────  GRANTS  ─────────────────        │   ← SectionSeparator, "Actions"-style divider
│  ┌─ Custom Sniper Rifle (equipment, compact) ──────┐ │
│  │  DAMAGE · 2   RANGE · LONG   [Choose Ballistic   │ │   ← resolved dataview row + unresolved prompt
│  │                               or Energy]         │ │
│  │  WEAPON TYPE                                     │ │
│  │   [ Ballistic ]   [ Energy ]                     │ │   ← option cards, exclusive, status = Chosen/Not
│  │  MODIFICATION  (0/3)                             │ │   ← multi-select, capped at techLevel
│  │   [ Rangefinder ] [ Laser Guidance ] …           │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

After choosing **Ballistic** + **Rangefinder**:

```
│  DAMAGE · 2   RANGE · FAR   TRAIT · Ballistic        │   ← prompt gone; Range raised; trait added
│  WEAPON TYPE                                         │
│   [ Ballistic ✓ ]   [ Energy ]                       │
│  MODIFICATION  (1/3)                                 │
│   [ Rangefinder ✓ ] [ Laser Guidance ] …             │
```

## 4. Architecture & workstreams

Per the package **Data-First Principle**, model in `salvageunion-reference` before any UI. Four workstreams, in dependency order:

1. **Data model** — split redundant prose; author base `datavalues`; add structured `effects` to choice options.
2. **Resolver** — pure function in `salvageunion-reference`, shared and fully testable.
3. **Choice card + selection state** — new `suref-react` component; controlled with uncontrolled ephemeral default.
4. **Display rewire** — equipment renders resolved dataview + choice cards; abilities render lead + `Grants` (suppress own text + Actions).

ITUN then wires the controlled selection props to its persistence stores.

## 5. Workstream 1 — Data model (`salvageunion-reference`)

### 5.1 Split redundant prose

For equipment whose content paragraph *describes* its choices, split the paragraph and **keep only the intro sentence**; drop the choice-describing sentences (the cards are now the source of truth).

**Custom Sniper Rifle equipment** content becomes a single paragraph:

> "You acquire and train in the use of a Custom Sniper Rifle that only you can use."

Dropped: "Choose if it is a Ballistic or Energy weapon and it gains the respective Energy or Ballistic Trait." and "At each Tech Level you may choose an additional modification for your Custom Sniper Rifle."

Apply the same trim to the other granted equipment where their prose merely restates their choices.

> Editing JSON data: use text-level insertion, never automated formatters that reflow arrays (per repo data conventions).

### 5.2 Author base `datavalues`

Add a `datavalues` content block carrying base stats to each granted equipment, **derived from the entity's own text / its same-named action** where determinable.

- **Custom Sniper Rifle:** `Damage 2`, `Range Long` (already present on the action; copy onto the equipment).
- **Auto-Turret, Holo Companion, Mecha Companion, Survey Drone, Custom Missile Launcher:** derive from their text. Where a base value genuinely cannot be derived, leave it out and note it — do not invent values.

The datavalue block is the rendering target the resolver mutates (§6).

### 5.3 Structured `effects` on choice options

`ChoiceOptionSchema` is currently `{ label, value, description? }` (`.strict()`). Add an optional `effects` array; options without it toggle Chosen but do not change the dataview.

```ts
// objects.ts
const ChoiceEffectSchema = z
  .object({
    op: z.enum(['addTrait', 'setRange', 'addDamage']),
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(), // e.g. 'SP' for addDamage
  })
  .strict()

const ChoiceOptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    description: z.string().optional(),
    effects: z.array(ChoiceEffectSchema).optional(),
  })
  .strict()
```

The op vocabulary is the minimum the actual data needs:

| Op | Used by | Effect on dataview |
| --- | --- | --- |
| `addTrait` | Ballistic, Energy, Dum Dum (Anti-Organic), Anti-Matter (Deadly), Flashy, Silencer (Silent) | append a trait to the trait row |
| `setRange` | Rangefinder (Far) | replace the `Range` datavalue |
| `addDamage` | High Calibre Rounds (+1 SP) | increase the `Damage` datavalue |

`schemaEntities`-based options (Ballistic / Energy) need their effect attached too. Options: extend the choice to map an entity name → effects, or model Weapon Type as `choiceOptions` with effects rather than `schemaEntities`. **Recommendation:** convert Weapon Type to `choiceOptions` (Ballistic / Energy each with an `addTrait` effect) so a single options-with-effects path covers both choices. (Confirm during planning.)

### 5.4 Schema/data checklist

- Edit Zod in `lib/schemas/objects.ts`; rebuild via `bun run build:package` to regenerate `schemas/*.schema.json` (never hand-edit generated JSON).
- `bun run validate:all` for IDs / cross-refs / action refs.

## 6. Workstream 2 — Resolver (`salvageunion-reference`)

A pure function, the single source of truth for "what does this equipment look like given these selections":

```ts
type ChoiceSelections = Record<string /* choiceId */, string[] /* selected option values */>

type ResolvedView = {
  datavalues: DataValue[] // base row + applied effects, prompts removed once resolved
  traits: Trait[]         // base traits + addTrait effects
  prompts: Array<{ choiceId: string; label: string; text: string }> // unresolved required choices
}

function resolveChoiceView(entity: SURefEntity, selections: ChoiceSelections): ResolvedView
```

Behavior:

- Start from the entity's base `datavalues` + `traits`.
- For each choice: if unresolved and required, emit a prompt (`Choose: Ballistic or Energy`); if resolved, apply each selected option's `effects` (`addTrait` → traits; `setRange` → replace Range; `addDamage` → bump Damage).
- Deterministic, no I/O, unit-tested against the Custom Sniper fixtures.

This lives in the package so suref-web (ephemeral) and ITUN (persisted) share identical resolution.

## 7. Workstream 3 — Choice card + selection state (`suref-react`)

### 7.1 `ChoiceCard` component

A new card that **matches the entity card / nested-action style** (reuse `ActionCard`'s parent-accent body box; `SectionSeparator` for the choice-group header). Status stamp via the existing **`CalloutMetaStamp`** (neutral = Not Chosen; `rust` highlight = Chosen). Clickable to toggle.

- **Option card:** label + description (the free-text mechanic stays as the human-readable body), status stamp, toggle on click.
- **Free-text card:** the same shell wrapping an editable text field (Name / Appearance / A.I. Personality).

### 7.2 Selection state — controlled / uncontrolled

The card group is **controlled** via `selections` + `onSelectionChange`. With neither passed it **self-manages** ephemeral React state.

- **suref-web:** no props → self-managed, ephemeral, lost on refresh.
- **ITUN:** controlled props wired to persistence stores ("state objects").

Keeps `suref-react` data-source-agnostic (no Supabase).

### 7.3 Selection rules

- **Exclusive choice** (Weapon Type, `multiSelect` false): selecting an option deselects the other.
- **Multi-select choice** (Modification, `multiSelect` true, `constraints.scalesWithField: techLevel`): cap = resolved `techLevel`. **At the cap, remaining option cards are disabled** until one is deselected (no silent replacement). Show a `(n/max)` counter on the group header.

### 7.4 Retire the old choices UI

The static `WEAPON TYPE (choose one)` / `MODIFICATION (choose multiple)` rendering (`ReferenceEntityChoices` / `ReferenceEntityChoice` / `ReferenceEntityListDisplay` for the option path) is **replaced** by the new card group. Free-text path that previously used `choiceInputRenderer` is folded into the free-text card.

## 8. Workstream 4 — Display rewire (`suref-react`)

### 8.1 Equipment display

- Render the **resolved dataview row** (`resolveChoiceView`) — base stats + applied effects + unresolved prompts — via `DataValueDisplayView`.
- Render the **choice card groups** below.
- Drop the old choices section.
- Standalone equipment shows its intro-sentence prose + resolved row + cards.

### 8.2 Ability display — lead + `Grants`

On an ability that grants equipment:

- Suppress the ability's own description/content **and** its Actions section.
- Render a **lead line**: the granted equipment's intro sentence, rendered **once** (de-duplicated — the nested equipment does not repeat it).
- Render a **`Grants` divider** using `SectionSeparator label="Grants"` (matches the `Actions` divider exactly), replacing the current `ReferenceEntitySubheader label="Grants:"`.
- Render the **full nested compact equipment** (not header-only listing): resolved row + choice cards. Update `ReferenceEntityGrants` / `GrantedEntityListing` accordingly.
- **Visible in compact mode** — adjust the current gate (`shouldShowExtraContent = compact ? !hideActions : true`) so grants show in compact.

> Implementation note on the lead line: the ability surfaces its granted equipment's first content paragraph as the lead. If cross-entity text extraction proves awkward, the fallback is to drop the separate lead and let the nested equipment's intro sentence (rendered under the divider) serve as the intro. Primary design is lead-above-`Grants`, deduped.

## 9. Decisions log (from brainstorming)

| # | Decision |
| --- | --- |
| Effect depth | **Recompute stats too** — selecting a choice applies its mechanical effect to the displayed dataview (requires structured `effects`). |
| Base-stat data | **Derive from text and fill in** the missing base `datavalues` on granted equipment. |
| Choice rendering | **All option choices as cards** (Weapon Type + Modification); free-text choices as **card shells with a field**. |
| Weapon Type prompt | Unresolved → `Choose Ballistic or Energy` prompt in the row; resolved → prompt replaced by the applied effect (the trait). |
| Selection state | suref-web **ephemeral local** (lost on refresh); ITUN **persisted** via state objects. Controlled / uncontrolled component. |
| Ability layout | **Lead sentence + `Grants` block**; suppress own text + Actions; `Grants` divider matches `Actions`; visible in compact. |
| Lead line text | The **equipment's intro sentence** ("You acquire and train…"). |
| Content prose | **Split the paragraph; keep the intro sentence; drop the two choice-describing sentences** (cards are the source of truth). |
| Redundant actions | **Leave in place**; stop rendering under the ability; deletion is a follow-up. |
| Multi-select cap | **Disable at cap** (no silent replacement); show `(n/max)` counter. |

## 10. Risks & open questions

- **Weapon Type effect attachment** (§5.3) — `schemaEntities` vs converting to `choiceOptions`. Recommend converting; confirm in planning.
- **Deriving base stats** for non-sniper equipment (§5.2) — some may lack derivable values; flag rather than invent.
- **Lead-line cross-entity extraction** (§8.2) — confirm the primary vs fallback approach in planning.
- **ITUN persistence shape** — the selection persistence model in ITUN is named but not designed here; this spec defines the `suref-react` controlled interface it must satisfy, not the storage schema.

## 11. Testing

- **Resolver:** unit tests in `salvageunion-reference` — base row, single effect, multiple effects, unresolved prompt, exclusive vs multi, cap enforcement (Custom Sniper fixtures).
- **Schema/data:** `bun run validate:all`; `bun run build:package` regenerates JSON schemas cleanly.
- **Components:** `suref-react` tests (happy-dom) for `ChoiceCard` toggle, exclusive/multi rules, cap-disable, uncontrolled ephemeral state, controlled props.
- **Regression:** check both consuming apps (suref-web, ITUN) per the cross-package checklist — Tailwind `@source` paths and imports.
- Full suite via `/validate` before completion.

## 12. Sequencing

1. Data model (split prose, base datavalues, `effects` schema + data).
2. Resolver + tests.
3. `ChoiceCard` + selection state + tests.
4. Equipment display (resolved row + cards), retire old choices UI.
5. Ability display (lead + `Grants` nesting), update `ReferenceEntityGrants`.
6. ITUN persistence wiring.
7. `/validate`, regression check both apps.
