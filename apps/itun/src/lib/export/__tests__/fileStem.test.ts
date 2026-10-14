import { describe, expect, test } from 'bun:test'
import { fileStem } from '../downloadJson'

describe('fileStem', () => {
  test('lowercases and folds every run of other characters to one hyphen', () => {
    expect(fileStem('Bone Saw!! Mk II')).toBe('bone-saw-mk-ii')
  })

  test('caps the stem at 40 characters', () => {
    expect(fileStem('a'.repeat(60))).toHaveLength(40)
  })
})
