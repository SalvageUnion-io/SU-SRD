/* Ported from packages/component-lib/src/components/skeleton/Skeleton.stories.tsx. */
import { Skeleton } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/** `mode="card"` — mirrors the Card anatomy (frame / band / body), at both densities. */
export function CardMode() {
  return (
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
}

/** `mode="list"` and `mode="text"` — row ghosts and prose ghosts. */
export function ListAndText() {
  return (
    <div className="flex flex-wrap items-start gap-6 bg-paper p-4">
      <div className="w-[340px]">
        <Caption>mode=list · rows=4</Caption>
        <Skeleton mode="list" rows={4} />
      </div>
      <div className="w-[340px]">
        <Caption>mode=text · rows=5</Caption>
        <Skeleton mode="text" rows={5} />
      </div>
    </div>
  )
}
