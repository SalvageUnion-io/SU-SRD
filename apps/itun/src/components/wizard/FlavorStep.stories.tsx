import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { FlavorStep } from './FlavorStep'
import { RollTableButton } from './RollTableButton'

const FRAME: CSSProperties = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
  padding: tokens.space[16],
}

export default {
  title: 'Compositions/Wizard/Flavor Step',
}

/** A free-text pilot flavour field with its "roll on the table" affordance. */
export const Default = () => {
  const [motto, setMotto] = useState('')
  return (
    <div className="sheet--pilot" style={FRAME}>
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
