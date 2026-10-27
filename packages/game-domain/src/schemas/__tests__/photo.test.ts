import { describe, expect, test } from 'bun:test'
import { PhotoSchema, photoUrl, uploadedPhotoId } from '../photo'
import { PilotSchema } from '../pilot'

const UPLOAD = {
  kind: 'upload',
  storageId: 'kg2abc',
  url: 'https://example.convex.cloud/api/storage/0b1c',
} as const

describe('PhotoSchema', () => {
  test('takes an upload and a CDN artwork key', () => {
    expect(PhotoSchema.parse(UPLOAD)).toEqual(UPLOAD)
    expect(PhotoSchema.parse({ kind: 'asset', path: 'starter-set/pilots/bonesaw.webp' }).kind).toBe(
      'asset'
    )
  })

  test('refuses an artwork key that could leave the CDN path grammar', () => {
    for (const path of ['../x.webp', '/abs.webp', 'a/b.png', 'https://x.test/a.webp', 'A.webp']) {
      expect(PhotoSchema.safeParse({ kind: 'asset', path }).success).toBe(false)
    }
  })

  test('refuses an upload without a url, or with fields it does not define', () => {
    expect(PhotoSchema.safeParse({ kind: 'upload', storageId: 'x' }).success).toBe(false)
    expect(PhotoSchema.safeParse({ ...UPLOAD, extra: 1 }).success).toBe(false)
  })

  test('is optional on an entity', () => {
    const pilot = {
      id: 'p1',
      schemaVersion: 1,
      name: 'Bonesaw',
      callsign: 'Bonesaw',
      classRef: 'engineer',
      abilities: [],
      equipment: [],
      motto: '',
      keepsake: '',
      appearance: '',
      background: '',
      conditions: [],
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    }
    expect(PilotSchema.safeParse(pilot).success).toBe(true)
    expect(PilotSchema.safeParse({ ...pilot, photo: UPLOAD }).success).toBe(true)
  })
})

describe('photoUrl / uploadedPhotoId', () => {
  test('an upload is served from the Worker by its storage id, never its stored url', () => {
    expect(photoUrl(UPLOAD)).toBe('/__photos/kg2abc')
    expect(photoUrl({ ...UPLOAD, storageId: 'a b.webp' })).toBe('/__photos/a%20b.webp')
    expect(uploadedPhotoId({ photo: UPLOAD })).toBe('kg2abc')
  })

  test('artwork is served from the CDN and counts nothing', () => {
    const asset = { kind: 'asset', path: 'starter-set/crawlers/tenacity.webp' } as const
    expect(photoUrl(asset)).toBe(
      'https://assets.salvageunion.io/starter-set/crawlers/tenacity.webp'
    )
    expect(uploadedPhotoId({ photo: asset })).toBeUndefined()
    expect(uploadedPhotoId(undefined)).toBeUndefined()
    expect(uploadedPhotoId({})).toBeUndefined()
  })
})
