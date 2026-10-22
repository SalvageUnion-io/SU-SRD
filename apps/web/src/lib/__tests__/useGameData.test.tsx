import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { SalvageUnionReference } from 'salvageunion-reference'
import { GameDataGate } from '../../components/GameDataGate'
import { resetPreloadForTests } from '../useGameData'

/**
 * The test preload script loads all reference data before any test runs, so
 * useGameData is normally `ready` at mount. To exercise the failure path we
 * spy on the SalvageUnionReference statics: isLoaded -> false forces the hook
 * through ensurePreloaded(), and a rejecting preload() simulates a network
 * failure. The hook resets its module-level promise on rejection, which is
 * what makes the retry below issue a fresh preload() call.
 */
describe('GameDataGate preload failure', () => {
  let isLoadedSpy: Mock<typeof SalvageUnionReference.isLoaded> | undefined
  let preloadSpy: Mock<typeof SalvageUnionReference.preload> | undefined

  beforeEach(() => {
    resetPreloadForTests()
  })

  afterEach(() => {
    isLoadedSpy?.mockRestore()
    preloadSpy?.mockRestore()
    resetPreloadForTests()
  })

  test('shows retry affordance on failure, then recovers when retry succeeds', async () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
    preloadSpy = spyOn(SalvageUnionReference, 'preload')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined)

    render(
      <GameDataGate fallback={<div>loading skeleton</div>}>
        <div>real content</div>
      </GameDataGate>
    )

    // Preload rejection surfaces as the error state with a retry button
    const retryButton = await screen.findByRole('button', {
      name: 'Try again',
    })
    expect(screen.getByRole('alert').textContent).toContain('The reference data did not load')
    expect(screen.queryByText('real content')).toBeNull()

    // Retry clears the error and re-runs the preload, which now succeeds
    fireEvent.click(retryButton)
    await waitFor(() => {
      expect(screen.getByText('real content')).toBeTruthy()
    })
    expect(preloadSpy).toHaveBeenCalledTimes(2)
  })

  test('renders fallback while preload is pending', () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockReturnValue(new Promise(() => {}))

    render(
      <GameDataGate fallback={<div>loading skeleton</div>}>
        <div>real content</div>
      </GameDataGate>
    )

    expect(screen.getByText('loading skeleton')).toBeTruthy()
    expect(screen.queryByText('real content')).toBeNull()
  })
})

describe('GameDataGate with an explicit schema list', () => {
  let isLoadedSpy: Mock<typeof SalvageUnionReference.isLoaded> | undefined
  let preloadSpy: Mock<typeof SalvageUnionReference.preload> | undefined

  beforeEach(() => {
    resetPreloadForTests()
  })

  afterEach(() => {
    isLoadedSpy?.mockRestore()
    preloadSpy?.mockRestore()
    resetPreloadForTests()
  })

  test('opens at once when every listed schema is already loaded, in the asked projection', () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(true)
    preloadSpy = spyOn(SalvageUnionReference, 'preload')

    render(
      <GameDataGate schemas={['systems', 'modules']} projection="list" fallback={<div>wait</div>}>
        <div>real content</div>
      </GameDataGate>
    )

    expect(screen.getByText('real content')).toBeTruthy()
    expect(isLoadedSpy).toHaveBeenCalledWith('systems', { projection: 'list' })
    expect(isLoadedSpy).toHaveBeenCalledWith('modules', { projection: 'list' })
    expect(preloadSpy).not.toHaveBeenCalled()
  })

  test('waits while any listed schema is missing, and preloads just that list', async () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockImplementation(
      (schema) => schema !== 'modules'
    )
    let finish: () => void = () => {}
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )

    render(
      <GameDataGate schemas={['systems', 'modules']} fallback={<div>wait</div>}>
        <div>real content</div>
      </GameDataGate>
    )

    expect(screen.getByText('wait')).toBeTruthy()
    expect(preloadSpy).toHaveBeenCalledTimes(1)
    expect(preloadSpy).toHaveBeenCalledWith(['systems', 'modules'], { projection: 'full' })

    await act(async () => finish())
    expect(screen.getByText('real content')).toBeTruthy()
  })

  test('two gates asking for the same schemas in any order share one preload', async () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
    let finish: () => void = () => {}
    preloadSpy = spyOn(SalvageUnionReference, 'preload').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )

    render(
      <>
        <GameDataGate schemas={['systems', 'modules']} fallback={<div>wait a</div>}>
          <div>content a</div>
        </GameDataGate>
        <GameDataGate schemas={['modules', 'systems']} fallback={<div>wait b</div>}>
          <div>content b</div>
        </GameDataGate>
      </>
    )

    expect(preloadSpy).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(screen.getByText('content a')).toBeTruthy()
    expect(screen.getByText('content b')).toBeTruthy()
  })

  test('a server render always shows the fallback, even with the data loaded', () => {
    isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(true)
    const html = renderToString(
      <GameDataGate schemas={['systems']} fallback={<div>wait</div>}>
        <div>real content</div>
      </GameDataGate>
    )
    expect(html).toContain('wait')
    expect(html).not.toContain('real content')
  })
})
