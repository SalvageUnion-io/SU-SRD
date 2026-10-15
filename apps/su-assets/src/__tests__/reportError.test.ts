import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test'
import { reportError } from '../worker/reportError'

/** Workers Issues records `console.error`, so what is logged is what is reported. */
const consoleError = spyOn(console, 'error').mockImplementation(() => undefined)

afterEach(() => {
  consoleError.mockClear()
})

afterAll(() => {
  consoleError.mockRestore()
})

describe('reportError', () => {
  test('logs the error and its context at error level', () => {
    const error = new Error('r2 down')
    reportError(error, { op: 'r2.get' })
    expect(consoleError).toHaveBeenCalledWith(error, { op: 'r2.get' })
  })

  test('an absent context logs as an empty one', () => {
    reportError('boom')
    expect(consoleError).toHaveBeenCalledWith('boom', {})
  })
})
