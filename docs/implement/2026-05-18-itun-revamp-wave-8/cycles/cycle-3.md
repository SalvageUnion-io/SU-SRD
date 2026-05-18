# Cycle 3: Deep-Links to suref-web

## Goal (AC-4)

Build a small, well-tested URL builder + Link component for deep-links from ITUN into the canonical suref-web entity pages.

## Verified suref-web URL Pattern

**Source:** `apps/suref-web/src/pages/schema/[schemaId]/item/[itemId].astro` + `apps/suref-web/src/lib/staticPaths.ts`

**Base URL:** `https://salvageunion.io` (from `apps/suref-web/src/lib/constants.ts`)

**Item route structure:** `/schema/[schemaId]/item/[itemSlug]`

**Key constraint:** `itemId` parameter is always the entity slug (`displayData.slug` from `getReferenceEntityData()`), never a UUID. This aligns with CLAUDE.md data convention: "Entity links must use slugs, never UUIDs."

## Implementation

### 1. URL Builder (`apps/in-the-union-now/src/lib/suref-web-deep-link.ts`)

- Exports `deepLinkTo({ schemaName, slug }: EntityRef): string`
- Base URL hardcoded to `https://salvageunion.io`
- Returns: `https://salvageunion.io/schema/{schemaName}/item/{slug}`
- Documented with verified route pattern

### 2. Link Component (`apps/in-the-union-now/src/components/contextual/ViewInSRDLink.tsx`)

- Props: `schemaName`, `slug`, optional `className`
- Renders an anchor with:
  - `href` built via `deepLinkTo()`
  - `target="_blank"` (opens in new tab)
  - `rel="noopener noreferrer"` (security)
  - Display text: "View in SRD →"
- Optional custom className support

### 3. Tests

**URL builder tests** (`src/lib/__tests__/suref-web-deep-link.test.ts`):
- chassis: `iron-mongrel` → `/schema/chassis/item/iron-mongrel`
- equipment: `armor-plating` → `/schema/equipment/item/armor-plating`
- abilities: `rapid-fire` → `/schema/abilities/item/rapid-fire`
- classes: `scrapyard-scrounger` → `/schema/classes/item/scrapyard-scrounger`
- mech-systems: `comms-array` → `/schema/mech-systems/item/comms-array`
- roll-tables: generic slug test (no UUID processing)

**Component tests** (`src/components/contextual/__tests__/ViewInSRDLink.test.tsx`):
- Renders anchor with correct href
- Opens in new tab (`target="_blank"`)
- Has security attributes (`rel="noopener noreferrer"`)
- Displays link text
- Accepts and applies custom className

## Test Results

- **ITUN tests:** 381 pass, 0 fail (all existing + new tests)
- **Typecheck:** 0 errors (all packages)
- **Lint:** 0 errors (pre-existing warnings in itun-legacy unrelated)

## Files Created

- `apps/in-the-union-now/src/lib/suref-web-deep-link.ts`
- `apps/in-the-union-now/src/lib/__tests__/suref-web-deep-link.test.ts`
- `apps/in-the-union-now/src/components/contextual/ViewInSRDLink.tsx`
- `apps/in-the-union-now/src/components/contextual/__tests__/ViewInSRDLink.test.tsx`

## AC Coverage

- **AC-4:** Full implementation — URL builder + Link component with comprehensive tests
- **AC-5:** Partial — URL builder + Link tests complete; AC-5 would involve integrating links into existing entity displays (deferred to next cycle)

## Ontology Terms

- `Deep-link to SRD` (from ITUN entities to canonical suref-web pages)

## Ready for Integration

All code passes:
- TypeScript checks (no type errors)
- Unit tests (381/381)
- Linting (no new warnings)

Link component can be imported and used immediately in other ITUN components to add "View in SRD" links to entity displays.
