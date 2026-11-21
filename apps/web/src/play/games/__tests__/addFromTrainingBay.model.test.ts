import { describe, expect, test } from 'bun:test'
import { softLinkFixture } from '../../../components/__tests__/fixtures'
import { bringChoices, bringPlan } from '../addFromTrainingBay.model'

const unit = (id: string, gameId: string | null = null) => ({ id, name: id, gameId })

describe('bringChoices', () => {
  const links = [softLinkFixture('mech-to-pilot', 'thresher', 'razor')]

  test('a pilot and their mech are one line; a mech nobody flies has its own', () => {
    const offer = bringChoices({
      pilots: [unit('razor'), unit('mara')],
      mechs: [unit('thresher'), unit('spare')],
      crawlers: [unit('tenacity')],
      softLinks: links,
      crawler: false,
    })
    expect(offer.pilots.map((p) => [p.id, p.mech?.id ?? null])).toEqual([
      ['razor', 'thresher'],
      ['mara', null],
    ])
    expect(offer.mechs.map((m) => m.id)).toEqual(['spare'])
    expect(offer.crawlers).toEqual([])
  })

  test('only what is still in the Training Bay, and a crawler only when one may be brought', () => {
    const offer = bringChoices({
      pilots: [unit('razor', 'g1'), unit('mara')],
      mechs: [unit('thresher', 'g1')],
      crawlers: [unit('tenacity')],
      softLinks: [],
      crawler: true,
    })
    expect(offer.pilots.map((p) => p.id)).toEqual(['mara'])
    expect(offer.mechs).toEqual([])
    expect(offer.crawlers.map((c) => c.id)).toEqual(['tenacity'])
    // Everything the player has, in a Game or not: what an empty state reads.
    expect(offer.owned).toBe(3)
  })

  test('a pilot is named as everywhere: by the label handed in', () => {
    const [razor] = bringChoices({
      pilots: [{ ...unit('razor'), label: 'RAZOR · Ines' }],
      mechs: [],
      crawlers: [],
      softLinks: [],
      crawler: false,
    }).pilots
    expect(razor?.name).toBe('RAZOR · Ines')
  })
})

describe('bringPlan', () => {
  test('a pilot brings their mech, and the pair’s link is kept', () => {
    const links = [
      softLinkFixture('mech-to-pilot', 'thresher', 'razor'),
      softLinkFixture('pilot-to-crawler', 'razor', 'tenacity'),
    ]
    const plan = bringPlan(
      [
        { id: 'spare', name: 'Spare', kind: 'mech', mech: null },
        {
          id: 'razor',
          name: 'Razor',
          kind: 'pilot',
          mech: { id: 'thresher', name: 'Thresher', kind: 'mech' },
        },
      ],
      links
    )
    expect(plan.moves.map((m) => m.id)).toEqual(['razor', 'spare', 'thresher'])
    // The crawler stays behind, so that link is the move's to clear.
    expect(plan.keep.map((l) => l.type)).toEqual(['mech-to-pilot'])
  })

  test('a crawler goes first, and keeps the crew that comes with it', () => {
    const links = [softLinkFixture('pilot-to-crawler', 'razor', 'tenacity')]
    const plan = bringPlan(
      [
        { id: 'razor', name: 'Razor', kind: 'pilot', mech: null },
        { id: 'tenacity', name: 'Tenacity', kind: 'crawler', mech: null },
      ],
      links
    )
    expect(plan.moves.map((m) => m.id)).toEqual(['tenacity', 'razor'])
    expect(plan.keep).toHaveLength(1)
  })
})
