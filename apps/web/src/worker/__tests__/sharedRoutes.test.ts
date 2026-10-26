import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { PHOTOS_PATH, sharedPaths } from '../../lib/sharing/paths'
import type { Identity } from '../auth/index'
import type { PhotoBucket } from '../photos'
import { MAX_PHOTO_BYTES, servePhotos } from '../photos'
import { testDb } from '../shared/__tests__/d1'
import { putGame, putInvite, putMembership } from '../shared/games'
import { RoomPublisher } from '../shared/roomRows'
import { serveShared } from '../sharedRoutes'

/** `/__shared/*` and `/__photos`: what crosses rooms, for the app's screens. */

// The runtime's own Request: happy-dom's drops the Origin header these routes check.
const happyDom: Partial<typeof NATIVE_FETCH_GLOBALS> = {}
beforeAll(() => {
  for (const key of Object.keys(NATIVE_FETCH_GLOBALS) as (keyof typeof NATIVE_FETCH_GLOBALS)[])
    Object.assign(happyDom, { [key]: globalThis[key] })
  Object.assign(globalThis, NATIVE_FETCH_GLOBALS)
})
afterAll(() => {
  Object.assign(globalThis, happyDom)
})

const ORIGIN = 'https://salvageunion.io'
const MAKER: Identity = { accountId: 'a-1', discordId: 'd-1', admin: false }
const READER: Identity = { accountId: 'a-2', discordId: 'd-2', admin: false }
const ADMIN: Identity = { accountId: 'a-3', discordId: 'd-3', admin: true }

const listing = {
  appId: 'pat-1',
  ownerId: 'd-1',
  chassisRef: 'iron-mongrel',
  name: 'Tow Rig',
  body: { name: 'Tow Rig' },
  madeBy: 'Rosa',
  sharedAt: 1,
}

async function world() {
  const db = testDb()
  const maker = new RoomPublisher(db, 'account:d-1', 'd-1', () => ({
    sheets: [
      {
        kind: 'pattern',
        appId: 'pat-1',
        ownerId: 'd-1',
        page: { appId: 'pat-1', body: { name: 'Tow Rig' }, madeBy: 'Rosa' },
        preview: { kind: 'pattern', body: { name: 'Tow Rig' }, ownerName: 'Rosa', gameName: null },
      },
    ],
    homebrew: [listing],
    crew: [
      {
        appId: 'pat-2',
        ownerId: 'd-1',
        gameId: 'g1',
        body: { name: 'Crew Rig' },
        madeBy: 'Rosa',
        sharedAt: 2,
      },
    ],
  }))
  await maker.republish()
  await putGame(db, { gameId: 'g1', name: 'The Long Haul', mediatedBy: null })
  for (const discordId of ['d-1', 'd-2'])
    await putMembership(db, { gameId: 'g1', discordId, mediator: false, organizer: false })
  return db
}

