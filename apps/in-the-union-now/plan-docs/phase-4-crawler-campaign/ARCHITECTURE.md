# Phase 4 — Crawler + Campaign Management + CRUD — Architecture

## Crawler Detail Component

The crawler detail is built on the extracted **DisplayCard** component, consistent with pilot detail, pattern builder, and wizard steps.

### `src/components/crawler/CrawlerDetail.tsx`

```typescript
type CrawlerDetailProps = {
  crawler: CrawlerWithRelations
}
```

Uses DisplayCard with:

- Header: crawler type, name, SP, tech level
- Body: scrap inventory, assigned pilots grid, weapon system, 10 bay cards, storage
- Footer: upkeep, upgrade pool

### Bay Display

Each bay is a compact DisplayCard or card-like component showing:

- Bay name (pseudoheader)
- NPC: name, position, keepsake, motto, HP
- Damaged effect (collapsible)
- Edit button for NPC details

---

## API Layer

### `src/lib/api/crawlerApi.ts` (NEW)

```typescript
export const crawlerApi = {
  list: async (): Promise<CrawlerRow[]>
  getById: async (id: string): Promise<CrawlerWithRelations>
  create: async (data: CreateCrawlerInput): Promise<CrawlerRow>
  update: async (id: string, data: UpdateCrawlerInput): Promise<CrawlerRow>
  delete: async (id: string): Promise<void>
  assignPilot: async (crawlerId: string, pilotId: string): Promise<void>
  unassignPilot: async (pilotId: string): Promise<void>
  addScrap: async (crawlerId: string, techLevel: number, amount: number): Promise<void>
  translateScrap: async (crawlerId: string, fromTL: number, toTL: number, amount: number): Promise<void>
}
```

### `src/lib/api/campaignApi.ts` (NEW)

```typescript
export const campaignApi = {
  list: async (): Promise<CampaignRow[]>
  getById: async (id: string): Promise<CampaignWithRelations>
  create: async (data: CreateCampaignInput): Promise<CampaignRow>
  update: async (id: string, data: UpdateCampaignInput): Promise<CampaignRow>
  setCrawler: async (campaignId: string, crawlerId: string | null): Promise<CampaignRow>
}
```

### Pilot Assignment Logic

```typescript
// Assigning a pilot to a crawler:
// 1. Set old crawler_id to null (if any)
// 2. Set new crawler_id
// This is a single update on the pilots table
const assignPilotToCrawler = async (pilotId: string, crawlerId: string) => {
  const { error } = await supabase
    .from('pilots')
    .update({ crawler_id: crawlerId })
    .eq('id', pilotId)

  // Invalidate both old and new crawler queries
  queryClient.invalidateQueries({ queryKey: crawlerKeys.all })
  queryClient.invalidateQueries({ queryKey: pilotKeys.detail(pilotId) })
}
```

### Scrap Translation Logic

```typescript
/**
 * Translate scrap between tech levels.
 * Conversion: N units of TL1 = 1 unit of TL N
 * Works bidirectionally:
 *   - 3 TL1 -> 1 TL3  (consolidate)
 *   - 1 TL3 -> 3 TL1  (break down)
 *   - 2 TL1 -> 1 TL2  (consolidate)
 *   - 1 TL2 -> 2 TL1  (break down)
 */
const translateScrap = async (
  crawlerId: string,
  fromTL: number,
  toTL: number,
  amount: number // Amount of the SOURCE TL being converted
) => {
  const crawler = await crawlerApi.getById(crawlerId)

  // Verify source has enough
  const fromField = `scrap_tl${fromTL}` as keyof CrawlerRow
  if ((crawler[fromField] as number) < amount) {
    throw new Error(`Not enough TL${fromTL} scrap`)
  }

  // Calculate conversion
  // Everything normalizes through TL1:
  //   fromTL units -> TL1 equivalent -> toTL units
  const tl1Equivalent = amount * fromTL // e.g., 2 units of TL3 = 6 TL1
  const toAmount = Math.floor(tl1Equivalent / toTL) // e.g., 6 TL1 / 2 = 3 TL2

  if (toAmount < 1) {
    throw new Error(
      `Not enough scrap to convert (need at least ${toTL / fromTL} TL${fromTL} for 1 TL${toTL})`
    )
  }

  // Deduct source, add target
  await crawlerApi.addScrap(crawlerId, fromTL, -amount)
  await crawlerApi.addScrap(crawlerId, toTL, toAmount)
}
```

### Scrap Inventory Component

