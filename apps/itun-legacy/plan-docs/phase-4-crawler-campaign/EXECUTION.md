# Phase 4 — Crawler + Campaign Management + CRUD — Execution

## Summary

Phase 4 delivers crawler creation, crawler detail with full bay management, campaign/game management, pilot assignment, scrap tracking with translation, crawler storage, and dashboard integration.

**Terminology note:** The PRD uses "Campaign" but the implementation uses "Game" throughout the UI for user-friendliness. The database tables remain `campaigns` and `campaign_members`.

---

## What Was Built

### Game/Campaign Management (100%)

- **Game creation** (`/games/new`) with name input
- **Game detail** (`/games/$gameId`) showing crawler link, members, assigned pilots
- **Invite code system** (bonus — ahead of Phase 5) with copy-to-clipboard and join dialog
- **Game deletion** with confirmation dialog (Mediator only)
- **API layer**: `gameApi.ts` — create, list, getById, delete, join, members
- **Hooks**: `useGames.ts` — useGames, useGame, useGameMembers, useCreateGame, useDeleteGame, useJoinGame

### Crawler Creation Wizard (100%)

- **4-step wizard** via `InteractiveGuideWizard` using `crawler-creation` guide
- Steps: Choose crawler type → Choose weapon system (TL1 + damage) → Name NPCs → Name the crawler
- **Utility**: `crawlerUtils.ts` — `crawlerWizardToCreateInput()` parses wizard state into API input
- **On completion**: Creates `crawlers` row + `entity_refs` for weapon + links crawler to game

### Crawler Detail View (100%)

- **Route**: `/games/$gameId/crawler` — full DisplayCard layout
- **Header**: Crawler name, tag, type, SP, TL with Edit button (Mediator only)
- **Statistics section** (`CrawlerStatsSection.tsx`): SP with +/- controls, TL, upkeep, upgrade pool
- **Scrap by Tech Level**: TL1-TL6 grid with +/- controls per level
- **Translate Scrap button** → opens `ScrapTranslationDialog`
- **Weapons System section**: EntityDisplay of equipped weapon with "Change" button → opens `WeaponSelectionDialog`
- **Crawler Ability section**: Renders crawler-type-specific actions from reference data
- **Crawler Bays section** (`CrawlerBaysSection.tsx`): All 10 mandatory bays with NPC name/keepsake/motto editing
- **Storage section** (`CrawlerStorageSection.tsx`): Cargo item list with add/remove/quantity controls
- **Footer**: Autosave status indicator

### Scrap Translation (100%)

- **Pure logic**: `computeScrapTranslation()` in `crawlerUtils.ts` — normalizes through TL1 intermediate
- **API**: `translateScrap()` in `crawlerApi.ts` — atomic read-modify-write of two scrap fields
- **Hook**: `useTranslateScrap()` — updates query cache on success
- **UI**: `ScrapTranslationDialog.tsx` — from/to TL pickers, amount input with +/-/Max, live conversion preview
- **Tests**: 10 test cases covering consolidation, breakdown, cross-conversion, edge cases, partial consumption

### Crawler Storage/Cargo (100%)

- **API**: `listCargoForCrawler()`, `addCargoToCrawler()`, `updateCargoItem()`, `deleteCargoItem()` in `crawlerApi.ts`
- **Hooks**: `useCrawlerCargo()`, `useAddCrawlerCargo()`, `useUpdateCrawlerCargo()`, `useDeleteCrawlerCargo()`
- **UI**: `CrawlerStorageSection.tsx` — item list with quantity +/- buttons, delete, inline add form
- **Functionally infinite** storage (no capacity limit enforced)

### Weapon System Editing (100%)

- **API**: `updateCrawlerWeapon()` already existed — swaps old entity_ref for new
- **Hook**: `useUpdateCrawlerWeapon()` already existed
- **UI**: `WeaponSelectionDialog.tsx` — Radix dialog with EntityDisplay cards for TL1 weapons, search filter, current weapon highlighted

### Crawler Name/Tag/Notes Editing (100%)

- **UI**: `CrawlerEditDialog.tsx` — ShadCN Dialog with name, tag, notes fields
- **Trigger**: Edit button in crawler detail header (Mediator only)
- **Uses existing** `updateCrawler()` API and `useUpdateCrawler()` hook

### Pilot Assignment (100%)

