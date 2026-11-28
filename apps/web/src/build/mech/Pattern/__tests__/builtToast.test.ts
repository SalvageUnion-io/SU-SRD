/**
 * Build With This is one press (r4 E23): its notice names the mech, warns
 * where the build is past the starting rules, and its Undo deletes the mech.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture } from '../../../../components/__tests__/fixtures'
import { toast } from '../../../../components/index'
import { resetStores } from '../../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../../replica/units'
import { nameAwaitsTyping, nameTyped } from '../../../sheet/nameOnArrival.model'
import { builtToast, undoBuild } from '../buildConfirm.model'

withSignedInBackend()

type Line = {
  title?: unknown
  description?: unknown
  duration?: number
  action?: { label: string; onClick: (event: never) => void }
}
const open = () => toast.getToasts().filter((t) => !('dismiss' in t && t.dismiss)) as Line[]

beforeEach(() => {
  resetStores()
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
})

describe('builtToast', () => {
  test('names the mech and offers Undo, which deletes it', async () => {
    await useUnits.getState().adopt('mech', mechFixture({ id: 'built-1', name: 'Brawler' }))
    builtToast({ id: 'built-1', name: 'Brawler' })
    const line = open().find((t) => t.action)
    expect(String(line?.title)).toContain('Brawler')
    expect(line?.description).toBeUndefined()
    expect(line?.action?.label).toBe('Undo')
    await undoBuild({ id: 'built-1', name: 'Brawler' })
    expect(useUnits.getState().get('mech', 'built-1')).toBeNull()
    expect(open().some((t) => t.title === 'Removed Brawler.')).toBe(true)
  })

  test('the sheet it opens has the new name selected for typing (r7 G5)', () => {
    builtToast({ id: 'built-3', name: 'Longhaul 1' })
    expect(nameAwaitsTyping('built-3')).toBe(true)
    nameTyped('built-3')
  })

  test('a build past the starting rules says so in the notice', () => {
    builtToast({ id: 'built-2', name: 'Stefanus' }, true)
    const line = open().find((t) => t.action)
    expect(String(line?.description)).toContain('past the starting rules')
  })
})
