# Database Migrations

> **Applies to:** `apps/suref-web/supabase/migrations/*.sql`

Database migration patterns using Supabase migrations with Row Level Security (RLS).

## Migration File Naming

Migration files are located in `apps/suref-web/supabase/migrations/` and follow the naming convention:

- Format: `YYYYMMDD_description.sql`
- Example: `20250131_entity_normalization.sql`
- Use descriptive names that indicate the purpose of the migration

## Migration Structure

```sql
-- Description of what this migration does
-- Context and reasoning for the change

-- ============================================================================
-- TABLE_NAME TABLE
-- ============================================================================
-- Brief description of the table's purpose

CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key relationships
  parent_id UUID REFERENCES parent_table(id) ON DELETE CASCADE,

  -- Required fields
  name TEXT NOT NULL,

  -- Optional fields
  metadata JSONB,

  -- Constraints
  CONSTRAINT constraint_name CHECK (condition)
);

-- Indexes for performance
CREATE INDEX idx_table_name_field ON table_name(field);
```

## Row Level Security (RLS)

Always enable RLS on new tables and create appropriate policies:

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- SELECT policy - who can read
CREATE POLICY "Users can view their own records"
  ON table_name FOR SELECT
  USING (
    user_id = auth.uid()
    OR parent_id IN (SELECT id FROM parent_table WHERE user_id = auth.uid())
  );

-- INSERT policy - who can create
CREATE POLICY "Users can insert their own records"
  ON table_name FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR parent_id IN (SELECT id FROM parent_table WHERE user_id = auth.uid())
  );

-- UPDATE policy - who can modify
CREATE POLICY "Users can update their own records"
  ON table_name FOR UPDATE
  USING (
    user_id = auth.uid()
    OR parent_id IN (SELECT id FROM parent_table WHERE user_id = auth.uid())
  );

-- DELETE policy - who can remove
CREATE POLICY "Users can delete their own records"
  ON table_name FOR DELETE
  USING (
    user_id = auth.uid()
    OR parent_id IN (SELECT id FROM parent_table WHERE user_id = auth.uid())
  );
```

## Type Generation

After creating/modifying tables, regenerate TypeScript types:

```bash
# Generate Supabase types
bun run gen:types

# Generate Zod schemas from types
bun run gen:zod

# Or run both
bun run gen:all
```

Generated files:

- `src/types/database-generated.types.ts` - Database row types
- `src/types/database-generated.zod.ts` - Zod validation schemas

## Common Patterns

### Parent-Child Relationships

```sql
-- Child must belong to exactly one parent type
CONSTRAINT child_has_one_parent CHECK (
  (parent_a_id IS NOT NULL)::int +
  (parent_b_id IS NOT NULL)::int = 1
)
```

### Cascade Deletes

```sql
-- Automatically delete children when parent is deleted
parent_id UUID REFERENCES parent_table(id) ON DELETE CASCADE
```

### Unique Constraints

```sql
-- Ensure uniqueness within a context
CONSTRAINT unique_entity_choice UNIQUE(entity_id, choice_ref_id)
```

### Performance Indexes

```sql
-- Index foreign keys for JOIN performance
CREATE INDEX idx_table_parent_id ON table_name(parent_id);

-- Composite index for common queries
CREATE INDEX idx_table_schema ON table_name(schema_name, schema_ref_id);
```

## Using Generated Types

Import types from generated files:

```typescript
import type { Tables, TablesInsert, TablesUpdate } from '../types/database-generated.types'

// Row type (for SELECT results)
type PilotRow = Tables<'pilots'>

// Insert type (for INSERT operations)
type PilotInsert = TablesInsert<'pilots'>

// Update type (for UPDATE operations)
type PilotUpdate = TablesUpdate<'pilots'>
```

Import Zod schemas for validation:

```typescript
import { publicPilotsInsertSchema } from '../types/database-generated.zod'

// Validate data before insert
const validated = publicPilotsInsertSchema.parse(data)
```

## Migration Tips

- Always test migrations locally before deploying
- Use transactions for complex multi-statement migrations
- Include indexes for frequently queried columns
- Use CASCADE deletes for parent-child relationships
- Consider RLS policies for both ownership and game membership
- Add comments explaining complex constraints or policies
