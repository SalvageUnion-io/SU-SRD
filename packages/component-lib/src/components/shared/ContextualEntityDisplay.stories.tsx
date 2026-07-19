import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { ContextualEntityDisplay } from './ContextualEntityDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Contextual Entity Display',
}

const chassis = SalvageUnionReference.Chassis.all()[0]

/** Wraps inline text so hovering it reveals the referenced entity's card. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <Caption>ContextualEntityDisplay — hover the name</Caption>
    <p className="font-body text-caption text-ink-2">
      Your mech is a{' '}
      <ContextualEntityDisplay schemaName="chassis" entityName={chassis?.name ?? 'Mule'}>
        <span className="font-bold underline">{chassis?.name ?? 'Mule'}</span>
      </ContextualEntityDisplay>{' '}
      chassis.
    </p>
  </div>
)
