import type { SURefObjectChoice } from 'salvageunion-reference'
import { getModel } from 'salvageunion-reference'
import { EntityDisplay } from './index'

export interface PreselectedEntityDisplayProps {
  choice: SURefObjectChoice
  selectedChoice: string | undefined
}

export function PreselectedEntityDisplay({
  choice,
  selectedChoice,
}: PreselectedEntityDisplayProps) {
  const schema = choice.schema?.[0]
  if (!schema) return null

  const model = getModel(schema.toLowerCase())
  if (!model) return null

  const entity = model.find((e) => e.name === selectedChoice)
  if (!entity) return null

  return <EntityDisplay hideActions data={entity} collapsible={false} />
}