function ask(
  db: Awaited<ReturnType<typeof world>>,
  path: string,
  who: Identity | null,
  body?: unknown
) {
  const request = new Request(`${ORIGIN}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { origin: ORIGIN } }),
  })
  return serveShared(request, { SHARED: db as never }, async () => who).then(async (res) => ({
    status: res.status,
    body: (await res.json()) as { value?: unknown; refusal?: string },
  }))
}

describe('serveShared', () => {
  it('serves a shared page and preview to anyone; a private one is null', async () => {
    const db = await world()
    const page = await ask(db, sharedPaths.sheet('pattern', 'pat-1'), null)
    expect(page).toEqual({
      status: 200,
      body: { value: { appId: 'pat-1', body: { name: 'Tow Rig' }, madeBy: 'Rosa' } },
    })
    const preview = await ask(db, sharedPaths.preview('pattern', 'pat-1'), null)
    expect(preview.body.value).toMatchObject({ ownerName: 'Rosa' })
    expect((await ask(db, sharedPaths.sheet('pilot', 'nope'), null)).body).toEqual({ value: null })
    expect((await ask(db, sharedPaths.sheet('spaceship', 'x'), null)).body).toEqual({
      value: null,
    })
  })

  it("tells a pattern's standing as Convex's homebrew.status did", async () => {
    const db = await world()
    expect((await ask(db, sharedPaths.homebrew('pat-1'), READER)).body.value).toEqual({
      listed: true,
      hidden: false,
      reported: false,
      mine: false,
      admin: false,
    })
    expect((await ask(db, sharedPaths.homebrew('pat-1'), MAKER)).body.value).toMatchObject({
      mine: true,
    })
    expect((await ask(db, sharedPaths.homebrew('nope'), ADMIN)).body.value).toEqual({
      listed: false,
      hidden: false,
      reported: false,
      mine: false,
      admin: true,
    })
  })

  it('refuses a write sent from another site, before asking who sent it', async () => {
    const db = await world()
    let asked = false
    for (const [path, body] of [
      [sharedPaths.report('pat-1'), { reason: 'Book text' }],
      [sharedPaths.hidden('pat-1'), { hidden: true }],
      [sharedPaths.dismiss('pat-1'), {}],
    ] as const) {
      const request = new Request(`${ORIGIN}${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { origin: 'https://elsewhere.example' },
      })
      const res = await serveShared(request, { SHARED: db as never }, async () => {
        asked = true
        return ADMIN
      })
      expect(res.status).toBe(403)
    }
    expect(asked).toBe(false)
    expect((await ask(db, sharedPaths.homebrew('pat-1'), READER)).body.value).toMatchObject({
      reported: false,
      hidden: false,
    })
  })

  it('answers a malformed escape as not found', async () => {
    const db = await world()
    const path = sharedPaths.sheet('pattern', 'pat-1').replace('pat-1', '%E0%A4')
    expect(await ask(db, path, null)).toEqual({ status: 404, body: { refusal: 'Not found' } })
  })

  it('takes a report from a signed-in reader, never the maker', async () => {
    const db = await world()
    expect((await ask(db, sharedPaths.report('pat-1'), null, { reason: 'x' })).status).toBe(401)
    expect(await ask(db, sharedPaths.report('pat-1'), MAKER, { reason: 'x' })).toEqual({
      status: 400,
      body: { refusal: 'You cannot report your own homebrew' },
    })
    expect((await ask(db, sharedPaths.report('pat-1'), READER, { reason: ' ' })).status).toBe(400)
    expect(
      (await ask(db, sharedPaths.report('pat-1'), READER, { reason: 'Book text' })).status
    ).toBe(200)
    expect((await ask(db, sharedPaths.homebrew('pat-1'), READER)).body.value).toMatchObject({
      reported: true,
    })
  })

  it('leaves the queue, hiding and dismissing to a site admin', async () => {
    const db = await world()
    await ask(db, sharedPaths.report('pat-1'), READER, { reason: 'Book text' })
    expect((await ask(db, sharedPaths.moderation(), READER)).body).toEqual({ value: null })
    const queue = (await ask(db, sharedPaths.moderation(), ADMIN)).body.value as {
      reported: { appId: string; reasons: string[] }[]
    }
    expect(queue.reported).toEqual([
      expect.objectContaining({ appId: 'pat-1', reasons: ['Book text'] }),
    ])
    expect((await ask(db, sharedPaths.hidden('pat-1'), READER, { hidden: true })).status).toBe(403)
    expect((await ask(db, sharedPaths.hidden('pat-1'), ADMIN, { hidden: true })).body).toEqual({
      value: { hidden: true },
    })
    expect((await ask(db, sharedPaths.homebrew('pat-1'), MAKER)).body.value).toMatchObject({
      listed: false,
      hidden: true,
    })
    expect((await ask(db, sharedPaths.homebrew('pat-1'), READER)).body.value).toMatchObject({
      hidden: false,
    })
    expect((await ask(db, sharedPaths.dismiss('pat-1'), ADMIN, {})).status).toBe(200)
  })

  it("serves a crew's shared patterns to the crew, but not the maker's own", async () => {
    const db = await world()
    expect((await ask(db, sharedPaths.crewPatterns(), READER)).body.value).toEqual([
      {
        appId: 'pat-2',
        body: { name: 'Crew Rig' },
        madeBy: 'Rosa',
        gameId: 'g1',
        gameName: 'The Long Haul',
      },
    ])
    expect((await ask(db, sharedPaths.gamePatterns('g1'), READER)).body.value).toHaveLength(1)
    expect((await ask(db, sharedPaths.gamePatterns('g2'), READER)).body.value).toEqual([])
    expect((await ask(db, sharedPaths.crewPatterns(), MAKER)).body.value).toEqual([])
    expect((await ask(db, sharedPaths.crewPatterns(), null)).body.value).toEqual([])
  })

  it('leaves out a crew pattern whose body cannot be read', async () => {
    const db = await world()
    await db.prepare("update crew_patterns set body = 'not json' where app_id = 'pat-2'").run()
    expect((await ask(db, sharedPaths.crewPatterns(), READER)).body.value).toEqual([])
  })

  it("serves an invite's preview, null for a code no Game holds", async () => {
    const db = await world()
    await putInvite(db, 'g1', 'K7QR2XA')
    expect((await ask(db, sharedPaths.invite('K7QR2XA'), null)).body.value).toMatchObject({
      gameName: 'The Long Haul',
    })
    expect((await ask(db, sharedPaths.invite('NOPE'), null)).body.value).toBeNull()
  })

  it('answers an address it does not serve with 404, and a database fault with 503', async () => {
    const db = await world()
    expect((await ask(db, '/__shared/nowhere', null)).status).toBe(404)
    const broken = {
      prepare: () => {
        throw new Error('D1 is down')
      },
    }
    const quiet = console.error
    console.error = () => {}
    try {
      expect((await ask(broken as never, sharedPaths.sheet('pilot', 'p-1'), null)).status).toBe(503)
    } finally {
      console.error = quiet
    }
  })
})

