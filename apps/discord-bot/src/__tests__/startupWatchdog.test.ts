import { describe, expect, test } from 'bun:test'
import { armReadyWatchdog, READY_TIMEOUT_MS } from '../startupWatchdog.js'

/**
 * startupWatchdog — the guard against the bot being up and deaf.
 *
 * The failure it exists for is a silent one (see the module docs), so these
 * tests care about exactly two things: that an undisarmed deadline actually
 * fires, and that a disarmed one stays quiet forever. A watchdog that cried
 * wolf would crash-loop a perfectly healthy bot, which is the worse of the two
 * regressions — hence the disarm cases.
 *
 * Timers run for real at a few milliseconds rather than through a fake clock:
 * the unit under test is a `setTimeout` and there is nothing left to assert
 * once the clock is mocked away.
 */

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

describe('armReadyWatchdog', () => {
  test('calls onExpire with an Error once the deadline passes', async () => {
    const expirations: Error[] = []
    armReadyWatchdog({ timeoutMs: 5, onExpire: (error) => expirations.push(error) })

    await tick(30)

    expect(expirations).toHaveLength(1)
    expect(expirations[0]).toBeInstanceOf(Error)
  })

  test('names the elapsed budget in the error, so a log line explains itself', async () => {
    const expirations: Error[] = []
    armReadyWatchdog({ timeoutMs: 5, onExpire: (error) => expirations.push(error) })

    await tick(30)

    expect(expirations[0]?.message).toBe('Discord login did not reach ready within 5ms')
  })

  test('stays silent when disarmed before the deadline', async () => {
    const expirations: Error[] = []
    const disarm = armReadyWatchdog({ timeoutMs: 20, onExpire: (error) => expirations.push(error) })

    disarm()
    await tick(50)

    expect(expirations).toEqual([])
  })

  test('disarming twice is safe — a reconnect re-firing ready must not throw', async () => {
    const expirations: Error[] = []
    const disarm = armReadyWatchdog({ timeoutMs: 20, onExpire: (error) => expirations.push(error) })

    disarm()
    expect(() => disarm()).not.toThrow()
    await tick(50)

    expect(expirations).toEqual([])
  })

  test('defaults to a budget far above a healthy 1.34s boot', () => {
    expect(READY_TIMEOUT_MS).toBe(60_000)
  })
})
