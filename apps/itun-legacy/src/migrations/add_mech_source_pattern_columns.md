# Migration: add_mech_source_pattern_columns

**Supabase project ID:** `dshtuchbleipwqacyokz`

## MCP Commands

### 1. Apply migration

Tool: `mcp__supabase__apply_migration`

- `project_id`: `dshtuchbleipwqacyokz`
- `name`: `add_mech_source_pattern_columns`
- `query`:

```sql
ALTER TABLE mechs
  ADD COLUMN source_pattern_id uuid REFERENCES mech_patterns(id) ON DELETE SET NULL,
  ADD COLUMN source_ref_pattern_id text;

ALTER TABLE mechs
  ADD CONSTRAINT mechs_source_pattern_exclusive
  CHECK (NOT (source_pattern_id IS NOT NULL AND source_ref_pattern_id IS NOT NULL));

CREATE INDEX idx_mechs_source_pattern_id ON mechs(source_pattern_id)
  WHERE source_pattern_id IS NOT NULL;
```

### 2. Security check

Tool: `mcp__supabase__get_advisors` with type `security` on project `dshtuchbleipwqacyokz`

### 3. Regenerate types

Tool: `mcp__supabase__generate_typescript_types` with `project_id: dshtuchbleipwqacyokz`

Save output to `apps/in-the-union-now/src/types/database-generated.types.ts`

## What this does

- `source_pattern_id` — nullable UUID FK to `mech_patterns(id)`, ON DELETE SET NULL (link clears if pattern deleted)
- `source_ref_pattern_id` — nullable text for reference pattern IDs (format: `chassisRef::patternName`)
- CHECK constraint: at most one can be non-null
- Partial index on `source_pattern_id` for efficient lookups
- No backfill needed; existing mechs get NULL for both
