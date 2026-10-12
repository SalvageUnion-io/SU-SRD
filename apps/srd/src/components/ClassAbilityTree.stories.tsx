import { space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassAbilityTree } from './ClassAbilityTree'

export default {
  title: 'Compositions/Entity/Class Ability Tree',
}

const classes = SalvageUnionReference.Classes.all()

const FRAME = { maxWidth: '42rem', padding: space[16] } satisfies CSSProperties

/** The full core / advanced / legendary tree listing for a real class. */
export const Default = () =>
  classes[0] ? (
    <div style={FRAME}>
      <ClassAbilityTree classEntity={classes[0]} />
    </div>
  ) : null

/** A second class — trees vary in depth (core count, advanced/legendary presence). */
export const AnotherClass = () =>
  classes[1] ? (
    <div style={FRAME}>
      <ClassAbilityTree classEntity={classes[1]} />
    </div>
  ) : null
