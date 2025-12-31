export interface SchemaInfo {
  id: string
  title: string
  description: string
  dataFile: string
  schemaFile: string
  itemCount: number
  requiredFields: string[]
  displayName?: string
  displayNamePlural?: string
}
