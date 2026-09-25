# NPC Builder

> **Status:** Plan. Nothing here is built. The product decisions in §2 were made
> by the product owner; the open questions in §7 were not, and must be answered
> before the phase that depends on them starts.
>
> Read alongside [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md)
> (ownership: shelves and Games), [ADR-034](../adrs/ADR-034-account-required-persistence.md)
> (Convex is the only source of truth: never add a store that exists only on a
> device), [ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md) and
> [rules-engine-boundary.md](rules-engine-boundary.md) (enforcement modes).

---

## 1. What this is

A fourth player-owned entity in ITUN, next to pilots, mechs and crawlers: an
**NPC** that anyone can build with a wizard, keep on their shelf, add to a Game,
and assign to anything that needs an NPC, such as a crawler bay's crew slot or a
crawler type's special NPC.

It uses the NPC format the game data already has. The data has two NPC shapes,
and a built NPC combines them:

| Source | Where | Fields |
| --- | --- | --- |
| Standalone `npcs` entity | `packages/salvageunion-reference/data/npcs.json`, `NPCSchema` in `lib/schemas/entities.ts` | `name`, `hitPoints`, `damageType` (HP/SP), `actions[]`, `traits[]`, `bioSalvageValue`, `content` |
| Embedded `npc` object | `crawler-bays.json` (10 bays), `crawlers.json` (5 types), `NpcSchema` in `lib/schemas/objects/npc.ts` | `position`, `hitPoints`, `content`, and the text choices Name / Description / Keepsake / Motto |

ITUN already stores embedded-NPC state for crawler crew
(`CrawlerNpcStateSchema` in `apps/itun/src/lib/schemas/crawler.ts`: name,
current HP, description, facts, condition; keepsake and motto live in
`crawler.bayChoices`). The builder's identity fields reuse those names so that
assigning an NPC to a bay does not need to translate between two vocabularies.

### What this is not

- **Not the Mediator's opposition tray.** `encounterNpcs` stays what ADR-034
  says it is: Mediator-only, hidden from players, and an *instance of a
  reference entity* (`refSchema` + `refSlug`). A built NPC is a visible,
  owned entity like a pilot. The two can meet later (§7), but they are not
  merged.
- **Not custom-action authoring.** Actions and traits are picked from the
  reference data only.

---

## 2. Decisions

| Area | Decision |
| --- | --- |
| Who builds | Anyone, like any other entity. Not Mediator-only. |
| Ownership | Same as pilots/mechs/crawlers: on the owner's shelf (`gameId: null`) or in a Game. Same `publicRead` rule as the other entities (ADR-032). |
| Shape | Standalone: an NPC exists on its own and can be **assigned** to things that need an NPC. |
| Roster | A fourth **NPCs** column. |
| Actions & traits | **Reference only.** Chosen from `actions.json` and the trait list; no custom action text. |
| Creation | A **guided wizard**, on the same `NewEntityScreen` + `useWizardFlow` path as the other three, with a Blank mode alongside. |

---

## 3. Data model

### 3.1 `Npc` record

A new schema file, `apps/itun/src/lib/schemas/npc.ts`, which does not exist yet.

```ts
{
  id, createdAt, updatedAt, gameId, // the standard entity envelope

  // where it started (optional, informational: nothing re-derives from it)
  templateRef?: { schema: 'npcs' | 'crawler-bays' | 'crawlers'; slug: string }

  // identity (names match CrawlerNpcStateSchema / the embedded choices)
  name: string
  position?: string        // role title: "Greaser", "Raider"
  description?: string
  keepsake?: string
  motto?: string
  facts?: string[]

  // stat block (names match NPCSchema)
  hitPoints: number        // max
  damageType: 'HP' | 'SP'
  actions: string[]        // action NAMES from actions.json, never text
  traits: Trait[]          // the package's Trait schema
  bioSalvageValue?: number

  // play state
  currentHP?: number       // unset = full, as on pilots
  conditions?: string[]
}
```

Actions are stored by name, the same way `npcs.json` references them, so a
built NPC renders through the same resolution path as a reference one. Whether
a *slug* is the better key is open (§7). The package's rule is "slugs, never
UUIDs", and names are what the data uses today.

### 3.2 Assignment

A new soft-link type, **`npc-to-crawler`**, beside `mech-to-pilot` and
`pilot-to-crawler` in `SoftLinkSchema`. The link names a slot:

- `{ slot: 'bay', bayRef }`: the NPC crews that bay.
- `{ slot: 'type' }`: the NPC is the crawler type's special NPC.

A slot holds at most one NPC, and an NPC fills at most one slot. `SoftLinkSchema`
has no slot field today, so this is a schema change there too (§7, Q1).

While a link exists, the crawler sheet's bay card (`CrawlerBayCard` in
`src/components/sheet/CrawlerSheetItems.tsx`) renders the **linked NPC** in
place of the inline `crawlerBays[].npc*` fields. Removing the link falls back
to the inline crew, which is never deleted by linking. Whether linking should
*replace* or *sit beside* the inline crew is Q2 in §7. This is the recommended
answer.

### 3.3 Where each fact is recorded

A new entity type is not one file. Every item below has a real counterpart for
pilots/mechs/crawlers that the change must mirror:

