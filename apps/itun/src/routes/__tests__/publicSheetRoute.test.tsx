/**
 * `/p/$kind/$appId`: what the page shows before, and instead of, a public sheet.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/convexMock'

// Module scope, before the import below — see `convexMock.ts`.
const convexMocks = await installConvexMocks()
afterAll(() => convexMocks.restore())

const { PublicSheetView } = await import('../../components/sheet/PublicSheetView')

describe('the public sheet route', () => {
  test('a sheet that is not public says so', () => {
    setQueryAnswers({ 'publicSheet:get': null })
    render(<PublicSheetView kind="pilot" appId="anything" />)
    // `getByText` throws when absent, so this asserts presence twice over.
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
  })

  test('an unknown kind gets the same page, not a server round trip', () => {
    setQueryAnswers({})
    render(<PublicSheetView kind="dropship" appId="anything" />)
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
    expect(queryCalls()).toEqual([])
  })
})