/** A bucket in memory, as R2 answers. */
function bucket() {
  const files = new Map<string, { bytes: ArrayBuffer; type: string; owner?: string }>()
  const it: PhotoBucket = {
    put: async (key, value, options) => {
      files.set(key, {
        bytes: value,
        type: options.httpMetadata.contentType,
        owner: options.customMetadata.owner,
      })
    },
    get: async (key) => {
      const file = files.get(key)
      if (file === undefined) return null
      return {
        body: new Response(file.bytes).body as ReadableStream,
        httpMetadata: { contentType: file.type },
        httpEtag: '"e"',
      }
    },
  }
  return { it, files }
}

function upload(
  type: string,
  bytes: number,
  who: Identity | null,
  photos: PhotoBucket,
  origin = ORIGIN
) {
  const request = new Request(`${ORIGIN}${PHOTOS_PATH}`, {
    method: 'POST',
    headers: { 'content-type': type, origin },
    body: new Uint8Array(bytes),
  })
  return servePhotos(
    request,
    { SHARED: {} as never, PHOTOS: photos },
    async () => who,
    () => '00000000-0000-4000-8000-000000000000'
  )
}

describe('servePhotos', () => {
  it("stores a signed-in player's photo and serves it back", async () => {
    const { it: photos, files } = bucket()
    const res = await upload('image/webp', 10, MAKER, photos)
    const key = '00000000-0000-4000-8000-000000000000.webp'
    expect(await res.json()).toEqual({ storageId: key, url: `${ORIGIN}${PHOTOS_PATH}/${key}` })
    expect(files.get(key)?.owner).toBe('d-1')

    const served = await servePhotos(new Request(`${ORIGIN}${PHOTOS_PATH}/${key}`), {
      SHARED: {} as never,
      PHOTOS: photos,
    })
    expect(served.headers.get('content-type')).toBe('image/webp')
    expect(served.headers.get('cache-control')).toContain('immutable')
    expect((await served.arrayBuffer()).byteLength).toBe(10)
  })

  it('refuses an upload sent from another site, however signed in', async () => {
    const { it: photos, files } = bucket()
    expect(
      (await upload('image/webp', 10, MAKER, photos, 'https://elsewhere.example')).status
    ).toBe(403)
    expect(files.size).toBe(0)
  })

  it('refuses a stranger, another type, an empty or a too-large file', async () => {
    const { it: photos, files } = bucket()
    expect((await upload('image/webp', 10, null, photos)).status).toBe(401)
    expect((await upload('image/gif', 10, MAKER, photos)).status).toBe(415)
    expect((await upload('image/webp', 0, MAKER, photos)).status).toBe(415)
    expect((await upload('image/webp', MAX_PHOTO_BYTES + 1, MAKER, photos)).status).toBe(415)
    expect(files.size).toBe(0)
  })

  it('serves only a well-formed key it minted, and answers 503 with no bucket', async () => {
    const { it: photos } = bucket()
    const env = { SHARED: {} as never, PHOTOS: photos }
    expect(
      (await servePhotos(new Request(`${ORIGIN}${PHOTOS_PATH}/..%2Fsecret`), env)).status
    ).toBe(404)
    expect((await servePhotos(new Request(`${ORIGIN}${PHOTOS_PATH}/%E0%A4`), env)).status).toBe(404)
    expect(
      (await servePhotos(new Request(`${ORIGIN}${PHOTOS_PATH}/x`), { SHARED: {} as never })).status
    ).toBe(503)
  })
})