| Layer | Change |
| --- | --- |
| Zod | the new `lib/schemas/npc.ts` (does not exist yet); add to `exportBundle.ts` |
| Store types | `EntityType`, `EntityForType`, `AssignableType` in `src/stores/types.ts` |
| IndexedDB | new `npcs` store in `src/lib/db/stores.ts`, schema version bump + migration in `src/lib/db/` |
| Convex | `npcs` table in `convex/schema.ts` with the same columns as `pilots` (`gameId`, `ownerId`, `appId`, `publicRead`, `body`, `updatedAt`, the three indexes); `NpcSchema` in `PARSERS` (`convex/model/entities.ts`); `entityRefType`, `softLinkType` and the change-log entity union extended |
| Sync | the entity backend mirror, `ShelfSync`, claim/move-to-Game, legacy-migration exclusions |
| Change log | `ChangeLogEntityTypeSchema` gains `'npc'` |
| Public sheet | `/p/:kind/:appId` accepts `npc` if `publicRead` applies (ADR-032) |

`tools/check-convex-codegen.ts`, `bun run check:schemas` and the export/import
round-trip tests are the guards that will say when one of these was missed.

---

## 4. Surfaces

### 4.1 Wizard: `/npcs/new`

Route `src/routes/npcs/new.tsx`, same shape as `crawlers/new.tsx`: a loader
that preloads `npcs`, `crawler-bays`, `crawlers`, `actions` and `traits`, and
`?mode=guided|blank`. Guided steps:

1. **Template.** Start from a reference NPC (`npcs.json`), a crawler-bay crew
   role, a crawler-type NPC, or blank. Picked with `EntitySearcher` /
   `CatalogTile`. Choosing one pre-fills everything below it.
2. **Stats.** HP, HP-or-SP, bio-salvage value.
3. **Actions & traits.** Pick from the reference lists. Selected actions render
   as compact, header-only `ReferenceEntityCard`s (the repo's listing default).
4. **Identity.** Name, position, description, keepsake, motto, with
   `RollTableButton` (component-lib `components/wizard/`) wherever the data has a table to roll on.
5. **Review.** The finished card, then create.

Step gates live in `src/lib/rules/creation.ts` with the others. There are almost
none: this is GM-grade tooling (rules-engine-boundary.md's Adjudicate column),
so the wizard guides and pre-fills rather than enforcing a build budget. The
only hard gates are *name present* and *HP ≥ 1*.

Drafts persist through `wizardDraft.ts` like the others.

### 4.2 Sheet: `/sheet/npc/$id`

`src/routes/sheet/$kind/$id.tsx` gains `npc`. The sheet is:

- the stat block: `ReferenceEntityCard` over the NPC shaped as an `npcs`
  entity, which gives it the actor tone and action rendering it already has
  for reference NPCs;
- the identity panel: `NpcInset` + `NpcFactsEditor` from component-lib, the
  same components the crawler bay card uses;
- a current-HP tracker and conditions.

No new card shell. `display-system.md` has two and this uses them.

### 4.3 Roster

`src/components/roster/Roster.tsx` becomes four columns (Pilots / Mechs /
Crawlers / NPCs), filtered by the active container like the rest. The grid's
breakpoints are the real design question here; check at phone width before
calling it done.

### 4.4 Games

An NPC is added to a Game the same way a pilot is (`gameId` set, the
move-to-Game path). It appears on the player `GameScreen` roster like the other
entities. It does **not** appear in the Mediator's secret `NpcTray`; that tray
remains the Mediator's hidden instances (§1).

---

## 5. Phases

Each phase is one PR, stacked (see the `/stacked-pr` skill, `.claude/skills/stacked-pr/`; at three or
more layers, use `gh stack`).

| # | Phase | Contents | Gate |
| --- | --- | --- | --- |
| 1 | Entity | §3.1 schema, §3.3 persistence end to end (IndexedDB, Convex table + parser, sync, export/import, change log). No UI. | Round-trip tests: create → Convex → export → import; `check:schemas`, `check-convex-codegen` green |
| 2 | Sheet + roster | §4.2, §4.3, Blank create via `BlankCreateDialog` | An NPC can be created blank, edited, moved to a Game, and read back |
| 3 | Wizard | §4.1 | Every template kind pre-fills correctly (test per kind) |
| 4 | Assignment | §3.2 soft link, crawler bay card rendering, link/unlink controls | Unlinking restores the inline crew byte-for-byte |

Phase 1 is the only one with a one-way element: the Convex table. Adding a
table is reversible only while it holds no rows, so it lands first and alone.

---

## 6. What the automation boundary says

[ADR-007](../adrs/ADR-007-automation-boundary.md): bookkeeping is automatic,
permanent consequences need an explicit act. For NPCs that means:

- current HP is tracked and clamped automatically;
- an NPC at 0 HP is **shown** as down, never deleted or unlinked by the app;
- assigning an NPC to a bay never deletes the bay's inline crew.

---

## 7. Open questions

1. **Slot on the link.** `SoftLinkSchema` is `{ from, to, type }` today. Does a
   bay assignment add an optional `slot` field to every soft link, or does the
   slot live on the NPC record (`assignedBay`), keeping links slot-free?
   Recommended: a `slot` on the link. The link is the assignment, and splitting
   it across two records is how they drift.
2. **Replace or beside.** Does a linked NPC replace the bay's inline crew on
   the sheet, or render beside it? Recommended: replace while linked, fall back
   when unlinked (§3.2).
3. **Action key.** Store actions by name (what `npcs.json` does) or by slug?
   Names match the data; slugs survive a rename.
4. **Other assignment targets.** Crawler bays and crawler type are the only
   hosts of the embedded `npc` object in the data. Should a pilot be able to
   have an NPC recruit or companion (`actions.json` has **Recruit**, whose
   recruit is statted by the Mediator, and **Chimerium Beast Companion**)?
   Not in scope unless asked.
5. **Into the opposition tray.** Should a Mediator be able to drop a built NPC
   into their hidden `encounterNpcs` tray as an instance? It would need
   `EncounterNpc` to accept a built-NPC reference beside `refSchema`/`refSlug`.
   Not in scope unless asked.
