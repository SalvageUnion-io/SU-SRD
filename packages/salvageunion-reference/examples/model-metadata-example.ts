/**
 * Example: Using model metadata properties
 *
 * This example demonstrates how to use the schemaName and displayName
 * readonly properties on model instances.
 */

import { SalvageUnionReference, SchemaToDisplayName } from '../lib/index.js'

// Access schema name and display name as readonly properties
console.log('Equipment Model Metadata:')
console.log('  Schema Name:', SalvageUnionReference.Equipment.schemaName)
console.log('  Display Name:', SalvageUnionReference.Equipment.displayName)
console.log()

console.log('Abilities Model Metadata:')
console.log('  Schema Name:', SalvageUnionReference.Abilities.schemaName)
console.log('  Display Name:', SalvageUnionReference.Abilities.displayName)
console.log()

console.log('Core Classes Model Metadata:')
console.log('  Schema Name:', SalvageUnionReference.CoreClasses.schemaName)
console.log('  Display Name:', SalvageUnionReference.CoreClasses.displayName)
console.log()

// Use SchemaToDisplayName map to get display names
console.log('SchemaToDisplayName Map:')
console.log('  equipment →', SchemaToDisplayName.equipment)
console.log('  abilities →', SchemaToDisplayName.abilities)
console.log('  classes.core →', SchemaToDisplayName['classes.core'])
console.log()

// Example: Dynamic model selection with metadata
function printModelInfo(model: { schemaName: string; displayName: string; all: () => unknown[] }) {
  console.log(`Model: ${model.displayName}`)
  console.log(`  Schema: ${model.schemaName}`)
  console.log(`  Count: ${model.all().length} items`)
}

console.log('All Models:')
printModelInfo(SalvageUnionReference.Equipment)
printModelInfo(SalvageUnionReference.Modules)
printModelInfo(SalvageUnionReference.Systems)
printModelInfo(SalvageUnionReference.Chassis)
