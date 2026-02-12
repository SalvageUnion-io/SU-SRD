---
paths:
  - "apps/in-the-union-now/src/lib/api/**"
---

# Supabase API

Supabase API patterns for client setup, queries, validation, and hydration.

## Client Setup

- Use `supabase` client from `src/lib/supabase.ts` for client-side operations
- Use `getSupabaseServerClient()` from `src/lib/supabase.server.ts` for server-side operations
- Always type the client with `Database` type from `database-generated.types.ts`

## API File Organization

- All API functions live in `src/lib/api/`
- Group by resource: `entities.ts`, `pilots.ts`, `mechs.ts`, `cargo.ts`, etc.
- Use async/await (never callbacks)
- Always handle errors (throw or return error objects)

## Typed Queries

- Use typed queries: `supabase.from('table_name').select('*')`
- Always use `.single()` for single row queries
- Use `.eq()`, `.in()`, `.order()` for filtering and sorting
- Cast results with `castDatabaseResult<T>()` helper when needed

## Validation

- Use Zod schemas for input validation (in `src/lib/validation.ts`)
- Validate before database operations
- Export schemas for reuse in forms

## Error Handling

- Throw errors for upstream code to handle
- Use descriptive error messages
- Let TanStack Query handle error states in components

## Mutation Patterns

- Mutations use optimistic updates via `onMutate` for immediate UI feedback
- Mutations invalidate queries via `onSuccess` to ensure fresh data after API calls
- Mutations rollback on error via `onError` to restore previous state

## Examples

**Fetch with filtering:**

```typescript
const { data, error } = await supabase
  .from(table)
  .select('*')
  .eq('user_id' as never, userId)

if (error) throw error
return castDatabaseResult<T[]>(data || [])
```

**Create with validation:**

```typescript
const validated = createEntitySchema.parse(data)
const { data: entity, error } = await supabase
  .from('suentities')
  .insert(validated)
  .select()
  .single()

if (error) throw new Error(`Failed to create entity: ${error.message}`)
return hydrateEntity(entity, [])
```
