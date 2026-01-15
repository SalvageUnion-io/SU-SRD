# Grants, Choices, and Player Data Architecture

This document describes the comprehensive interaction between `grants`, `choices`, GameEntities (`suentities`), and PlayerChoices (`player_choices`) in the Salvage Union Index application.

## Table of Contents

1. [Overview](#overview)
2. [The `grants` Property](#the-grants-property)
3. [The `choices` Property](#the-choices-property)
4. [GameEntities (suentities)](#gameentities-suentities)
5. [PlayerChoices (player_choices)](#playerchoices-player_choices)
6. [Data Flow and Relationships](#data-flow-and-relationships)
7. [Examples from Production Data](#examples-from-production-data)
8. [Implementation Details](#implementation-details)

---

## Overview

The application uses a normalized database schema to track player character sheets (pilots, mechs, crawlers) and their associated game entities. Two key mechanisms drive entity relationships:

1. **Grants**: Automatic entity creation when a parent entity is selected
2. **Choices**: Player selections that customize entities, which can be nested

### Key Concepts

- **Reference Data**: Static game data from `salvageunion-reference` package (abilities, equipment, systems, modules, etc.)
- **Game Entities**: Database records (`suentities`) that link reference data to player sheets
- **Player Choices**: Database records (`player_choices`) that store player selections for entity customization
- **Grants**: Automatic entity creation mechanism triggered when entities with `grants` are added
- **Nested Choices**: Choices that belong to other choices, enabling complex selection chains

---

## The `grants` Property

### Definition

The `grants` property is defined in the `salvageunion-reference` package schema and appears on entities like abilities, equipment, and systems. It specifies entities that should be automatically created when the parent entity is added to a player's sheet.

### Schema Definition

```typescript
// packages/salvageunion-reference/lib/types/objects.ts
export interface SURefMetaGrant {
  schema: SURefSchemaName | "choice";
  name: SURefName;
}
```

### Package Location

- **Schema**: `packages/salvageunion-reference/schemas/shared/objects.schema.json`
- **Type**: `packages/salvageunion-reference/lib/types/objects.ts`
- **Utility**: `packages/salvageunion-reference/lib/utilities-generated.ts` - `getGrants()`

### How It Works in the App

When a player adds an entity (ability, equipment, etc.) to their sheet:

1. **Entity Creation**: The entity is created in the `suentities` table
2. **Grant Processing**: The app checks if the entity's reference data has a `grants` array
3. **Automatic Entity Creation**: For each grant, a new entity is automatically created:
   - Links to the same parent (pilot/mech/crawler)
   - Sets `parent_entity_id` to the granting entity
   - Uses the grant's `schema` and `name` to find the referenced entity

### Implementation

**Location**: `apps/suref-web/src/hooks/suentity/useSUEntities.ts`

```typescript
onSuccess: async (newEntity) => {
  const ref = newEntity.ref;
  if (
    ref &&
    "grants" in ref &&
    Array.isArray(ref.grants) &&
    ref.grants.length > 0
  ) {
    for (const grant of ref.grants) {
      const grantSchema = grant.schema as SURefSchemaName;
      const grantName = grant.name as string;

      const grantedItem = SalvageUnionReference.findIn(
        grantSchema,
        (item) => item.name === grantName
      );

      if (grantedItem) {
        const grantedEntityData: TablesInsert<"suentities"> = {
          pilot_id: newEntity.pilot_id,
          mech_id: newEntity.mech_id,
          crawler_id: newEntity.crawler_id,
          parent_entity_id: newEntity.id, // Links to granting entity
          schema_name: grantSchema,
          schema_ref_id: grantedItem.id,
          metadata: null,
        };
        await createNormalizedEntity(grantedEntityData);
      }
    }
  }
};
```

### Example: Auto-Turret Ability

**Reference Data** (`packages/salvageunion-reference/data/abilities.json`):

```json
{
  "id": "c7f121eb-6e9f-46e6-9500-f65860ddd08c",
  "name": "Auto-Turret",
  "tree": "Forging",
  "level": 3,
  "grants": [
    {
      "name": "Auto-Turret",
      "schema": "equipment"
    }
  ],
  "description": "Construct an Immobile Auto-Turret..."
}
```

**Database Result**:

When a player selects the "Auto-Turret" ability:

1. **Ability Entity Created**:

   ```sql
   INSERT INTO suentities (
     pilot_id,
     schema_name,
     schema_ref_id
   ) VALUES (
     'pilot-uuid',
     'abilities',
     'c7f121eb-6e9f-46e6-9500-f65860ddd08c'
   );
   -- Returns entity with id: 'ability-entity-uuid'
   ```

2. **Granted Equipment Entity Created** (automatically):
   ```sql
   INSERT INTO suentities (
     pilot_id,
     parent_entity_id,  -- Links to ability entity
     schema_name,
     schema_ref_id
   ) VALUES (
     'pilot-uuid',
     'ability-entity-uuid',
     'equipment',
     'auto-turret-equipment-id'  -- Found by matching name "Auto-Turret"
   );
   ```

### Example: Custom Sniper Rifle Ability

**Reference Data**:

```json
{
  "id": "921afb77-3d0f-49b5-9cc4-36372b24e00d",
  "name": "Custom Sniper Rifle",
  "tree": "Sniper",
  "level": 3,
  "grants": [
    {
      "name": "Custom Sniper Rifle",
      "schema": "equipment"
    }
  ]
}
```

**Result**: Selecting this ability automatically grants the "Custom Sniper Rifle" equipment to the pilot.

---

## The `choices` Property

### Definition

The `choices` property is defined in the `salvageunion-reference` package and appears on entities like abilities, equipment, systems, modules, and crawler bays. It defines options that players must select to customize the entity.

### Schema Definition

```typescript
// packages/salvageunion-reference/lib/types/objects.ts
export interface SURefMetaChoice {
  id: SURefId;
  name: SURefName;
  content?: SURefMetaContent;
  rollTable?: string;
  schemaEntities?: string[];
  schema?: SURefSchemaName[];
  customSystemOptions?: SURefMetaSystemModule[];
  constraints?: {
    field?: string;
    min?: SURefNonNegativeInteger;
    max?: SURefNonNegativeInteger;
  };
}

export type SURefMetaChoices = SURefMetaChoice[];
```

### Package Location

- **Schema**: `packages/salvageunion-reference/schemas/shared/objects.schema.json`
- **Type**: `packages/salvageunion-reference/lib/types/objects.ts`
- **Used in**: `abilities`, `equipment`, `systems`, `modules`, `crawler-bays`, and `actions` (nested)

### Choice Types

1. **Schema-Based Choices**: Player selects from entities in specified schemas
   - Example: "Choose a System" → `schema: ["systems"]`
2. **Custom Text Choices**: Player enters free-form text
   - Example: "Name your Auto-Turret"
3. **Roll Table Choices**: Player rolls on a table for random outcome
   - Example: "A.I. Personality" → `rollTable: "A.I. Personality"`
4. **Constrained Choices**: Choices with restrictions (e.g., tech level range)
   - Example: "Chassis Choice" with `constraints: { field: "techLevel", min: 3, max: 4 }`

### How It Works in the App

1. **Choice Display**: When an entity is displayed, its `choices` array is rendered
2. **Player Selection**: Player makes a selection, which is stored in `player_choices` table
3. **Nested Choices**: If the selected entity also has choices, those become nested choices
4. **Choice Resolution**: The app resolves choices to display the full entity tree

### Implementation

**Component**: `apps/suref-web/src/components/CrawlerLiveSheet/SheetEntityChoiceDisplay.tsx`

```typescript
export function SheetEntityChoiceDisplay({
  choice,
  onUpdateChoice,
  entityId,
}: {
  choice: SURefMetaChoice;
  onUpdateChoice?: (choiceId: string, value: string | undefined) => void;
  entityId: string | undefined;
}) {
  const { data: playerChoices } = usePlayerChoices(entityId);

  const selectedValue = useMemo(() => {
    const playerChoice = playerChoices?.find(
      (pc) => pc.choice_ref_id === choice.id
    );
    return playerChoice?.value || null;
  }, [playerChoices, choice.id]);

  // Renders choice UI and handles selection
}
```

**Hook**: `apps/suref-web/src/hooks/suentity/useManageEntityChoices.ts`

```typescript
export function useManageEntityChoices(entityId: string | undefined) {
  return useCallback(
    (choiceRefId: string, value: string | undefined) => {
      if (value === undefined) {
        // Delete choice
        deleteChoice.mutate({ id: existingChoice.id, entityId });
      } else {
        // Create/update choice
        upsertChoice.mutate({
          entity_id: entityId,
          choice_ref_id: choiceRefId,
          value,
        });
      }
    },
    [entityId, upsertChoice, deleteChoice]
  );
}
```

### Example: System with Chassis Choice

**Reference Data** (`packages/salvageunion-reference/data/systems.json`):

```json
{
  "id": "system-id",
  "name": "Industrial Body Kit",
  "choices": [
    {
      "id": "ed8cb1b3-3b38-4c92-9f0c-2638356edfc7",
      "name": "Industrial Body Kit Choice",
      "schema": ["chassis"],
      "constraints": {
        "field": "techLevel",
        "min": 1,
        "max": 2
      }
    }
  ]
}
```

**Database Result**:

When a player selects a chassis for this system:

```sql
INSERT INTO player_choices (
  entity_id,
  choice_ref_id,
  value
) VALUES (
  'system-entity-uuid',
  'ed8cb1b3-3b38-4c92-9f0c-2638356edfc7',
  'chassis::tech-1-chassis-id'  -- Reference format: schema::id
);
```

### Example: Action with Multiple Choices

**Reference Data** (from systems):

```json
{
  "actions": [
    {
      "id": "action-id",
      "name": "Deploy Turret",
      "choices": [
        {
          "id": "cce464f5-c443-4d19-982f-13b010400860",
          "name": "Turret Personality",
          "rollTable": "A.I. Personality"
        },
        {
          "id": "c05fd7f4-cd5a-4c0d-8518-3566cece416d",
          "name": "Turret Model",
          "customSystemOptions": [...]
        }
      ]
    }
  ]
}
```

**Note**: Choices on actions are associated with the parent entity (system/module), not the action itself.

---

## GameEntities (suentities)

### Database Schema

```sql
CREATE TABLE suentities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Parent relationship (exactly one must be set)
  pilot_id UUID REFERENCES pilots(id) ON DELETE CASCADE,
  mech_id UUID REFERENCES mechs(id) ON DELETE CASCADE,
  crawler_id UUID REFERENCES crawlers(id) ON DELETE CASCADE,

  -- Reference to salvageunion-reference data
  schema_name TEXT NOT NULL,  -- e.g., 'abilities', 'systems', 'equipment'
  schema_ref_id TEXT NOT NULL,  -- e.g., 'bionic-senses', 'railgun'

  -- Entity-specific metadata (optional, for positioning/slot info)
  metadata JSONB,  -- e.g., { "slot": 1, "row": 2, "col": 3 }

  -- Parent entity (for granted entities)
  parent_entity_id UUID REFERENCES suentities(id) ON DELETE CASCADE,

  CONSTRAINT entity_has_one_parent CHECK (
    (pilot_id IS NOT NULL)::int +
    (mech_id IS NOT NULL)::int +
    (crawler_id IS NOT NULL)::int = 1
  )
);
```

### Purpose

The `suentities` table stores all game entities associated with player sheets:

- **Abilities** on pilots
- **Equipment** on pilots
- **Systems** on mechs
- **Modules** on mechs
- **Bays** on crawlers
- **Granted entities** (linked via `parent_entity_id`)

### Key Relationships

1. **Parent Sheet**: Links to `pilots`, `mechs`, or `crawlers` (exactly one)
2. **Reference Data**: `schema_name` + `schema_ref_id` identifies the entity in `salvageunion-reference`
3. **Granting Entity**: `parent_entity_id` links granted entities to their grantor
4. **Player Choices**: Referenced by `player_choices.entity_id`

### Example: Real Database Record

```json
{
  "id": "fed13d9f-1198-4d0c-8651-daf5600db0ee",
  "created_at": "2025-11-10T01:21:35.018791Z",
  "updated_at": "2025-11-10T01:21:35.018791Z",
  "pilot_id": "b80507a5-4390-4dea-988d-5db8d48b8820",
  "mech_id": null,
  "crawler_id": null,
  "schema_name": "equipment",
  "schema_ref_id": "f5f04072-9e81-4c9d-a835-b71f45120d66",
  "metadata": null,
  "parent_entity_id": "da12be45-d7eb-48c7-b79c-3834d59a2864" // Granted by ability
}
```

This record represents:

- Equipment entity on a pilot
- Granted by the ability entity with ID `da12be45-d7eb-48c7-b79c-3834d59a2864`
- Reference: `equipment::f5f04072-9e81-4c9d-a835-b71f45120d66`

---

## PlayerChoices (player_choices)

### Database Schema

```sql
CREATE TABLE player_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Parent (exactly one must be set)
  entity_id UUID REFERENCES suentities(id) ON DELETE CASCADE,
  player_choice_id UUID REFERENCES player_choices(id) ON DELETE CASCADE,

  -- Reference to choice in salvageunion-reference
  choice_ref_id TEXT NOT NULL,  -- ID of the choice in the entity's choices array

  -- Player's selected value
  value TEXT NOT NULL,  -- e.g., "Hearing", "Vision", or "systems::laser-rifle"

  -- Constraints
  CONSTRAINT choice_has_one_parent CHECK (
    (entity_id IS NOT NULL)::int +
    (player_choice_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT unique_entity_choice UNIQUE(entity_id, choice_ref_id),
  CONSTRAINT unique_choice_choice UNIQUE(player_choice_id, choice_ref_id)
);
```

### Purpose

The `player_choices` table stores player selections for entity customization:

- **Entity Choices**: Selections for choices defined on entities
- **Nested Choices**: Selections for choices defined on previously selected entities

### Choice Value Format

The `value` field stores different formats depending on choice type:

1. **Schema Reference**: `"systems::laser-rifle-id"` or `"modules::targeting-computer-id"`
   - Format: `{schema}::{entity-id}`
   - Used when player selects from a schema

2. **Custom Text**: `"My Custom Name"` or `"Hearing"`
   - Plain text for free-form choices

3. **Roll Table Result**: `"Friendly"` or `"Aggressive"`
   - Result from rolling on a table

### Nested Choices

Nested choices enable selection chains:

**Example Flow**:

1. Player selects ability "Bionic Senses" → creates entity
2. Ability has choice "Choose Enhancement" → player selects "systems::thermal-optics"
3. Selected system has choice "Choose Module" → player selects "modules::zoom-lens"
4. Selected module has choice "Custom Name" → player enters "Eagle Eye"

**Database Representation**:

```sql
-- Level 1: Entity choice
INSERT INTO player_choices (entity_id, choice_ref_id, value)
VALUES ('ability-entity-id', 'enhancement-choice-id', 'systems::thermal-optics-id');

-- Level 2: Nested choice (belongs to Level 1 choice)
INSERT INTO player_choices (player_choice_id, choice_ref_id, value)
VALUES ('level-1-choice-id', 'module-choice-id', 'modules::zoom-lens-id');

-- Level 3: Nested choice (belongs to Level 2 choice)
INSERT INTO player_choices (player_choice_id, choice_ref_id, value)
VALUES ('level-2-choice-id', 'name-choice-id', 'Eagle Eye');
```

### Implementation

**API**: `apps/suref-web/src/lib/api/playerChoices.ts`

```typescript
// Fetch choices for an entity
export async function fetchChoicesForEntity(
  entityId: string
): Promise<Tables<"player_choices">[]>;

// Fetch nested choices for a choice
export async function fetchChoicesForChoice(
  choiceId: string
): Promise<Tables<"player_choices">[]>;

// Upsert a choice (creates or updates)
export async function upsertPlayerChoice(
  data: TablesInsert<"player_choices">
): Promise<Tables<"player_choices">>;
```

**Hooks**: `apps/suref-web/src/hooks/suentity/usePlayerChoices.ts`

```typescript
// Fetch choices for entity
const { data: choices } = usePlayerChoices(entityId);

// Fetch nested choices
const { data: nestedChoices } = useNestedChoices(choiceId);

// Upsert choice
const upsertChoice = useUpsertPlayerChoice();
upsertChoice.mutate({
  entity_id: entityId,
  choice_ref_id: "choice-id",
  value: "systems::laser-rifle",
});
```

---

## Data Flow and Relationships

### Complete Example: Ability with Grants and Choices

**Scenario**: Player selects "Bionic Senses" ability which:

1. Grants "Integrated Optics" equipment (via `grants`)
2. Has a choice "Choose Enhancement" (via `choices`)

**Step 1: Player Selects Ability**

```sql
-- Entity created
INSERT INTO suentities (pilot_id, schema_name, schema_ref_id)
VALUES ('pilot-id', 'abilities', 'bionic-senses-id');
-- Returns: ability-entity-id
```

**Step 2: Grant Processing (Automatic)**

```sql
-- Granted equipment entity created
INSERT INTO suentities (
  pilot_id,
  parent_entity_id,
  schema_name,
  schema_ref_id
)
VALUES (
  'pilot-id',
  'ability-entity-id',  -- Links to ability
  'equipment',
  'integrated-optics-id'  -- Found by matching grant name
);
-- Returns: equipment-entity-id
```

**Step 3: Player Makes Choice**

```sql
-- Player selects "Thermal Optics" system for the choice
INSERT INTO player_choices (entity_id, choice_ref_id, value)
VALUES (
  'ability-entity-id',
  'enhancement-choice-id',  -- From ability.choices[].id
  'systems::thermal-optics-id'
);
-- Returns: choice-id
```

**Step 4: Nested Choice (if selected system has choices)**

```sql
-- If thermal-optics system has a choice, player can make nested selection
INSERT INTO player_choices (player_choice_id, choice_ref_id, value)
VALUES (
  'choice-id',  -- Parent choice
  'module-choice-id',  -- From system.choices[].id
  'modules::zoom-lens-id'
);
```

### Relationship Diagram

```
Pilot/Mech/Crawler
    │
    ├── suentities (ability)
    │   ├── parent_entity_id: null
    │   ├── schema_name: "abilities"
    │   └── schema_ref_id: "bionic-senses-id"
    │       │
    │       ├── grants → suentities (equipment)
    │       │   ├── parent_entity_id: ability-entity-id
    │       │   ├── schema_name: "equipment"
    │       │   └── schema_ref_id: "integrated-optics-id"
    │       │
    │       └── choices → player_choices
    │           ├── entity_id: ability-entity-id
    │           ├── choice_ref_id: "enhancement-choice-id"
    │           └── value: "systems::thermal-optics-id"
    │               │
    │               └── player_choices (nested)
    │                   ├── player_choice_id: choice-id
    │                   ├── choice_ref_id: "module-choice-id"
    │                   └── value: "modules::zoom-lens-id"
```

### Live Sheet Integration

**Component**: `apps/suref-web/src/components/CrawlerLiveSheet/SheetEntityChoiceDisplay.tsx`

The live sheet components:

1. Fetch entities for the sheet (pilot/mech/crawler)
2. Hydrate entities with reference data (`HydratedEntity`)
3. Fetch player choices for each entity
4. Display choices with current selections
5. Allow players to update choices

**Hydrated Entity Type**: `apps/suref-web/src/types/hydrated.ts`

```typescript
export type HydratedEntity = Tables<"suentities"> & {
  ref: SURefEntity; // Reference data from package
  choices: Tables<"player_choices">[]; // Player's selections
  parentEntity?: HydratedEntity; // If granted, link to grantor
};
```

---

## Examples from Production Data

### Example 1: Auto-Turret Ability

**Reference Data** (`abilities.json`):

```json
{
  "id": "c7f121eb-6e9f-46e6-9500-f65860ddd08c",
  "name": "Auto-Turret",
  "tree": "Forging",
  "level": 3,
  "grants": [
    {
      "name": "Auto-Turret",
      "schema": "equipment"
    }
  ],
  "actions": [
    {
      "name": "Auto-Turret",
      "content": [
        {
          "value": "Your Auto-Turret has a unique personality. Choose this or roll on the A.I. Personality Table p. 91."
        }
      ]
    }
  ]
}
```

**Database State After Selection**:

```sql
-- Ability entity
suentities: {
  id: 'ability-uuid',
  pilot_id: 'pilot-uuid',
  schema_name: 'abilities',
  schema_ref_id: 'c7f121eb-6e9f-46e6-9500-f65860ddd08c',
  parent_entity_id: null
}

-- Granted equipment entity
suentities: {
  id: 'equipment-uuid',
  pilot_id: 'pilot-uuid',
  schema_name: 'equipment',
  schema_ref_id: 'auto-turret-equipment-id',
  parent_entity_id: 'ability-uuid'  -- Links to ability
}
```

### Example 2: System with Chassis Choice

**Reference Data** (`systems.json`):

```json
{
  "id": "system-id",
  "name": "Industrial Body Kit",
  "choices": [
    {
      "id": "ed8cb1b3-3b38-4c92-9f0c-2638356edfc7",
      "name": "Industrial Body Kit Choice",
      "schema": ["chassis"],
      "constraints": {
        "field": "techLevel",
        "min": 1,
        "max": 2
      }
    }
  ]
}
```

**Database State After Selection**:

```sql
-- System entity
suentities: {
  id: 'system-uuid',
  mech_id: 'mech-uuid',
  schema_name: 'systems',
  schema_ref_id: 'system-id',
  parent_entity_id: null
}

-- Player choice
player_choices: {
  id: 'choice-uuid',
  entity_id: 'system-uuid',
  choice_ref_id: 'ed8cb1b3-3b38-4c92-9f0c-2638356edfc7',
  value: 'chassis::tech-1-chassis-id',
  player_choice_id: null
}
```

### Example 3: Crawler Bay with NPC Choices

**Reference Data** (`crawler-bays.json`):

```json
{
  "id": "bay-id",
  "name": "Pilot Bay",
  "npc": {
    "position": "Operator",
    "hitPoints": 4,
    "choices": [
      {
        "id": "name-choice-id",
        "name": "Name"
      },
      {
        "id": "personality-choice-id",
        "name": "Personality",
        "rollTable": "A.I. Personality"
      }
    ]
  }
}
```

**Database State After Selection**:

```sql
-- Bay entity (with NPC metadata)
suentities: {
  id: 'bay-uuid',
  crawler_id: 'crawler-uuid',
  schema_name: 'crawler-bays',
  schema_ref_id: 'bay-id',
  metadata: {
    "npc": {
      "name": "",
      "notes": "",
      "damage": 0,
      "hitPoints": 4
    },
    "damaged": false
  }
}

-- Player choices for NPC
player_choices: {
  id: 'name-choice-uuid',
  entity_id: 'bay-uuid',
  choice_ref_id: 'name-choice-id',
  value: 'Rusty',
  player_choice_id: null
}

player_choices: {
  id: 'personality-choice-uuid',
  entity_id: 'bay-uuid',
  choice_ref_id: 'personality-choice-id',
  value: 'Friendly',  -- Result from roll table
  player_choice_id: null
}
```

---

## Implementation Details

### Grant Processing

**Location**: `apps/suref-web/src/hooks/suentity/useSUEntities.ts`

**Flow**:

1. Entity created via `useCreateEntity()`
2. `onSuccess` callback triggered
3. Check if entity reference has `grants` array
4. For each grant:
   - Find referenced entity by name in specified schema
   - Create new entity with `parent_entity_id` set
   - Handle local (cache-only) vs. API-backed entities

**Key Code**:

```typescript
if (
  ref &&
  "grants" in ref &&
  Array.isArray(ref.grants) &&
  ref.grants.length > 0
) {
  for (const grant of ref.grants) {
    const grantSchema = grant.schema as SURefSchemaName;
    const grantName = grant.name as string;

    const grantedItem = SalvageUnionReference.findIn(
      grantSchema,
      (item) => item.name === grantName
    );

    if (grantedItem) {
      const grantedEntityData: TablesInsert<"suentities"> = {
        pilot_id: newEntity.pilot_id,
        mech_id: newEntity.mech_id,
        crawler_id: newEntity.crawler_id,
        parent_entity_id: newEntity.id, // Links to grantor
        schema_name: grantSchema,
        schema_ref_id: grantedItem.id,
        metadata: null,
      };
      await createNormalizedEntity(grantedEntityData);
    }
  }
}
```

### Choice Management

**Location**: `apps/suref-web/src/hooks/suentity/useManageEntityChoices.ts`

**Flow**:

1. Component calls `useManageEntityChoices(entityId)`
2. Returns callback `(choiceRefId, value) => void`
3. If `value` is `undefined`: delete choice
4. If `value` is provided: upsert choice
5. Cache automatically invalidated

**Key Code**:

```typescript
export function useManageEntityChoices(entityId: string | undefined) {
  const upsertChoice = useUpsertPlayerChoice();
  const deleteChoice = useDeletePlayerChoice();

  return useCallback(
    (choiceRefId: string, value: string | undefined) => {
      if (!entityId) return;

      if (value === undefined) {
        // Delete choice
        const choices = queryClient.getQueryData<Tables<"player_choices">[]>(
          playerChoicesKeys.forEntity(entityId)
        );
        const existingChoice = choices?.find(
          (c) => c.choice_ref_id === choiceRefId
        );
        if (existingChoice) {
          deleteChoice.mutate({ id: existingChoice.id, entityId });
        }
      } else {
        // Upsert choice
        upsertChoice.mutate({
          entity_id: entityId,
          choice_ref_id: choiceRefId,
          value,
        });
      }
    },
    [entityId, queryClient, upsertChoice, deleteChoice]
  );
}
```

### Nested Choice Support

**Migration**: `apps/suref-web/supabase/migrations/20250131_nested_choices.sql`

**Key Features**:

- `player_choice_id` column added to `player_choices`
- `entity_id` made nullable
- Constraint ensures exactly one parent (entity OR choice)
- Unique constraint per parent choice
- Recursive RLS policy for ownership checks

**Usage**:

```typescript
// Entity choice
upsertChoice.mutate({
  entity_id: entityId,
  choice_ref_id: "choice-id",
  value: "systems::laser-rifle",
});

// Nested choice (belongs to another choice)
upsertChoice.mutate({
  player_choice_id: parentChoiceId,
  choice_ref_id: "nested-choice-id",
  value: "modules::targeting-computer",
});
```

### Hydrated Entities

**Type**: `apps/suref-web/src/types/hydrated.ts`

**Purpose**: Combines database rows with reference data and choices for easy access in components.

**Usage**:

```typescript
const entity: HydratedEntity = {
  // Database row
  id: "entity-uuid",
  pilot_id: "pilot-uuid",
  schema_name: "abilities",
  schema_ref_id: "ability-id",

  // Hydrated data
  ref: abilityReferenceData, // From SalvageUnionReference.get()
  choices: [
    /* player choices */
  ],
  parentEntity: parentEntity, // If granted
};

// Access in component
entity.ref.name; // "Auto-Turret"
entity.ref.grants; // [{ name: "Auto-Turret", schema: "equipment" }]
entity.ref.choices; // [{ id: "...", name: "Personality" }]
entity.choices; // Player's selections
```

---

## New Patterns Discovered During Audit

### New Grants Patterns

#### Pattern: Ability Grants Equipment (Extended)

**Existing Pattern**: Abilities that grant equipment automatically (Auto-Turret, Custom Sniper Rifle)

**New Discovery**: Holo Companion ability should grant Holo Companion equipment

- **Entity**: Holo Companion (Ability)
- **ID**: `3364cc4f-227f-4f88-8b73-a09309e293f0`
- **Rule Reference**: Page 35 - "You have created an intelligent, holographic, A.I. companion... Add this to your Pilot Inventory."
- **Recommendation**: Add `grants: [{ name: "Holo Companion", schema: "equipment" }]`
- **Rationale**: The ability explicitly states to add the companion to inventory, indicating it should be granted equipment

**Summary**: 
- Total abilities with grants: 3 (Auto-Turret, Custom Sniper Rifle, Holo Companion)
- Pattern: Abilities that create/acquire equipment grant that equipment automatically

### New Choices Patterns

#### Pattern: Equipment Customization Choices

**New Discovery**: Equipment that requires player customization should have choices arrays

1. **Custom Sniper Rifle** (Equipment)
   - **ID**: `fc761f88-48ef-4925-8335-b7a6908a27f3`
   - **Rule Reference**: Page 50 - "Choose if it is a Ballistic or Energy weapon... At each Tech Level you may choose an additional modification"
   - **Recommendation**: Add choices for:
     - Weapon type (Ballistic or Energy) - schema-based or custom text
     - Modifications (Rangefinder, Laser Guidance, etc.) - schema-based with constraints
   - **Rationale**: Rules explicitly require player choices for weapon type and modifications

2. **Holo Companion** (Equipment)
   - **ID**: `dd96f7c0-3760-4b71-9451-77ced25a3b09`
   - **Rule Reference**: Page 35 - "Describe your Companion's appearance, and name them."
   - **Recommendation**: Add choices for:
     - Name (custom text)
     - Appearance description (optional, could be notes)
   - **Rationale**: Rules require naming the companion

**Summary**: Equipment that represents customizable entities (companions, custom weapons) should have choices for player customization.

#### Pattern: NPC Name Choices

**New Discovery**: All NPCs should have Name choices, not just metadata storage

**Affected Entities**:
- **Crawler NPCs** (5 entities): Augmented, Battle, Engineering, Exploratory, Trade Caravan
- **Crawler Bay NPCs** (10 entities): All bay types (Command, Mech, Storage, Armament, Crafting, Trading, Med, Pilot, Armoury, Cantina)

**Rule Reference**: 
- Crawlers: Page 216-217 - "Name them and give them a Keepsake and Motto"
- Bays: Standard NPC pattern - all NPCs should be named

**Recommendation**: Add `Name` choice to `npc.choices` array for all crawler and bay NPCs

**Rationale**: 
- Names are player customization choices, not game state
- Names should be stored in `player_choices`, not `metadata.npc.name` or `crawlers.npc.name`
- Migration planned in Phase 4 to move names from metadata to choices

**Pattern**: NPCs consistently have Name, Keepsake, and Motto choices (where applicable)

#### Pattern: Module A.I. Personality Choices

**New Discovery**: Modules that represent A.I. entities should have personality choices

**Entity**: Auto-Repair Droid (Module)
- **Rule Reference**: Modules with A.I. should allow personality selection
- **Recommendation**: Add A.I. Personality choice (roll table)
- **Rationale**: Consistent with other A.I. entities (Auto-Turret, crawler A.I.)

**Summary**: A.I. entities (equipment, modules, crawlers) should have A.I. Personality choices using roll tables.

### Patterns Confirmed as Correct

#### Pattern: Stat Blocks Don't Need Grants/Choices

**Confirmed**: Reference data that represents stat blocks (not player-selectable entities) correctly don't have grants/choices:
- Creatures, Bio-titans, Meld, Squads, NPCs (templates)
- Vehicles, Distances, Roll Tables
- Ability Tree Requirements, Crawler Tech Levels

**Rationale**: These are lookup/reference data, not entities players add to their sheets.

#### Pattern: Classes Don't Need Grants/Choices

**Confirmed**: Core and Advanced classes correctly don't have grants/choices arrays.

**Rationale**: Classes are selected at character creation/advancement, not via the grants/choices system. Ability tree requirements handle class prerequisites.

#### Pattern: Chassis Don't Need Grants/Choices

**Confirmed**: Chassis correctly don't have grants/choices arrays.

**Rationale**: Chassis are selected at character creation. Patterns (starting configurations) are reference data, not grants. Chassis abilities are part of the chassis definition.

### Implementation Status

**Completed**:
- ✅ Audit of all 22 data files
- ✅ Identification of missing grants/choices
- ✅ Documentation of patterns and rationale

**Pending Implementation**:
- ⚠️ Add grants to Holo Companion ability
- ⚠️ Add choices to Custom Sniper Rifle equipment
- ⚠️ Add choices to Holo Companion equipment
- ⚠️ Add Name choices to all crawler NPCs (5 entities)
- ⚠️ Add Name choices to all crawler bay NPCs (10 entities)
- ⚠️ Add A.I. Personality choice to Auto-Repair Droid module

**Total Entities Needing Updates**: 19
- 1 grant addition
- 18 choices additions

---

## Summary

### Grants

- **Purpose**: Automatically create entities when parent entity is selected
- **Location**: `grants` property on reference entities
- **Implementation**: Processed in `useCreateEntity` `onSuccess` callback
- **Result**: New `suentities` row with `parent_entity_id` linking to grantor
- **Common Pattern**: Abilities that create/acquire equipment grant that equipment automatically

### Choices

- **Purpose**: Allow players to customize entities through selections
- **Location**: `choices` property on reference entities (and actions)
- **Implementation**: Stored in `player_choices` table, managed via hooks
- **Result**: `player_choices` rows linking to entities or other choices
- **Common Patterns**:
  - NPCs: Name, Keepsake, Motto, A.I. Personality
  - Equipment: Name, weapon type, modifications
  - Systems/Modules: Chassis selection, module selection, A.I. Personality

### GameEntities (suentities)

- **Purpose**: Link reference data to player sheets
- **Structure**: One row per entity instance on a sheet
- **Relationships**: Links to pilot/mech/crawler, reference data, and parent entities

### PlayerChoices (player_choices)

- **Purpose**: Store player selections for entity customization
- **Structure**: One row per choice selection
- **Relationships**: Links to entities or other choices (nested)

### Integration

- Grants create entities automatically
- Choices customize entities through selections
- Nested choices enable complex selection chains
- All data flows through normalized database schema
- Live sheets hydrate entities with reference data and choices

### Reference Guide for Future Additions

**When to Add Grants**:
- Entity automatically provides another entity when selected
- Game rules say "grants", "gives", "provides", or "add to inventory"
- Example: Ability that creates equipment grants that equipment

**When to Add Choices**:
- Entity requires player selection/customization
- Game rules say "choose", "select", "name", "roll", or require player input
- Examples: Name NPC, choose weapon type, roll for personality, select modification

**When NOT to Add Grants/Choices**:
- Entity is a stat block or reference data (creatures, vehicles, NPC templates)
- Entity is selected at character creation (classes, chassis)
- Entity is metadata or lookup data (distances, roll tables, ability tree requirements)
