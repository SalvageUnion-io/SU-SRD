import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { GameDataGate, resetPreloadForTests } from '../useGameData'

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
      name: 'Retry loading game data',
    })
    expect(screen.getByText('Failed to load game data.')).toBeTruthy()
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
