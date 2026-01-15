import { useEffect, useState } from 'react'
import { getModel } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

interface UseSchemaDataResult {
  data: SURefEntity[]
  loading: boolean
  error: string | null
}

export function useSchemaData(schemaId: string | undefined): UseSchemaDataResult {
  const [data, setData] = useState<SURefEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!schemaId) {
      setError('Schema not found')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const model = getModel(schemaId)
      if (!model) {
        throw new Error(`Unknown schema: ${schemaId}`)
      }
      const jsonData = model.all()
      setData(jsonData as SURefEntity[])
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setLoading(false)
    }
  }, [schemaId])

  return { data, loading, error }
}
