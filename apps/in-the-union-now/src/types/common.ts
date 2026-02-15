// Enum types - canonical definitions in salvageunion-reference
export type { ParentType, ItemCondition } from 'salvageunion-reference'

// Typed update handler - constrains field names and value types
export type EntityUpdateHandler<T> = <K extends keyof T>(field: K, value: T[K]) => void
