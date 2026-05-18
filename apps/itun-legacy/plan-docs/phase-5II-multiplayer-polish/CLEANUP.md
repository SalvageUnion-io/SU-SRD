# Phase 5II — Wave 1 Cleanup Targets

Consolidated findings from automated audits of `apps/in-the-union-now/` and `packages/suref-react/`.

---

## Priority 1: Dead Code Deletion (~5 min)

### ITUN App

| Target               | File                         | Lines | Reason                                                                                                                                          |
| -------------------- | ---------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase.server.ts` | `src/lib/supabase.server.ts` | ~30   | Imports `@tanstack/react-start` which the app doesn't use. Zero consumers. Consider removing the `@tanstack/react-start` dep from package.json. |
| `diceStore.ts`       | `src/stores/diceStore.ts`    | 77    | Full Zustand store with roll logic. Zero consumers.                                                                                             |
| `validation.ts`      | `src/lib/validation.ts`      | 29    | Zod schemas never imported anywhere. Pattern validation happens implicitly.                                                                     |

### Orphaned Type Exports (`src/types/common.ts`)

| Type                   | Reason                                                |
| ---------------------- | ----------------------------------------------------- |
| `PlayerChoiceRow`      | Zero imports                                          |
| `ChangeLogRow`         | Zero imports (will be needed in Wave 3 — re-add then) |
| `PlayerChoiceInsert`   | Zero imports                                          |
| `CargoInsert`          | Zero imports                                          |
| `CampaignMemberInsert` | Zero imports                                          |

### Unused Function Exports

| Function                    | File                         | Action                                                                    |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `isNotFoundError`           | `lib/errors.ts:60`           | Delete                                                                    |
| `areWeaponSlotsFilled`      | `lib/crawlerUtils.ts:182`    | Delete                                                                    |
| `validateEnvVars`           | `lib/env.ts:77`              | Delete                                                                    |
| `getMaxSpBonus` (re-export) | `lib/crawlerUtils.ts:187`    | Remove re-export (direct import from salvageunion-reference already used) |
| `computePaleColor`          | `lib/pilotActionUtils.ts:61` | Remove `export` keyword (file-private)                                    |

---

## Priority 2: DRY Violations (~45 min)

### 2a. Unify `PilotStatControl` + `CrawlerStatControl`

**Files:**

- `src/components/pilots/PilotStatControl.tsx` (48 lines)
- `src/components/games/CrawlerStatControl.tsx` (56 lines)

**Problem:** Byte-for-byte identical except `CrawlerStatControl` has optional `bottomLabel` prop.

**Fix:** Create `src/components/shared/StatControl.tsx` with optional `bottomLabel`. Replace both imports. ~15 min.

### 2b. Extract NPC Choice Field Rendering

**Files:**

- `src/components/games/CrawlerBaysSection.tsx` (lines 17-30, 148-199)
- `src/routes/_authenticated/games/$gameId/crawler.tsx` (lines 384-394, 484-530)

**Problem:** Duplicated type `BayNpcTextField`, constants (`EDITABLE_CHOICE_TYPES`, `CHOICE_ORDER`, `CHOICE_ROLL_TABLE_FALLBACK`), and ~50 lines of rendering switch logic.

**Fix:** Extract shared constants + `NpcChoiceField` component into `src/components/games/npcFieldUtils.ts`. ~30 min.

### 2c. Move `updateEntityRef` to Shared Location

**File:** `src/lib/api/pilotApi.ts:99-112`

**Problem:** Generic `entity_refs` function in pilot-specific API. Imported by `useMechs.ts` and `useCrawlers.ts` with misleading import path.

**Fix:** Move to `src/lib/api/entityRefApi.ts`. Update 3 import sites. ~10 min.

---

## Priority 3: suref-react Cleanup (~60 min)

### 3a. Prune Barrel Exports (`src/index.ts`)

Remove 14 unused exports (no consumer app imports them):

| Export                             | Used by                    |
| ---------------------------------- | -------------------------- |
| `InteractiveStatDisplay`           | Tests only                 |
| `SheetInput`                       | Internal EntityChoice only |
| `SheetDisplay`                     | Internal only              |
| `ActivationCostBox`                | Internal only              |
| `LevelDisplay`                     | Internal only              |
| `Tooltip`                          | Internal only              |
| `NestedChassisAbility`             | Internal only              |
| `selectControl`                    | Internal only              |
| `getEntityFontSizes`               | Internal only              |
| `getStepNumbers`                   | Internal only              |
| `GuideStepSelectionState` (type)   | Internal only              |
| `GuideStepInteractiveState` (type) | Internal only              |
| `ItemCondition` (type)             | Internal only              |
| `PatternOverrideData` (type)       | Internal only              |

Also: replace ITUN's single `cn` import from suref-react with its own local `cn` utility. ~10 min.

### 3b. Delete `SharedDetailItem` Wrapper

**File:** `src/components/entity/EntityDisplay/sharedDetailItem.tsx`

1-line wrapper around `DataValueDisplayView`. Replace import in `EntitySubTitleContent.tsx`. ~2 min.

### 3c. NPC Header Uses CardHeader

**File:** `EntityNpcDisplay.tsx:28-56`

Replace ~30 lines of manual header JSX with `CardHeader` component (already exists in shared/). Eliminates title styling duplication (Finding #3). ~15 min.

### 3d. Spread Props in EntityDisplay Index

**File:** `EntityDisplay/index.tsx`

Replace 24-prop explicit forwarding with `{ data, ...rest }` spread to `EntityDisplayContent`. ~10 min.

### 3e. Content Padding Helpers

Add `contentPaddingStyle` and `contentPaddingXStyle` to `getEntitySpacing()` return value. Replace 10+ inline `style={{}}` repetitions. ~15 min.

### 3f. EntityDisplayState Intersection Type

Replace 28-field state type with `EntityDisplayStateInput & { ...computed fields }`. Halves type definition. ~15 min.

---

## Priority 4: EntityDisplayContent Decomposition (~45 min)

Split the 706-line component into focused modules:

| Extracted Component                | Lines | Description                                           |
| ---------------------------------- | ----- | ----------------------------------------------------- |
| `EntityFooter`                     | ~60   | Footer rendering (tech level label, source, controls) |
| `EntityFactionData`                | ~35   | Goals/Assets/Weaknesses faction blocks                |
| `computePatternOverride` (pure fn) | ~40   | SV/legal-starting-mech calculation                    |

**Not extracted** (too interleaved with the main render tree):

- Grid vs linear image+abilities layout (stays in main component)
- Title/header composition (already delegates to CardHeader)

This reduces `EntityDisplayContent` from ~706 to ~550 lines. The remaining size is acceptable given it's the central composition point for the entity rendering system.

---

## Priority 5: Correctness Fix (~45 min)

### `translateScrap` Race Condition

**File:** `src/lib/api/crawlerApi.ts:105-130`

**Problem:** Read-then-write pattern allows concurrent modifications to lose data.

**Fix:** Create a Postgres RPC function:

```sql
CREATE OR REPLACE FUNCTION translate_scrap(
  p_crawler_id uuid,
  p_from_field text,
  p_to_field text,
  p_source_consumed int,
  p_target_amount int
) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE crawlers SET %I = %I - $1, %I = %I + $2 WHERE id = $3 AND %I >= $1',
    p_from_field, p_from_field, p_to_field, p_to_field, p_from_field
  ) USING p_source_consumed, p_target_amount, p_crawler_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then call via `supabase.rpc('translate_scrap', { ... })`.

