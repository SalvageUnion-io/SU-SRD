import '../../styles/sheet.css'
import { Field, tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { Photo } from 'itun-domain/schemas/photo'
import { STARTER_MECHS, STARTER_PILOTS } from 'itun-domain/starterSet/starterSet'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { chassisArt } from '../../lib/photos/defaultArt'
import { PhotoBeside } from '../sheet/PhotoBeside'
import { EntityPhoto } from './EntityPhoto'

export default {
  title: 'Compositions/Entity Photo',
}

const STACK = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
  padding: tokens.space[16],
} satisfies CSSProperties

const ROW = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[24] } satisfies CSSProperties

const CELL = { width: '12rem' } satisfies CSSProperties

const FIELDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const bonesaw = STARTER_PILOTS[0]
const scrapper = STARTER_MECHS[0]

/** Stands in for the store write: the story holds the photo itself. */
function useLocalPhoto(initial: Photo | undefined) {
  const [photo, setPhoto] = useState(initial)
  return { photo, onChange: async (next: Photo | undefined) => setPhoto(next) }
}

/**
 * A player-built entity's picture (Starter Set data): its own photo, else the
 * default art it already shows (a mech's chassis), else — only while editable —
 * an empty frame that makes room for one. Beside an identity card's fields
 * once the card is wide enough, above them below that.
 */
export const Default = () => {
  const pilot = useLocalPhoto(bonesaw?.photo)
  return (
    <div style={STACK}>
      <div style={ROW}>
        <div style={CELL}>
          <Caption>Own photo (a Starter Set portrait)</Caption>
          <EntityPhoto photo={bonesaw?.photo} name={bonesaw?.name ?? 'Bonesaw'} />
        </div>
        <div style={CELL}>
          <Caption>No photo: the chassis art</Caption>
          <EntityPhoto
            photo={undefined}
            fallback={chassisArt(scrapper?.chassisRef ?? 'scrapper')}
            name={scrapper?.name ?? 'Scrapper'}
          />
        </div>
        <div style={CELL}>
          <Caption>No photo, no art, editable</Caption>
          <EntityPhoto photo={undefined} name="New crawler" onChange={async () => undefined} />
        </div>
      </div>
      <div>
        <Caption>Beside an identity card&rsquo;s fields, editable</Caption>
        <PhotoBeside
          photo={<EntityPhoto photo={pilot.photo} name="Bonesaw" onChange={pilot.onChange} />}
        >
          <div style={FIELDS}>
            <Field label="Name" value={bonesaw?.name ?? ''} />
            <Field label="Motto" value={bonesaw?.motto ?? ''} />
            <Field label="Keepsake" value={bonesaw?.keepsake ?? ''} />
          </div>
        </PhotoBeside>
      </div>
    </div>
  )
}
