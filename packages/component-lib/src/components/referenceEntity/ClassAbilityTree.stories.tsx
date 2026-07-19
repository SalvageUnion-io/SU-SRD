import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { ClassAbilityTree } from './ClassAbilityTree'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Entity/Class Ability Tree',
}

const classes = SalvageUnionReference.Classes.all()

/** The full core / advanced / legendary tree listing for a real class. */
export const Default: Story = () =>
  classes[0] ? (
    <div className="max-w-2xl p-4">
      <ClassAbilityTree classEntity={classes[0]} />
    </div>
  ) : null

/** A second class — trees vary in depth (core count, advanced/legendary presence). */
export const AnotherClass: Story = () =>
  classes[1] ? (
    <div className="max-w-2xl p-4">
      <ClassAbilityTree classEntity={classes[1]} />
    </div>
  ) : null