---

## Priority 6: DB Advisory Fixes (Migration) (~15 min)

### RLS `auth.uid()` → `(select auth.uid())`

**Scope:** All 30+ policies across all tables. Single migration.

### Missing FK Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_campaigns_crawler_id ON campaigns(crawler_id);
CREATE INDEX IF NOT EXISTS idx_player_choices_parent_choice_id ON player_choices(parent_choice_id);
```

### Consolidate Duplicate SELECT Policies on Campaigns

Replace "Creator can manage campaign" + "Members can view campaign" with single unified policy.

---

## Nice-to-Have (Defer or Do Opportunistically)

| Item                                    | Location                                       | Notes                                                 |
| --------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Extract `handleUseAction` shared hook   | `PilotActionsSection`, `MechActionsSection`    | Moderate divergence — only if both grow further       |
| Decompose `MechBuilder.tsx` (652 lines) | `components/patterns/MechBuilder.tsx`          | Extract header/footer sub-components within same file |
| `MechBuilderProps` discriminated union  | Same file                                      | TypeScript correctness improvement, not a bug         |
| Save toast utility                      | Pilot detail + crawler detail                  | Very small duplication, low priority                  |
| Drone resolution helper                 | `EntityChassisPattern`, `NestedChassisAbility` | Niche feature, minor duplication                      |
| Source-specific padding constants       | `EntityDisplayContent`                         | Move to `getSourceStyles()`                           |
| `StatDisplay` tag duplication           | `shared/StatDisplay.tsx`                       | Use `const Tag = onClick ? 'button' : 'div'`          |

---

## Estimated Total Effort

| Priority                       | Time           | Items                                                                           |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------- |
| P1: Dead code                  | ~5 min         | 3 files, 5 types, 5 functions                                                   |
| P2: DRY violations             | ~45 min        | StatControl, NPC fields, entityRefApi                                           |
| P3: suref-react cleanup        | ~60 min        | Barrel, SharedDetailItem, NPC header, spread props, padding helpers, state type |
| P4: EntityDisplayContent split | ~45 min        | Footer, faction, pattern calc                                                   |
| P5: Correctness fix            | ~45 min        | translateScrap RPC                                                              |
| P6: DB advisory fixes          | ~15 min        | RLS, indexes, duplicate policies                                                |
| **Total**                      | **~3.5 hours** |                                                                                 |
