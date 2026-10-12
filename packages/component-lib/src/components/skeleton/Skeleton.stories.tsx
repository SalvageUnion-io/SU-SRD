import type { CSSProperties } from 'react'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Skeleton } from './Skeleton'

export default {
  title: 'Containers/Skeleton',
}

const FRAME = {
  maxWidth: '28rem',
  backgroundColor: color.paper,
  padding: space[16],
} satisfies CSSProperties

/** mode=card — mirrors the Card anatomy (frame / band / body), at both densities. */
export const Card: Story = () => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: space[24],
      backgroundColor: color.paper,
      padding: space[16],
    }}
  >
    <div style={{ width: 380 }}>
      <Caption>mode=card · frame + band + body ghosts</Caption>
      <Skeleton mode="card" rows={3} />
    </div>
    <div style={{ width: 300 }}>
      <Caption>mode=card compact · the medium-card density</Caption>
      <Skeleton mode="card" compact rows={3} />
    </div>
  </div>
)

/** mode=list — a stack of row ghosts (rows prop). */
export const List: Story = () => (
  <div style={FRAME}>
    <Caption>mode=list · rows=4</Caption>
    <Skeleton mode="list" rows={4} />
  </div>
)

/** mode=text — lines of prose ghosts. */
export const Text: Story = () => (
  <div style={FRAME}>
    <Caption>mode=text · rows=5</Caption>
    <Skeleton mode="text" rows={5} />
  </div>
)
