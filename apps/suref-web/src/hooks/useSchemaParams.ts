import { useParams } from '@tanstack/react-router'

export interface SchemaRouteParams {
  schemaId: string
  itemId?: string
}

export function useSchemaParams(): SchemaRouteParams {
  const params = useParams({ strict: false })
  return {
    schemaId: (params as { schemaId?: string }).schemaId || '',
    itemId: (params as { itemId?: string }).itemId,
  }
}

export function useSchemaId(): string {
  const { schemaId } = useSchemaParams()
  return schemaId
}
