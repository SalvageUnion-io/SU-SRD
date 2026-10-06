import { describe, expect, test } from 'bun:test'
import type { ConfirmCopy } from '../rowActionCopy'
import { ROW_ACTION_COPY } from '../rowActionCopy'

/** Everything a reader sees on the dialog, as one string. */
const said = (copy: ConfirmCopy) => [copy.title, ...copy.body, copy.confirmLabel].join(' ')

describe('rowActionCopy', () => {
  test('the personal shelf is "My Stuff" in the confirms that mention it', () => {
    const mentions = [
      ROW_ACTION_COPY.copy('Vex Arlo'),
      ROW_ACTION_COPY.leaveGame({
        name: 'Vex Arlo',
        kind: 'pilot',
        from: 'Union Crawler #430',
        to: { kind: 'shelf' },
      }),
    ]
    for (const copy of mentions) {
      expect(said(copy)).toContain('My Stuff')
      expect(said(copy).toLowerCase()).not.toContain('shelf')
    }
  })

  test('a move out of a game says which assignments it clears there (ADR-037)', () => {
    const leave = (kind: 'pilot' | 'mech' | 'crawler') =>
      said(ROW_ACTION_COPY.leaveGame({ name: 'X', kind, from: 'Tenacity', to: { kind: 'shelf' } }))
    expect(leave('pilot')).toContain('Their crawler assignment in Tenacity is cleared')
    expect(leave('pilot')).toContain('the mech they fly there')
    expect(leave('mech')).toContain('Its crawler assignment in Tenacity is cleared')
    expect(leave('mech')).toContain('the pilot flying it there')
    expect(leave('crawler')).toContain('Everyone in Tenacity assigned to it is unassigned')
    // Game to Game clears what it leaves behind, too.
    expect(
      said(
        ROW_ACTION_COPY.leaveGame({
          name: 'X',
          kind: 'pilot',
          from: 'Tenacity',
          to: { kind: 'game', name: 'The Long Haul' },
        })
      )
    ).toContain('Their crawler assignment in Tenacity is cleared')
  })

  test('a move into a game names each assignment it clears, and that it will not come back', () => {
    const copy = ROW_ACTION_COPY.enterGame({
      name: 'Mira Cole',
      kind: 'pilot',
      game: 'Union Crawler #430',
      cleared: [
        { type: 'pilot-to-crawler', other: { kind: 'crawler', name: 'Big Sal' } },
        { type: 'mech-to-pilot', other: { kind: 'mech', name: 'Thresher' } },
      ],
    })
    expect(copy.title).toBe('Move Mira Cole into Union Crawler #430?')
    // The pairing first, then the crew, whatever order the links came in.
    expect(copy.body).toEqual([
      "Mira Cole joins Union Crawler #430's roster.",
      'Their pairing with Thresher (still in My Stuff) is cleared.',
      "They leave Big Sal's crew.",
      "You can move them back to My Stuff later, but you'll need to make those assignments again.",
    ])
    expect(copy.confirmLabel).toBe('Move')

    const mech = ROW_ACTION_COPY.enterGame({
      name: 'Thresher',
      kind: 'mech',
      game: 'Union Crawler #430',
      cleared: [{ type: 'mech-to-crawler', other: { kind: 'crawler', name: 'Big Sal' } }],
    })
    expect(mech.body).toContain("It leaves Big Sal's crew.")
    expect(said(mech)).toContain('make that assignment again')
  })

  test('a crawler moving into a game names the crew it leaves behind', () => {
    const enter = (cleared: Parameters<typeof ROW_ACTION_COPY.enterGame>[0]['cleared']) =>
      ROW_ACTION_COPY.enterGame({ name: 'Big Sal', kind: 'crawler', game: 'Tenacity', cleared })
    expect(
      enter([
        { type: 'pilot-to-crawler', other: { kind: 'pilot', name: 'Mira Cole' } },
        { type: 'pilot-to-crawler', other: { kind: 'pilot', name: 'Vex Arlo' } },
        { type: 'mech-to-crawler', other: { kind: 'mech', name: 'Thresher' } },
      ]).body[1]
    ).toBe('Mira Cole, Vex Arlo and Thresher (still in My Stuff) leave its crew.')
    expect(
      enter([{ type: 'mech-to-crawler', other: { kind: 'mech', name: 'Thresher' } }]).body[1]
    ).toBe('Thresher (still in My Stuff) leaves its crew.')
  })

  test('a move into a game still reads as sentences when it cannot name an end or the game', () => {
    const copy = ROW_ACTION_COPY.enterGame({
      name: 'Mira Cole',
      kind: 'pilot',
      game: null,
      cleared: [
        { type: 'mech-to-pilot', other: { kind: 'mech', name: null } },
        { type: 'pilot-to-crawler', other: { kind: 'crawler', name: null } },
      ],
    })
    expect(copy.title).toBe('Move Mira Cole into this game?')
    expect(copy.body.slice(1, 3)).toEqual([
      'Their pairing with a mech is cleared.',
      "They leave their crawler's crew.",
    ])
    expect(
      ROW_ACTION_COPY.enterGame({
        name: 'Big Sal',
        kind: 'crawler',
        game: 'Tenacity',
        cleared: [
          { type: 'pilot-to-crawler', other: { kind: 'pilot', name: 'Mira Cole' } },
          { type: 'mech-to-crawler', other: { kind: 'mech', name: null } },
        ],
      }).body[1]
    ).toBe('Mira Cole (still in My Stuff) and 1 more leave its crew.')
  })

  test('a copy names the build it will make', () => {
    expect(said(ROW_ACTION_COPY.copy('Vex Arlo'))).toContain('“COPY OF Vex Arlo”')
  })

  test('a move out of a game the reader cannot name still reads as a sentence', () => {
    const copy = ROW_ACTION_COPY.leaveGame({
      name: 'Iron Mongrel',
      kind: 'mech',
      from: null,
      to: { kind: 'game', name: null },
    })
    expect(copy.title).toBe('Move Iron Mongrel to another game?')
    expect(copy.body[0]).toContain("leaves this game's roster")
  })

  test('a pilot is "them"; a mech or a crawler is "it"', () => {
    expect(ROW_ACTION_COPY.offer('Vex Arlo', 'pilot').body[0]).toContain('pick them up')
    expect(ROW_ACTION_COPY.offer('Iron Mongrel', 'mech').body[0]).toContain('pick it up')
  })

  test('only the two constructive verbs are not danger-toned', () => {
    expect(ROW_ACTION_COPY.pickUp('Vex Arlo').tone).toBe('default')
    expect(ROW_ACTION_COPY.copy('Vex Arlo').tone).toBe('default')
    for (const copy of [
      ROW_ACTION_COPY.offer('Vex Arlo', 'pilot'),
      ROW_ACTION_COPY.deleteFromGame('Vex Arlo'),
      ROW_ACTION_COPY.deleteBuild('Vex Arlo'),
      ROW_ACTION_COPY.scrap('#430 Tenacity'),
      // It clears assignments: the same loss `leaveGame` names.
      ROW_ACTION_COPY.enterGame({
        name: 'Vex Arlo',
        kind: 'pilot',
        game: 'Tenacity',
        cleared: [{ type: 'mech-to-pilot', other: { kind: 'mech', name: 'Thresher' } }],
      }),
    ]) {
      expect(copy.tone).toBe('danger')
    }
  })
})