```typescript
// src/components/crawler/ScrapInventory.tsx
type ScrapInventoryProps = {
  crawler: CrawlerRow
  onTranslate: (fromTL: number, toTL: number, amount: number) => void
}
```

Displays:

- Grid of TL1-TL6 scrap amounts (only showing TLs with scrap or <= crawler TL)
- "Translate" button opens a dialog for converting between TLs
- Translation dialog: select source TL, target TL, amount — shows conversion preview

### Query Key Factories

```typescript
export const crawlerKeys = {
  all: ['crawlers'] as const,
  lists: () => [...crawlerKeys.all, 'list'] as const,
  details: () => [...crawlerKeys.all, 'detail'] as const,
  detail: (id: string) => [...crawlerKeys.details(), id] as const,
}

export const campaignKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignKeys.all, 'list'] as const,
  details: () => [...campaignKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
}
```

---

## Routing

### New Routes

```
src/routes/_authenticated/
+-- crawlers/
|   +-- new.tsx               # Create Crawler wizard
|   +-- $crawlerId.tsx        # Crawler detail (with bay management)
+-- campaigns/
    +-- new.tsx               # Create Campaign
    +-- $campaignId.tsx       # Campaign detail
```

---

## Types

### `src/types/crawler.ts` (NEW)

```typescript
import type { Database } from './database-generated.types'

export type CrawlerRow = Database['public']['Tables']['crawlers']['Row']
export type CrawlerInsert = Database['public']['Tables']['crawlers']['Insert']

export type CrawlerWithRelations = CrawlerRow & {
  entityRefs: EntityRefRow[]
  assignedPilots: PilotRow[]
  playerChoices: PlayerChoiceRow[]
}

export type CreateCrawlerInput = {
  crawler_ref: string
  name?: string
  tag?: string
  // ... other creation fields
}
```

### `src/types/campaign.ts` (NEW)

```typescript
export type CampaignRow = Database['public']['Tables']['campaigns']['Row']

export type CampaignWithRelations = CampaignRow & {
  members: CampaignMemberRow[]
  crawler: CrawlerRow | null
}

export type CampaignMemberRow = Database['public']['Tables']['campaign_members']['Row']

export type CreateCampaignInput = {
  name: string
  crawler_id?: string
}
```

---

## Dashboard Sections

### `src/components/dashboard/CrawlerSection.tsx` (NEW)

- Pseudoheader: "CRAWLERS"
- Grid of crawler cards
- "Create a Crawler" button
- Each card shows: name, crawler type, SP, tech level, pilot count

### `src/components/dashboard/CampaignSection.tsx` (NEW)

- Pseudoheader: "CAMPAIGNS"
- Grid of campaign cards
- "Create a Campaign" button
- Each card shows: name, crawler name (if associated), member count, user's role

---

## File Summary

### New Files -- 14+

```
# API + hooks + types
src/lib/api/crawlerApi.ts
src/lib/api/campaignApi.ts
src/hooks/useCrawlers.ts
src/hooks/useCampaigns.ts
src/types/crawler.ts
src/types/campaign.ts

# Crawler components
src/components/crawler/CrawlerDetail.tsx
src/components/crawler/BayCard.tsx
src/components/crawler/PilotAssignment.tsx

# Routes
src/routes/_authenticated/crawlers/new.tsx
src/routes/_authenticated/crawlers/$crawlerId.tsx
src/routes/_authenticated/campaigns/new.tsx
src/routes/_authenticated/campaigns/$campaignId.tsx

# Dashboard
src/components/dashboard/CrawlerSection.tsx
src/components/dashboard/CampaignSection.tsx
src/components/dashboard/CrawlerCard.tsx
src/components/dashboard/CampaignCard.tsx
```

### Modified Files -- 1

```
src/routes/_authenticated/index.tsx   -- Add CrawlerSection + CampaignSection
```

---

## Implementation Order

1. **Types** -- crawler.ts, campaign.ts
2. **API layers** -- crawlerApi, campaignApi
3. **Query hooks** -- useCrawlers, useCampaigns
4. **Crawler creation wizard** -- /crawlers/new route with guide data, reusing `InteractiveGuideWizard` from Phase 3
5. **Crawler detail** -- CrawlerDetail with DisplayCard, BayCard components
6. **Crawler editing** -- NPC names, weapon, name, notes
7. **Campaign creation** -- /campaigns/new route
8. **Campaign detail** -- CampaignDetail with crawler association
9. **Pilot assignment** -- PilotAssignment component, de-assign logic
10. **Dashboard** -- CrawlerSection, CampaignSection, cards
