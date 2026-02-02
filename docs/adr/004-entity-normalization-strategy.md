# 004: Entity Normalization Strategy

**Status:** Accepted

**Context:**
The application needs to store player-owned entities (abilities, equipment, systems, modules, bays) that reference data from `salvageunion-reference`. Previous approach stored these as JSON blobs in parent tables (pilots, mechs, crawlers), which made:
- Querying and filtering difficult
- RLS policies complex
- Type safety challenging
- Data consistency hard to maintain

**Decision:**
Implement a normalized entity storage system with three core tables:
- `suentities` - Stores all player-owned entities (abilities, equipment, systems, modules, bays) with references to `salvageunion-reference` via `schema_name` and `schema_ref_id`
- `cargo` - Stores cargo items on mechs/crawlers (can be schema-based or custom)
- `player_choices` - Stores player selections for entities with choices (e.g., ability specializations)

All entities reference their parent (pilot, mech, or crawler) via foreign keys with CASCADE delete.

**Consequences:**

**Positive:**
- Easy to query entities across all types
- Simple RLS policies based on parent ownership
- Type safety through generated Zod schemas
- Data consistency via foreign key constraints
- Efficient indexing for common queries
- Easy to extend with new entity types

**Negative:**
- More complex joins when hydrating entities
- Migration from old JSON structure was required
- Need to maintain consistency between `schema_name`/`schema_ref_id` and reference data

**References:**
- `supabase/migrations/20250131_entity_normalization.sql`
- `src/types/hydrated.ts`
- `src/hooks/suentity/` hooks
- `src/lib/api/entities.ts`
