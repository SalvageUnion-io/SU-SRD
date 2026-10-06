import { describe, expect, test } from 'bun:test'
import type { ConfirmCopy } from '../rowActionCopy'
import { ROW_ACTION_COPY } from '../rowActionCopy'

/** Everything a reader sees on the dialog, as one string. */
const said = (copy: ConfirmCopy) => [copy.title, ...copy.body, copy.confirmLabel].join(' ')

describe('rowActionCopy', () => {
  test('the personal shelf is "My stuff" in the confirms that mention it', () => {
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
      expect(said(copy)).toContain('My stuff')
      expect(said(copy).toLowerCase()).not.toContain('shelf')
    }
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
    ]) {
      expect(copy.tone).toBe('danger')
    }
  })
})
