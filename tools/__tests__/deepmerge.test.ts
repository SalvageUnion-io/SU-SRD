import { describe, expect, test } from 'bun:test'
import deepmerge from '../../vendor/deepmerge/index.cjs'

describe('deepmerge', () => {
  test('merges nested objects and concatenates arrays, cloning both inputs', () => {
    const x = { a: { b: 1 }, list: [1] }
    const y = { a: { c: 2 }, list: [2] }
    const merged = deepmerge(x, y)
    expect(merged).toEqual({ a: { b: 1, c: 2 }, list: [1, 2] })
    expect(merged.a).not.toBe(x.a)
  })

  test('a deep clone of an object equals it but shares nothing', () => {
    const defaults = { extensions: ['.mjs', '.js'], nested: { deep: true } }
    const clone = deepmerge({}, defaults)
    expect(clone).toEqual(defaults)
    expect(clone.extensions).not.toBe(defaults.extensions)
  })

  test('an own __proto__ key never replaces the prototype of the result (GHSA-gcqx-w48m-w2h4)', () => {
    const poisoned = JSON.parse('{"__proto__": {"polluted": true}}')
    for (const merged of [
      deepmerge(poisoned, {}),
      deepmerge({}, poisoned),
      deepmerge.all([poisoned]),
    ]) {
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
      expect((merged as { polluted?: boolean }).polluted).toBeUndefined()
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  test('all() rejects a non-array', () => {
    expect(() => deepmerge.all({} as never)).toThrow('first argument should be an array')
  })
})
