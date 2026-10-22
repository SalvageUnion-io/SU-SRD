import { describe, expect, test } from 'bun:test'
import { messages } from '../define'

const copy = messages({
  plain: 'Save',
  one: 'Upgrade to Tech {tl}',
  two: 'Step {step} of {count}',
  twice: '{name} and {name}',
})

describe('messages', () => {
  test('says a message by key', () => {
    expect(copy('plain')).toBe('Save')
  })

  test('fills each placeholder from the values', () => {
    expect(copy('one', { tl: 3 })).toBe('Upgrade to Tech 3')
    expect(copy('two', { step: 2, count: 5 })).toBe('Step 2 of 5')
    expect(copy('twice', { name: 'Mule' })).toBe('Mule and Mule')
  })

  test('a nullish value says nothing, as JSX would', () => {
    expect(copy('one', { tl: undefined })).toBe('Upgrade to Tech ')
    expect(copy('one', { tl: null })).toBe('Upgrade to Tech ')
  })

  test('a placeholder with no value stays as written', () => {
    const loose = copy as unknown as (key: string, values?: Record<string, string>) => string
    expect(loose('two', { step: '1' })).toBe('Step 1 of {count}')
  })

  test('the types refuse an unknown key and a missing value', () => {
    // @ts-expect-error: no such key
    copy('nope')
    // @ts-expect-error: `tl` is required
    copy('one')
    // @ts-expect-error: `plain` takes no values
    copy('plain', { tl: 1 })
  })
})