- **Assign/unassign** controls on game detail page
- **De-assignment**: Assigning a pilot to a new crawler automatically clears the old `crawler_id`
- **API**: `assignPilotToCrawler()` in `pilotApi.ts`
- **Hook**: `useAssignPilotToCrawler()` with proper cache invalidation for both old and new crawlers

### Dashboard Integration (100%)

- **GameSection** (`GameSection.tsx`): Lists user's games with crawler summary cards
- **New Game slot**: "Create a Game" button linking to `/games/new`
- **Join Game slot**: Invite code entry dialog

---

## Files Created

| File                                                         | Purpose                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `src/lib/api/crawlerApi.ts`                                  | Crawler CRUD + scrap translation + cargo CRUD                          |
| `src/lib/api/gameApi.ts`                                     | Campaign/game CRUD + join/invite                                       |
| `src/hooks/useCrawlers.ts`                                   | Query hooks for crawlers, entity refs, cargo                           |
| `src/hooks/useGames.ts`                                      | Query hooks for games, members                                         |
| `src/lib/crawlerUtils.ts`                                    | Wizard-to-input conversion, stats computation, scrap translation logic |
| `src/lib/crawlerUtils.test.ts`                               | 17 tests covering wizard parsing, stats, scrap translation             |
| `src/lib/gameUtils.ts`                                       | Mediator check, member role utilities                                  |
| `src/lib/gameUtils.test.ts`                                  | Tests for game utilities                                               |
| `src/components/games/CrawlerStatsSection.tsx`               | SP, TL, upkeep, scrap-by-TL display with +/- controls                  |
| `src/components/games/CrawlerBaysSection.tsx`                | 10 bay NPC editor grid                                                 |
| `src/components/games/CrawlerStorageSection.tsx`             | Cargo item list with CRUD                                              |
| `src/components/games/ScrapTranslationDialog.tsx`            | Scrap conversion dialog with preview                                   |
| `src/components/games/CrawlerEditDialog.tsx`                 | Name/tag/notes editor dialog                                           |
| `src/components/games/WeaponSelectionDialog.tsx`             | TL1 weapon system picker dialog                                        |
| `src/components/games/GameSection.tsx`                       | Dashboard game list + new/join slots                                   |
| `src/routes/_authenticated/games/new.tsx`                    | Create game route                                                      |
| `src/routes/_authenticated/games/$gameId.tsx`                | Game parent layout route                                               |
| `src/routes/_authenticated/games/$gameId/index.tsx`          | Game detail page                                                       |
| `src/routes/_authenticated/games/$gameId/create-crawler.tsx` | Crawler creation wizard route                                          |
| `src/routes/_authenticated/games/$gameId/crawler.tsx`        | Crawler detail route                                                   |

## Files Modified

| File                                      | Changes                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `src/routes/_authenticated/index.tsx`     | Added GameSection to dashboard                                         |
| `src/types/common.ts`                     | Added crawler, campaign, cargo types + BayNpcData + CreateCrawlerInput |
| `src/types/database-generated.types.ts`   | Regenerated with crawlers, campaigns, campaign_members, cargo tables   |
| `src/hooks/usePilots.ts`                  | Added usePilotsForCrawler, useAssignPilotToCrawler                     |
| `src/lib/api/pilotApi.ts`                 | Added listPilotsByCrawlerId, assignPilotToCrawler                      |
| `src/lib/pilotActionUtils.ts`             | Minor updates                                                          |
| `src/components/pilots/ActionDisplay.tsx` | Minor updates                                                          |
| `src/routeTree.gen.ts`                    | Auto-regenerated with game routes                                      |

---

## Acceptance Criteria Status

| AC   | Description                             | Status   |
| ---- | --------------------------------------- | -------- |
| AC-1 | Crawler Creation                        | COMPLETE |
| AC-2 | Crawler Detail                          | COMPLETE |
| AC-3 | Crawler Editing                         | COMPLETE |
| AC-4 | Campaign/Game Creation                  | COMPLETE |
| AC-5 | Pilot Assignment                        | COMPLETE |
| AC-6 | Scrap Inventory + Translation + Storage | COMPLETE |
| AC-7 | Dashboard                               | COMPLETE |

---

## Test Results

- **284 tests passing** across 12 files (0 failures)
- **0 TypeScript errors** across all packages
- Key test coverage:
  - `crawlerUtils.test.ts`: 17 tests (wizard parsing, stats computation, scrap translation)
  - `gameUtils.test.ts`: Game utility tests
