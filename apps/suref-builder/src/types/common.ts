import type { Database } from './database-generated.types'

export type { DataValue } from 'suref-react'

export interface CrawlerNPC {
  name: string
  notes: string
  hitPoints: number | null
  damage: number
}

export type ValidTable = keyof Database['public']['Tables']
