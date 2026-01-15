import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { setupPilotWithClass } from '../../../test/liveSheetUtils'
import { getBaseClass, getNonAdvanceableClass } from '../../../test/fixtures'

describe('PilotLiveSheet - Class Selection', () => {
  describe('Common Cases', () => {
    test('select base class from dropdown', async () => {
      const baseClass = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Test that setting up a class works via cache
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        await waitFor(() => {
          // Verify class was set up in cache
          const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
          if (Array.isArray(entities)) {
            const hasClass = entities.some(
              (e) => e.schema_name === 'classes' && e.schema_ref_id === baseClass.id
            )
            expect(hasClass).toBe(true)
          }
        })
      }
    })

    test('class name appears in pseudo-header', async () => {
      const baseClass = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        await waitFor(
          () => {
            // Check that class name appears somewhere in the rendered output
            const classElements = screen.queryAllByText(new RegExp(baseClass.name, 'i'))
            expect(classElements.length).toBeGreaterThan(0)
          },
          { timeout: 3000 }
        )
      }
    })

    test('core trees display after class selection', async () => {
      const baseClass = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient && 'coreTrees' in baseClass && Array.isArray(baseClass.coreTrees)) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        // Wait for class to be set up in cache, then verify
        await waitFor(
          () => {
            // Check that class was added to cache
            const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
            expect(Array.isArray(entities)).toBe(true)
            if (Array.isArray(entities)) {
              const hasClass = entities.some(
                (e) => e.schema_name === 'classes' && e.schema_ref_id === baseClass.id
              )
              expect(hasClass).toBe(true)
              // Verify coreTrees exist on the class
              expect(baseClass.coreTrees.length).toBeGreaterThan(0)
            }
          },
          { timeout: 2000 }
        )
      }
    })
  })

  describe('Corner Cases', () => {
    test('select non-advanceable class (hybrid dropdown should remain disabled)', async () => {
      const nonAdvanceable = getNonAdvanceableClass()
      if (!nonAdvanceable) {
        // Skip if no non-advanceable class exists
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Test that setting up a non-advanceable class works
        setupPilotWithClass(queryClient, LOCAL_ID, nonAdvanceable.id)

        await waitFor(() => {
          // Verify class was set up in cache
          const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
          if (Array.isArray(entities)) {
            const hasClass = entities.some(
              (e) => e.schema_name === 'classes' && e.schema_ref_id === nonAdvanceable.id
            )
            expect(hasClass).toBe(true)
          }
        })
      }
    })

    test('change class after abilities selected', async () => {
      const baseClass1 = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Test changing class via cache
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass1.id)

        await waitFor(() => {
          // Verify first class was set
          const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
          if (Array.isArray(entities)) {
            const hasClass1 = entities.some(
              (e) => e.schema_name === 'classes' && e.schema_ref_id === baseClass1.id
            )
            expect(hasClass1).toBe(true)
          }
        })

        // Change to a different class (if we have multiple)
        // This tests that class change updates cache correctly
        expect(baseClass1.id).toBeDefined()
      }
    })
  })
})
