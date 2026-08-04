import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { Skeleton } from './Skeleton'

export default {
  title: 'Containers/Skeleton',
}

/** mode=card — mirrors the Card anatomy (frame / band / body), at both densities. */
export const Card: Story = () => (
  <div className="flex flex-wrap items-start gap-6 bg-paper p-4">
    <div className="w-[380px]">
      <Caption>mode=card · frame + band + body ghosts</Caption>
      <Skeleton mode="card" rows={3} />
    </div>
    <div className="w-[300px]">
      <Caption>mode=card compact · the medium-card density</Caption>
      <Skeleton mode="card" compact rows={3} />
    </div>
  </div>
)

/** mode=list — a stack of row ghosts (rows prop). */
export const List: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <Caption>mode=list · rows=4</Caption>
    <Skeleton mode="list" rows={4} />
  </div>
)

/** mode=text — lines of prose ghosts. */
export const Text: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <Caption>mode=text · rows=5</Caption>
    <Skeleton mode="text" rows={5} />
  </div>
)
