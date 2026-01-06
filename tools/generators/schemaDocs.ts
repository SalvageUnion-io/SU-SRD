#!/usr/bin/env bun
/**
 * Generates markdown documentation from JSON schemas
 * Creates comprehensive docs with field descriptions, required/optional fields, and examples
 */

import { join } from 'path'

async function main() {
  const schemasDir = join(import.meta.dir, '..', '..', 'src', 'reference', 'schemas')
  const dataDir = join(import.meta.dir, '..', '..', 'src', 'reference', 'data')
  const docsDir = join(import.meta.dir, '..', '..', 'docs', 'schemas')

  interface SchemaInfo {
    id: string
    title: string
    description: string
    schemaFile: string
    dataFile: string
  }

  // Load schema index
  const schemaIndexFile = Bun.file(join(schemasDir, 'index.json'))
  const schemaIndex = (await schemaIndexFile.json()) as {
    schemas: Array<{
      id: string
      title: string
      description: string
      dataFile: string
      schemaFile: string
    }>
  }

  function generateFieldTable(
    properties: Record<string, unknown>,
    required: string[] = []
  ): string {
    if (!properties) return ''

    let table = '| Field | Type | Required | Description |\n'
    table += '|-------|------|----------|-------------|\n'

    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const def = fieldDef as Record<string, unknown>

      // Skip fields that are just `true` (inherited from allOf)
      if (typeof def === 'boolean' && def === true) continue

      const isRequired = required.includes(fieldName) ? '✅' : '❌'
      const type = getFieldType(def)
      const description = (def.description as string) || ''

      table += `| \`${fieldName}\` | ${type} | ${isRequired} | ${description} |\n`
    }

    return table
  }

  function getFieldType(def: Record<string, unknown>): string {
    if (def.$ref) {
      const refParts = String(def.$ref).split('/')
      return `\`${refParts[refParts.length - 1]}\``
    }

    if (def.type === 'array') {
      const items = def.items as Record<string, unknown> | undefined
      if (items?.$ref) {
        const refParts = String(items.$ref).split('/')
        return `Array<\`${refParts[refParts.length - 1]}\`>`
      }
      if (items?.type) {
        return `Array<${items.type}>`
      }
      return 'Array'
    }

    if (def.type) {
      return String(def.type)
    }

    if (def.oneOf) {
      return (def.oneOf as Record<string, unknown>[]).map((o) => getFieldType(o)).join(' | ')
    }

    if (def.const) {
      return `"${def.const}"`
    }

    return 'unknown'
  }

  function generateExampleJson(_schema: Record<string, unknown>, data: unknown[]): string {
    if (!data || data.length === 0) return '```json\n// No example data available\n```'

    // Get first item as example
    const example = data[0]
    return '```json\n' + JSON.stringify(example, null, 2) + '\n```'
  }

  async function generateSchemaDoc(schemaInfo: SchemaInfo): Promise<string> {
    // Load schema
    const schemaFile = Bun.file(join(schemasDir, schemaInfo.schemaFile.replace('schemas/', '')))
    const schema = (await schemaFile.json()) as {
      items?: {
        properties?: Record<string, unknown>
        required?: string[]
        allOf?: Array<{ $ref?: string }>
      }
    } & Record<string, unknown>

    // Load data for examples
    let data: unknown[] = []
    try {
      const dataFile = Bun.file(join(dataDir, schemaInfo.dataFile.replace('data/', '')))
      data = (await dataFile.json()) as unknown[]
    } catch {
      console.warn(`Could not load data for ${schemaInfo.id}`)
    }

    let doc = `# ${schemaInfo.title}\n\n`
    doc += `${schemaInfo.description}\n\n`

    // Add metadata
    doc += `## Metadata\n\n`
    doc += `- **Schema ID**: \`${schemaInfo.id}\`\n`
    doc += `- **Schema File**: \`${schemaInfo.schemaFile}\`\n`
    doc += `- **Data File**: \`${schemaInfo.dataFile}\`\n`
    doc += `- **Total Items**: ${data.length}\n\n`

    // Add field documentation
    if (schema.items?.properties) {
      doc += `## Fields\n\n`
      doc += generateFieldTable(schema.items.properties, schema.items.required || [])
      doc += '\n'
    }

    // Add example
    doc += `## Example\n\n`
    doc += generateExampleJson(schema, data)
    doc += '\n'

    // Add common patterns if available
    if (schema.items?.allOf) {
      doc += `## Schema Composition\n\n`
      doc += `This schema extends the following definitions:\n\n`
      for (const ref of schema.items.allOf) {
        if (ref.$ref) {
          doc += `- \`${ref.$ref}\`\n`
        }
      }
      doc += '\n'
    }

    return doc
  }

  // Generate docs for all schemas
  console.log('Generating schema documentation...\n')

  for (const schemaInfo of schemaIndex.schemas) {
    try {
      const doc = await generateSchemaDoc(schemaInfo)
      const filename = `${schemaInfo.id}.md`
      await Bun.write(join(docsDir, filename), doc)
      console.log(`✅ Generated ${filename}`)
    } catch (error) {
      console.error(`❌ Error generating docs for ${schemaInfo.id}:`, error)
    }
  }

  console.log(`\n✅ Schema documentation generated in ${docsDir}`)
}

// Export for use as module
export default main

// Run directly if called as script
if (import.meta.main) {
  await main()
}
