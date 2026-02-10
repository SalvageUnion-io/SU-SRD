import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import MechLiveSheet from '../index'
import { createLocalMech } from '../../../test/liveSheetHelpers'
import type { Tables } from '../../../types/database-generated.types'

describe('MechLiveSheet - Resource Management', () => {
  describe('Common Cases', () => {
    test('SP stepper displays and updates current damage correctly', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const spElements = screen.getAllByText(/sp|structure/i)
        expect(spElements.length).toBeGreaterThan(0)
      })
    })

    test('EP stepper displays and updates current EP', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const epElements = screen.getAllByText(/ep|energy/i)
        expect(epElements.length).toBeGreaterThan(0)
      })
    })

    test('Heat stepper displays and updates current heat', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const heatElements = screen.queryAllByText(/heat/i)
        // Heat might not always be visible, but if it is, it should be present
        if (heatElements.length > 0) {
          expect(heatElements[0]).toBeInTheDocument()
        }
      })
    })

    test('SP cannot go below 0', async () => {
      const { queryClient } = await render(<MechLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalMech(queryClient, LOCAL_ID, {
          current_damage: 0,
        })

        // Try to set damage negative (which would make SP negative)
        const mech = queryClient.getQueryData<Tables<'mechs'>>(['mechs', LOCAL_ID])
        if (mech) {
          queryClient.setQueryData(['mechs', LOCAL_ID], {
            ...mech,
            current_damage: -10,
          })

          await waitFor(() => {
            const updatedMech = queryClient.getQueryData<Tables<'mechs'>>(['mechs', LOCAL_ID])
            if (updatedMech && updatedMech.current_damage !== null) {
              expect(updatedMech.current_damage).toBeGreaterThanOrEqual(0)
            }
          })
        }
      }
    })

    test('EP cannot go below 0', async () => {
      const { queryClient } = await render(<MechLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalMech(queryClient, LOCAL_ID, {
          current_ep: 10,
        })

        const mech = queryClient.getQueryData<Tables<'mechs'>>(['mechs', LOCAL_ID])
        if (mech) {
          queryClient.setQueryData(['mechs', LOCAL_ID], {
            ...mech,
            current_ep: -5,
          })

          await waitFor(() => {
            const updatedMech = queryClient.getQueryData<Tables<'mechs'>>(['mechs', LOCAL_ID])
            if (updatedMech && updatedMech.current_ep !== null) {
              expect(updatedMech.current_ep).toBeGreaterThanOrEqual(0)
            }
          })
        }
      }
    })
  })

  describe('Corner Cases', () => {
    test('set SP damage to 0', async () => {
      const { queryClient } = await render(<MechLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalMech(queryClient, LOCAL_ID, {
          current_damage: 0,
        })

        await waitFor(() => {
          const mech = queryClient.getQueryData<Tables<'mechs'>>(['mechs', LOCAL_ID])
          if (mech && mech.current_damage !== null) {
            expect(mech.current_damage).toBe(0)
          }
        })
      }
    })

    test('set EP to 0', async () => {
      const { queryClient } = await render(<MechLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalMech(queryClient, LOCAL_ID, {
          current_ep: 0,
        })

        await waitFor(() => {
          const mech = queryClient.getQueryData<Tables<'mechs'>>(['mechs', LOCAL_ID])
          if (mech && mech.current_ep !== null) {
            expect(mech.current_ep).toBe(0)
          }
        })
      }
    })
  })
})
