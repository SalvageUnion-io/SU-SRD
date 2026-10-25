import { describe, expect, it } from 'bun:test'
import { dropPublicSheet, publicPage, publicPreview, putPublicSheet } from '../publicSheets'
import { testDb } from './d1'

/** Public sheets as their rooms write them (ADR-032). */

const APP_ID = '0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d'
const PREVIEW = {
  kind: 'pilot' as const,
  body: { name: 'Rosa' },
  ownerName: 'Rosa',
  gameName: null,
}
const PAGE = {
  kind: 'pilot',
  appId: APP_ID,
  body: { name: 'Rosa' },
  links: [],
  linked: [],
  withheld: [],
}

describe('a public sheet', () => {
  it('serves its page and preview at its short address and its app id, as written', async () => {
    const db = testDb()
    await putPublicSheet(db, {
      kind: 'pilot',
      appId: APP_ID,
      ownerId: 'u-1',
      page: PAGE,
      preview: PREVIEW,
    })
    expect(await publicPage(db, 'pilot', 'rosa-0a1b2c3d4e5f')).toEqual(PAGE)
    expect(await publicPreview(db, 'pilot', APP_ID)).toEqual(PREVIEW)
    // Another kind's address names nothing.
    expect(await publicPage(db, 'mech', APP_ID)).toBeNull()
  })

  it('an edit replaces it, and unsharing removes it', async () => {
    const db = testDb()
    await putPublicSheet(db, {
      kind: 'pilot',
      appId: APP_ID,
      ownerId: 'u-1',
      page: PAGE,
      preview: PREVIEW,
    })
    const renamed = { ...PREVIEW, body: { name: 'Rook' } }
    await putPublicSheet(db, {
      kind: 'pilot',
      appId: APP_ID,
      ownerId: 'u-1',
      page: PAGE,
      preview: renamed,
    })
    expect(await publicPreview(db, 'pilot', APP_ID)).toEqual(renamed)
    await dropPublicSheet(db, 'pilot', APP_ID)
    expect(await publicPage(db, 'pilot', APP_ID)).toBeNull()
  })
})
