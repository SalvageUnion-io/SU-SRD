/**
 * The copy notice leaves like every other (r2 C3): it has a timer, and it
 * closes at once when its copy is gone (deleted, or the account signed out).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture } from '../../components/__tests__/fixtures'
import { toast } from '../../components/index'
import { resetStores } from '../../replica/__tests__/resetStores'
import { useUnits } from '../../replica/units'
import { makeACopy } from '../copiedToast'

const open = () => toast.getToasts().filter((t) => !('dismiss' in t && t.dismiss))

beforeEach(() => {
  resetStores()
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
})

async function copied() {
  const units = useUnits.getState()
  await units.adopt('mech', mechFixture({ id: 'copy-1', name: 'COPY OF Leaky' }))
  await makeACopy({
    name: 'Leaky',
    make: async () => ({
      name: 'COPY OF Leaky',
      href: '/mechs/copy-1',
      exists: () => useUnits.getState().get('mech', 'copy-1') !== null,
    }),
    go: () => {},
  })
}

describe('makeACopy', () => {
  test('its notice has a timer, as every action toast has', async () => {
    await copied()
    const [line] = open()
    expect((line as { duration?: number }).duration).toBe(8000)
  })

  test('its notice closes at once when the copy is gone', async () => {
    await copied()
    expect(open()).toHaveLength(1)
    await useUnits.getState().forget('mech', 'copy-1')
    expect(open()).toHaveLength(0)
  })
})
