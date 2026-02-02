# Supabase API

> **Applies to:** `apps/suref-web/src/lib/api/**/*.ts`, `apps/suref-web/src/lib/supabase*.ts`

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

- Use Zod schemas for input validation (in `src/lib/validation/`)
- Validate before database operations
- Export schemas for reuse in forms

## Entity Hydration

For normalized entities (`suentities` table):

- Use `hydrateEntity()` or `hydrateEntities()` from `src/lib/api/hydration.ts`
- Fetch related `player_choices` and merge into hydrated entity
- Return `HydratedEntity` type which includes choices array

## Error Handling

- Throw errors (don't return error objects)
- Use descriptive error messages
- Let TanStack Query handle error states in components

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

## Mutation Patterns

- Mutations use optimistic updates via `onMutate` for immediate UI feedback
- Mutations invalidate queries via `onSuccess` to ensure fresh data after API calls
- Mutations rollback on error via `onError` to restore previous state
