/**
 * EntityPhoto — the picture on a player-built entity's sheet: its own photo
 * (`body.photo`) where it has one, else the default art the entity already
 * shows (a mech's chassis, a pattern's chassis, a built NPC's template), else —
 * only while it can be edited — an empty frame that makes room for one.
 *
 * With `onChange`, the frame carries Upload / Replace / Remove. Upload scales
 * and re-encodes the picked file (`lib/photos/uploadPhoto.ts`), stores it
 * through `convex/photos.ts`, and hands the resulting photo to `onChange`, which
 * writes it like any other field. Remove hands `undefined`; the server deletes
 * the file once no entity holds it. Without `onChange` (Read, a crewmate's
 * view, the public sheet) it is the picture alone, and nothing at all when
 * there is no picture.
 */

import type { Photo } from 'game-domain/schemas/photo'
import { photoUrl } from 'game-domain/schemas/photo'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useServerAction } from '../../lib/connection/useServerAction'
import type { PhotoUploader } from '../../lib/photos/uploadPhoto'
import { PhotoRefused, postPhoto, shrinkPhoto, uploadPhoto } from '../../lib/photos/uploadPhoto'
import { assetSrcSetFor, Button, EmptyState, tokens } from '../index'

/** Default art from the artwork CDN, which serves `-440q80`/`-880q80` derivatives. */
export type DefaultArt = { url: string; alt: string }

type EntityPhotoProps = {
  photo: Photo | undefined
  /** What the frame shows with no photo; omit where the entity has no art. */
  fallback?: DefaultArt | undefined
  /** The entity's name, for the picture's alt text and the controls' labels. */
  name: string
  /** Writes the photo field; omit where the entity is read-only. */
  onChange?: ((photo: Photo | undefined) => Promise<unknown>) | undefined
  /** The picture's box, where a page has its own (the pattern page's 4:3 art box). */
  frame?: CSSProperties | undefined
}

const FIGURE = {
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  minWidth: 0,
  position: 'relative',
} satisfies CSSProperties

const FRAME = {
  alignItems: 'center',
  aspectRatio: '3 / 4',
  display: 'flex',
  justifyContent: 'center',
  overflow: 'hidden',
  width: '100%',
} satisfies CSSProperties

const EMPTY = {
  ...FRAME,
  border: `${tokens.borderWidth.pill} dashed currentColor`,
  padding: tokens.space[12],
  textAlign: 'center',
} satisfies CSSProperties

const IMG = { height: '100%', objectFit: 'contain', width: '100%' } satisfies CSSProperties

/**
 * Upload, or Replace and Remove side by side, sharing the picture's width,
 * on the picture itself, along its foot (R49: its photo's controls sit on
 * the photo).
 */
const CONTROLS = {
  bottom: tokens.space[8],
  display: 'flex',
  gap: tokens.space[8],
  insetInline: tokens.space[8],
  position: 'absolute',
} satisfies CSSProperties

const CONTROL = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

/** The app's Convex client, loaded on the first upload rather than with the sheet. */
const client = async () => (await import('../../lib/connection/convexClient')).convexClient

/**
 * The upload steps against the app's Convex client, called imperatively (as the
 * stores' writes are) so a sheet renders without a Convex provider in reach, and
 * a test without a deployment URL.
 */
const UPLOADER: PhotoUploader = {
  generateUploadUrl: async () => (await client()).mutation(api.photos.generateUploadUrl, {}),
  claim: async ({ storageId }) =>
    (await client()).mutation(api.photos.claim, { storageId: storageId as Id<'_storage'> }),
  post: postPhoto,
}

/** A photo the player can fix says why; see `PhotoRefused`. */
const PHOTO_PLAYER_ERRORS = [PhotoRefused]

/** The frame is at most this wide; `sizes` tells the browser so. */
const SIZES = `${tokens.widthAtLeast('sm')} 16rem, 100vw`

export function EntityPhoto({ photo, fallback, name, onChange, frame }: EntityPhotoProps) {
  // A photo whose file is gone (deleted alongside its last holder while a copy
  // still names it) falls back rather than showing a broken image.
  const [failed, setFailed] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const upload = useServerAction(
    async (file: File) => {
      if (!onChange) return
      await onChange(await uploadPhoto(await shrinkPhoto(file), UPLOADER))
      setFailed(null)
    },
    {
      failure: 'The photo could not be saved. Try again.',
      toastId: 'entity-photo',
      playerErrors: PHOTO_PLAYER_ERRORS,
    }
  )
  const removal = useServerAction(async () => onChange?.(undefined), {
    failure: 'The photo could not be removed. Try again.',
    toastId: 'entity-photo',
  })
  const busy = upload.pending || removal.pending

  const own = photo ? photoUrl(photo) : undefined
  const ownShown = own !== undefined && own !== failed
  const src = ownShown ? own : fallback?.url
  // The CDN serves derivatives; an uploaded file is already sheet-sized.
  const cdn = !ownShown || photo?.kind === 'asset'
  if (src === undefined && onChange === undefined) return null

  return (
    <figure style={FIGURE} className="su-entity-photo">
      {src === undefined ? (
        <div style={{ ...EMPTY, ...frame }}>
          <EmptyState variant="inline" body="No picture yet." bodyInk="inherit" />
        </div>
      ) : (
        <div style={{ ...FRAME, ...frame }}>
          <img
            src={src}
            srcSet={cdn ? assetSrcSetFor(src) : undefined}
            sizes={cdn ? SIZES : undefined}
            alt={ownShown ? name : fallback?.alt}
            style={IMG}
            onError={() => {
              if (ownShown) setFailed(own)
            }}
          />
        </div>
      )}
      {onChange && (
        <div style={CONTROLS}>
          <Button
            size="compact"
            disabled={busy}
            onClick={() => input.current?.click()}
            aria-label={`${photo ? 'Replace' : 'Upload'} ${name}'s photo`}
            style={CONTROL}
          >
            {/* The labels name the act; the picture above says what of. */}
            {upload.pending ? 'Uploading…' : photo ? 'Replace' : 'Upload photo'}
          </Button>
          {photo && (
            <Button
              size="compact"
              disabled={busy}
              onClick={() => void removal.run()}
              aria-label={`Remove ${name}'s photo`}
              style={CONTROL}
            >
              {removal.pending ? 'Removing…' : 'Remove'}
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="su-sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (file) void upload.run(file)
            }}
          />
        </div>
      )}
    </figure>
  )
}
