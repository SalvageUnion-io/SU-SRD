import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { RadioCardGroup } from './RadioCardGroup'

export default {
  title: 'Containers/Radio Card Group',
}

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  maxWidth: '22rem',
} satisfies CSSProperties

/** Real classes, as ITUN's class-path picker offers them. */
const classes = SalvageUnionReference.Classes.all().slice(0, 4)

/**
 * RadioCardGroup — the radiogroup around an exactly-one picker's cards, as
 * ITUN's class-path picker uses it: each class a `selectionRole="radio"` card.
 * Tab reaches the chosen card; the arrow keys move between the cards and
 * choose the one they land on.
 */
export const Default: Story = () => {
  const [chosen, setChosen] = useState(classes[0]?.id ?? '')
  return (
    <div>
      <Caption>Tab to the chosen class, then ↑ / ↓</Caption>
      <RadioCardGroup label="Class" style={STACK}>
        {classes.map((cls) => (
          <ReferenceEntityCard
            key={cls.id}
            data={cls}
            size="small"
            extent="head"
            selected={chosen === cls.id}
            selectionRole="radio"
            cardClickLabel={cls.name}
            onCardClick={() => setChosen(cls.id)}
          />
        ))}
      </RadioCardGroup>
    </div>
  )
}
