import { Caption } from 'component-lib/stories/harness'
import { useState } from 'react'
import { FlavorStep } from './FlavorStep'
import { RollTableButton } from './RollTableButton'

export default {
  title: 'Compositions/Wizard/Flavor Step',
}

/** A free-text pilot flavour field with its "roll on the table" affordance. */
export const Default = () => {
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
