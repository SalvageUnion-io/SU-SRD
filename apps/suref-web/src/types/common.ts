import type { Database } from './database-generated.types'

export interface DataValue {
  label: string | number
  value?: string | number
  type?: string
}

export interface CrawlerNPC {
  name: string
  notes: string
  hitPoints: number | null
  damage: number
}

export type ValidTable = keyof Database['public']['Tables']
