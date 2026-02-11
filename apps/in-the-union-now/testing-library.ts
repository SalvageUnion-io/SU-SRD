import { afterEach, expect } from 'bun:test'
import { cleanup, configure, act } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

configure({ asyncUtilTimeout: 1000 })

afterEach(async () => {
  await act(async () => {
    cleanup()
  })
})
