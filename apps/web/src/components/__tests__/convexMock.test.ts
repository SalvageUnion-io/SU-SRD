/**
 * The name-keyed Convex query mock is itself test infrastructure that the
 * connected-surface suites depend on, so its two load-bearing promises are
 * pinned here: it resolves a real function reference to `<module>:<export>`,
 * and an unregistered name is an error rather than `undefined`.
 *
 * The second is the whole point of the change. Answering an unknown query with
 * `undefined` is indistinguishable from "still loading", which is how a
 * component could start asking a new question and leave every assertion in a
 * file passing against a permanently-loading render.
 *
 * This file mocks nothing, so it carries no `mock.module` restore.
 */
import { describe, expect, test } from 'bun:test'
import { makeFunctionReference } from 'convex/server'
import { mockUseQuery, queryCalls, setQueryAnswers } from './convexMock'

const gamesGet = makeFunctionReference<'query'>('games:get')
const accountMe = makeFunctionReference<'query'>('account:me')

describe('convex useQuery mock', () => {
  test('answers by function name, not by call order', () => {
    setQueryAnswers({ 'games:get': { name: 'Tenacity' }, 'account:me': { _id: 'u1' } })

    // Deliberately asked in the opposite order to the registration.
    expect(mockUseQuery(accountMe, {})).toEqual({ _id: 'u1' })
    expect(mockUseQuery(gamesGet, { gameId: 'g1' })).toEqual({ name: 'Tenacity' })
  })

  test('a registered `undefined` is a real answer — that is how loading is expressed', () => {
    setQueryAnswers({ 'games:get': undefined })
    expect(mockUseQuery(gamesGet, { gameId: 'g1' })).toBeUndefined()
  })

  test('an unregistered query throws, naming what was asked and what is on offer', () => {
    setQueryAnswers({ 'account:me': { _id: 'u1' } })
    expect(() => mockUseQuery(gamesGet, { gameId: 'g1' })).toThrow(/games:get/)
    expect(() => mockUseQuery(gamesGet, { gameId: 'g1' })).toThrow(/account:me/)
  })

  test("Convex's `'skip'` sentinel needs no answer", () => {
    setQueryAnswers({})
    expect(mockUseQuery(gamesGet, 'skip')).toBeUndefined()
  })

  test('calls are recorded with their args, and reset per registration', () => {
    setQueryAnswers({ 'games:get': null })
    mockUseQuery(gamesGet, { gameId: 'g1' })
    expect(queryCalls()).toEqual([{ name: 'games:get', args: { gameId: 'g1' } }])

    setQueryAnswers({ 'games:get': null })
    expect(queryCalls()).toEqual([])
  })
})
