<!-- 18705a7e-356e-4db2-ab62-c9aa5c3d53e4 c25b1961-08e6-4d75-8fec-a3fbfdbdb774 -->
# Pilot Creation Wizard Implementation

## Overview

Replace the current "New Pilot" button behavior with a multi-step wizard that collects all pilot information before database creation. The wizard will have 3 steps: Class & Ability Selection, Equipment Selection, and Details Entry.

## Implementation Steps

### 1. Create Wizard Route and Component Structure

- **File**: `apps/suref-web/src/routes/dashboard/pilots/new.tsx`
- Create new route for `/dashboard/pilots/new`
- Lazy load the wizard component

- **File**: `apps/suref-web/src/components/PilotWizard/index.tsx`
- Main wizard container component
- Manages wizard state (step, selected class, selected ability, selected equipment, pilot details)
- Uses state management to track wizard progress
- Handles navigation between steps
- On final step completion, creates pilot and navigates to pilot sheet

### 2. Wizard State Management

- **File**: `apps/suref-web/src/components/PilotWizard/usePilotWizardState.ts`
- Custom hook to manage wizard state:
- `selectedClassId: string | null`
- `selectedAbilityId: string | null`
- `selectedEquipmentIds: string[]` (max 2)
- `callsign: string`
- `background: string`
- `motto: string`
- `keepsake: string`
- `appearance: string`
- `currentStep: number` (1, 2, or 3)
- `completedSteps: Set<number>` - Track which steps are completed
- Validation functions for each step
- `isStepComplete(step: number): boolean` - Check if a step is completed
- `getNextIncompleteStep(): number | null` - Get the first incomplete step
- `goToStep(step: number)` - Navigate to a specific step (allows going back)
- `goToNextStep()` - Navigate forward to the least-finished step (first incomplete step)
- `goToPreviousStep()` - Navigate backward to previous step
- Reset function

### 3. Step 1: Class and Ability Selection

- **File**: `apps/suref-web/src/components/PilotWizard/ClassSelectionStep.tsx`
- Display core classes in tabbed interface (tabs at bottom)
- Use `getCoreClasses()` from `salvageunion-reference` to get all 6 core classes
- For each class, show only level 1 abilities from each core tree
- Special handling for Salvager class (can pick from any core ability tree)
- Custom rendering (not using EntityDisplay) but showing same content structure
- "SELECT <CLASS>" button enabled only when an ability is selected
- Header: "Choose your Pilot Class and your first Ability"
- Description text as specified

### 4. Step 2: Equipment Selection

- **File**: `apps/suref-web/src/components/PilotWizard/EquipmentSelectionStep.tsx`
- Filter equipment to Tech Level 1 only using `getTechLevel()` utility
- Display all TL1 pilot equipment in a selectable grid/list
- Allow selection of exactly 2 pieces of equipment
- "NEXT" button enabled only when 2 equipment items are selected
- Header: "Choose Your Equipment"
- Description: "You may choose two pieces of Tech 1 Pilot Equipment from the list."

### 5. Step 3: Details Entry

- **File**: `apps/suref-web/src/components/PilotWizard/DetailsStep.tsx`
- Form fields for:
- Callsign (text input with optional roll button if callsign table exists)
- Background (text area)
- Motto (text area)
- Keepsake (text area)
- Appearance (text area)
- Each field has descriptive text as specified
- "MEET <Callsign>" button enabled when all fields are filled
- Button text uses the entered callsign

### 6. Pilot Creation Logic

- **File**: `apps/suref-web/src/components/PilotWizard/useCreatePilotFromWizard.ts`
- Custom hook that:

1. Creates pilot with base stats (10 HP, 5 AP, 0 damage, 0 AP)
2. Creates class entity using `useCreateEntity()` for suentities
3. Creates ability entity using `useCreateEntity()`
4. Creates equipment entities (2) using `useCreateEntity()`
5. Updates pilot with callsign, background, motto, keepsake, appearance
6. Navigates to `/dashboard/pilots/{id}` on success

### 7. Update EntityGrid to Navigate to Wizard

- **File**: `apps/suref-web/src/components/Dashboard/EntityGrid.tsx`
- Modify `handleCreate` for pilots table to navigate to `/dashboard/pilots/new` instead of creating directly
- Keep existing behavior for other entity types

### 8. Helper Utilities

- **File**: `apps/suref-web/src/components/PilotWizard/utils.ts`
- `getLevel1AbilitiesForClass(class: SURefClass): SURefAbility[]` - Get first ability from each tree
- `getTL1Equipment(): SURefEquipment[]` - Filter equipment by tech level 1
- `validateWizardStep(step: number, state: WizardState): boolean` - Validate step completion

### 9. UI Components

- Reuse existing Chakra UI components (Button, VStack, Box, Text, etc.)
- Create custom tab component for class selection (tabs at bottom)
- Create equipment selection cards similar to EntityDisplay but simplified
- Create form inputs matching existing pilot input styles

### 10. Navigation and Flow

- Wizard has "BACK" and "NEXT" buttons (except step 1 which only has "SELECT")
- Step indicator showing current step (1/3, 2/3, 3/3)
- On final step, "MEET <Callsign>" creates pilot and navigates
- Handle loading states during creation
- Handle errors gracefully

## Key Implementation Details

- **Class Selection**: Use `SalvageUnionReference.Classes.all()` and filter for core classes (has `coreTrees`, not `hybrid`)
- **Ability Display**: For each class, get all abilities, filter by `level === 1` and tree in `coreTrees`
- **Salvager Special Case**: Show all core ability trees from all classes
- **Equipment Filtering**: Use `getTechLevel()` from utils to filter `techLevel === 1`
- **Pilot Creation**: Use `useCreatePilot()` and `useCreateEntity()` hooks
- **State Persistence**: Consider localStorage for draft saving (optional enhancement)

## Files to Create

1. `apps/suref-web/src/routes/dashboard/pilots/new.tsx`
2. `apps/suref-web/src/components/PilotWizard/index.tsx`
3. `apps/suref-web/src/components/PilotWizard/usePilotWizardState.ts`
4. `apps/suref-web/src/components/PilotWizard/ClassSelectionStep.tsx`
5. `apps/suref-web/src/components/PilotWizard/EquipmentSelectionStep.tsx`
6. `apps/suref-web/src/components/PilotWizard/DetailsStep.tsx`
7. `apps/suref-web/src/components/PilotWizard/useCreatePilotFromWizard.ts`
8. `apps/suref-web/src/components/PilotWizard/utils.ts`

## Files to Modify

1. `apps/suref-web/src/components/Dashboard/EntityGrid.tsx` - Update pilot creation to navigate to wizard