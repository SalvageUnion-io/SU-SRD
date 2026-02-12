---
paths:
  - "**/supabase/migrations/**"
---

# Database Migrations

Database migration patterns using Supabase migrations with Row Level Security (RLS).

## Migration File Naming

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

CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_id UUID REFERENCES parent_table(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metadata JSONB,
  CONSTRAINT constraint_name CHECK (condition)
);

CREATE INDEX idx_table_name_field ON table_name(field);
```

## Row Level Security (RLS)

Always enable RLS on new tables and create appropriate policies:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own records"
  ON table_name FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own records"
  ON table_name FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own records"
  ON table_name FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own records"
  ON table_name FOR DELETE
  USING (user_id = auth.uid());
```

## Common Patterns

### Cascade Deletes

```sql
parent_id UUID REFERENCES parent_table(id) ON DELETE CASCADE
```

### Unique Constraints

```sql
CONSTRAINT unique_entity_choice UNIQUE(entity_id, choice_ref_id)
```

### Performance Indexes

```sql
CREATE INDEX idx_table_parent_id ON table_name(parent_id);
CREATE INDEX idx_table_schema ON table_name(schema_name, schema_ref_id);
```

## Type Generation

After creating/modifying tables, regenerate TypeScript types using the Supabase MCP `generate_typescript_types` tool, then update `src/types/database-generated.types.ts`.

## Migration Tips

- Always test migrations locally before deploying
- Use transactions for complex multi-statement migrations
- Include indexes for frequently queried columns
- Use CASCADE deletes for parent-child relationships
- Consider RLS policies for both ownership and game membership
- Add comments explaining complex constraints or policies
