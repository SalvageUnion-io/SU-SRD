import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { KindLabel } from './KindLabel'

/**
 * The kind, for screen readers only (E9): set inside a title, it ends the
 * title's accessible name. Nothing shows: the heading below reads
 * "Counter-Hacking (Ability, Advanced Hacking Tree)".
 */
export default {
  title: 'Compositions/Entity/KindLabel',
}

export const InATitle: Story = () => (
  <div>
    <Caption>an h2 whose accessible name ends with its kind</Caption>
    <h2 style={{ margin: 0 }}>
      Counter-Hacking
      <KindLabel kind="Ability · Advanced Hacking Tree" />
    </h2>
  </div>
)
