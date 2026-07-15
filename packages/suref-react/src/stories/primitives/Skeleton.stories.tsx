import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'

import { Skeleton } from '../../components/skeleton/Skeleton'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Skeleton',
}

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 font-cond text-label uppercase tracking-caps text-wk-muted">{children}</div>
)

/** mode=card — mirrors the DisplayCard anatomy (frame / band / body). */
export const Card: Story = () => (
  <div className="max-w-xs bg-paper p-4">
    <Caption>mode=card · frame + band + body ghosts</Caption>
    <Skeleton mode="card" rows={3} />
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
