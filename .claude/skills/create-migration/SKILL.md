---
name: create-migration
description: Create and apply a Supabase database migration via MCP tools
argument-hint: "<migration-name>"
allowed-tools: Bash, mcp__supabase__apply_migration, mcp__supabase__list_tables, mcp__supabase__execute_sql, mcp__supabase__get_advisors
---

# Create Migration

Create and apply a Supabase database migration for the In The Union Now app.

**Supabase project ID:** `dshtuchbleipwqacyokz`

Steps:
1. Discuss the migration with the user and draft the SQL
2. Use `mcp__supabase__apply_migration` to apply the migration with:
   - `project_id`: `dshtuchbleipwqacyokz`
   - `name`: `$ARGUMENTS` (snake_case migration name)
   - `query`: The migration SQL
3. Always enable RLS on new tables and create appropriate policies
4. After applying, run `mcp__supabase__get_advisors` with type "security" to check for missing RLS policies
5. Use `mcp__supabase__generate_typescript_types` to regenerate types if needed
