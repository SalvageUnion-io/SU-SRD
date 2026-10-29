import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../components/__tests__/must'
import { resolveClass } from '../classRef'

const engineer = () => must(SalvageUnionReference.Classes.getByName('Engineer'))

describe('resolveClass', () => {
  test('resolves every stored form: id, name, slug and a name in any case', () => {
    const cls = engineer()
    expect(resolveClass(cls.id)?.id).toBe(cls.id)
    expect(resolveClass('Engineer')?.id).toBe(cls.id)
    expect(resolveClass(nameToSlug('Engineer'))?.id).toBe(cls.id)
    expect(resolveClass('ENGINEER')?.id).toBe(cls.id)
  })

  test('an unknown ref resolves to nothing', () => {
    expect(resolveClass('no-such-class')).toBeUndefined()
  })
})
