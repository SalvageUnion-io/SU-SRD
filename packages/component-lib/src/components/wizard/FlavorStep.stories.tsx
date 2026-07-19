import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { FlavorStep } from './FlavorStep'
import { RollTableButton } from './RollTableButton'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Flavor Step',
}

/** A free-text pilot flavour field with its "roll on the table" affordance. */
export const Default: Story = () => {
  const [motto, setMotto] = useState('')
  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>FlavorStep — motto</Caption>
        <FlavorStep
          field="motto"
          label="Motto"
          value={motto}
          onChange={setMotto}
          placeholder="What does your Pilot live by?"
        />
      </div>
      <div>
        <Caption>RollTableButton — standalone</Caption>
        <RollTableButton field="motto" onRoll={setMotto} />
      </div>
    </div>
  )
}
