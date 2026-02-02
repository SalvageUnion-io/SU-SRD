# 005: SalvageUnion Reference ORM Pattern

**Status:** Accepted

**Context:**
The application needs to access Salvage Union game data (chassis, abilities, equipment, systems, etc.) from JSON files. This data needs to be:
- Type-safe with full TypeScript support
- Validated against JSON schemas
- Searchable across all schemas
- Accessible via a consistent API
- Publishable as a standalone npm package

**Decision:**
Create a TypeScript ORM pattern using:
- `SalvageUnionReference` class with static model accessors (e.g., `SalvageUnionReference.Chassis.find(...)`)
- Models generated from schema catalog with three methods: `all()`, `find()`, `findAll()`
- Entity cache for O(1) lookups by schema name and ID
- Global search API with relevance scoring
- Type generation from JSON schemas using `json-schema-to-typescript`

**Consequences:**

**Positive:**
- Familiar API similar to popular ORMs
- Full type safety with inferred types from JSON data
- Zero runtime dependencies (except Zod for validation)
- Can be used standalone or as part of the monorepo
- Search API is powerful and efficient
- Easy to extend with new schemas

**Negative:**
- Code generation step required for types
- Entity cache could grow large (mitigated with Map size limits)
- Models are not true classes (just static accessors to arrays)
- No lazy loading (all data loaded at module initialization)

**References:**
- `packages/salvageunion-reference/lib/index.ts`
- `packages/salvageunion-reference/lib/BaseModel.ts`
- `packages/salvageunion-reference/lib/ModelFactory.ts`
- `packages/salvageunion-reference/lib/search.ts`
