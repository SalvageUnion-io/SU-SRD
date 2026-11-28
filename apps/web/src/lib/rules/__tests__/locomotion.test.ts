import { describe, expect, test } from 'bun:test'
import { hasIntegratedLocomotion } from '../locomotion'

describe('hasIntegratedLocomotion (SB-18)', () => {
  test('a chassis whose ability is or describes built-in locomotion has it', () => {
    expect(hasIntegratedLocomotion('mazona')).toBe(true)
    expect(hasIntegratedLocomotion('wader')).toBe(true)
    expect(hasIntegratedLocomotion('kelpie')).toBe(true)
  })

  test('a chassis that needs a Locomotion System fitted does not', () => {
    expect(hasIntegratedLocomotion('mule')).toBe(false)
    expect(hasIntegratedLocomotion('scrapper')).toBe(false)
    expect(hasIntegratedLocomotion('')).toBe(false)
  })
})
