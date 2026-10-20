import { describe, expect, test } from 'bun:test'
import { publicPath } from '../entityKinds'
import { parseShareSegment, segmentNames, shareSegment, slugOfName } from '../shareAddress'

const ID = '0a1b2c3d-4e5f-4789-abcd-ef0123456789'

describe('a name as a slug', () => {
  test('lowercase words joined by hyphens, accents and punctuation gone', () => {
    expect(slugOfName('Rook "Ironside" Vance')).toBe('rook-ironside-vance')
    expect(slugOfName('  Zoë’s  Tow-Rig! ')).toBe('zoes-tow-rig')
  })

  test('a long name stops at a word, never mid-word', () => {
    const slug = slugOfName('The Extremely Long Name Of A Very Old And Storied Crawler')
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug).toBe('the-extremely-long-name-of-a-very-old')
  })

  test('a name with no letters or digits slugs to nothing', () => {
    expect(slugOfName('★ ★ ★')).toBe('')
  })
})

describe('the short segment', () => {
  test('the slug, then the first twelve hex digits of the app id', () => {
    expect(shareSegment(ID, 'Rook Vance')).toBe('rook-vance-0a1b2c3d4e5f')
    expect(publicPath('pilot', ID, 'Rook Vance')).toBe('/p/pilot/rook-vance-0a1b2c3d4e5f')
  })

  test('the bare short id with no name, or one that slugs to nothing', () => {
    expect(shareSegment(ID)).toBe('0a1b2c3d4e5f')
    expect(shareSegment(ID, '★')).toBe('0a1b2c3d4e5f')
  })

  test('an app id that is not a UUID is its own segment', () => {
    expect(shareSegment('pat-1', 'Tow Rig')).toBe('pat-1')
  })
})

describe('reading a segment', () => {
  test('a short segment names the UUID prefix it began', () => {
    expect(parseShareSegment('rook-vance-0a1b2c3d4e5f')).toEqual({
      kind: 'prefix',
      prefix: '0a1b2c3d-4e5f',
    })
    expect(parseShareSegment('0A1B2C3D4E5F')).toEqual({ kind: 'prefix', prefix: '0a1b2c3d-4e5f' })
  })

  test('a full app id is itself, though its last group is twelve hex digits', () => {
    expect(parseShareSegment(ID)).toEqual({ kind: 'appId', appId: ID })
  })

  test('anything else is taken whole, as an older app id', () => {
    expect(parseShareSegment('app-1')).toEqual({ kind: 'appId', appId: 'app-1' })
    expect(parseShareSegment('rook-0a1b2c3d4e5')).toEqual({
      kind: 'appId',
      appId: 'rook-0a1b2c3d4e5',
    })
  })

  test('a segment names its own thing, by short id or whole', () => {
    expect(segmentNames('rook-vance-0a1b2c3d4e5f', ID)).toBe(true)
    expect(segmentNames('rook-vance-ffffffffffff', ID)).toBe(false)
    expect(segmentNames(ID, ID)).toBe(true)
    expect(segmentNames('app-1', 'app-1')).toBe(true)
  })

  test('every segment it writes reads back to its app id', () => {
    for (const name of ['Rook Vance', '', 'Mule MK-II']) {
      expect(segmentNames(shareSegment(ID, name), ID)).toBe(true)
    }
  })
})
