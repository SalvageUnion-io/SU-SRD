import { describe, test, expect, mock } from 'bun:test'
import { render, screen, waitFor, fireEvent } from '../test/render'
import { EntityDisplayModal } from '../components/entity/EntityDisplayModal'
import { act } from '@testing-library/react'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

describe('EntityDisplayModal', () => {
  const mockOnClose = mock(() => {})

  describe('when modal is closed', () => {
    test('renders nothing when isOpen is false', async () => {
      await act(async () => {
        await render(
          <EntityDisplayModal
            isOpen={false}
            onClose={mockOnClose}
            schemaName="systems"
            entityId="some-id"
          />
        )
      })

      // Modal content should not be present
      expect(screen.queryByText('DATA NOT FOUND')).toBeNull()
    })
  })

  describe('when entity is found', () => {
    test('displays entity content for valid system', async () => {
      // Use a known system from the data
      const schemaName: SURefEnumSchemaName = 'systems'
      const entityId = '418deda4-ab48-4bc4-a527-d56f4d77746e' // .50 Cal Machine Gun

      let result: Awaited<ReturnType<typeof render>>
      await act(async () => {
        result = await render(
          <EntityDisplayModal
            isOpen={true}
            onClose={mockOnClose}
            schemaName={schemaName}
            entityId={entityId}
          />
        )
      })

      await waitFor(() => {
        // Should display the entity name
        const elements = result!.getAllByText('.50 Cal Machine Gun', { exact: false })
        expect(elements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('when entity is not found', () => {
    test('displays NotFoundDisplay for invalid entity ID', async () => {
      await act(async () => {
        await render(
          <EntityDisplayModal
            isOpen={true}
            onClose={mockOnClose}
            schemaName="systems"
            entityId="nonexistent-id-12345"
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByText('DATA NOT FOUND')).toBeDefined()
      })

      // Should show the entity ID in the error message
      expect(screen.getByText(/nonexistent-id-12345/)).toBeDefined()
    })

    test('displays NotFoundDisplay when schemaName is null', async () => {
      await act(async () => {
        await render(
          <EntityDisplayModal
            isOpen={true}
            onClose={mockOnClose}
            schemaName={null}
            entityId="some-id"
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByText('DATA NOT FOUND')).toBeDefined()
      })
    })

    test('displays NotFoundDisplay when entityId is null', async () => {
      await act(async () => {
        await render(
          <EntityDisplayModal
            isOpen={true}
            onClose={mockOnClose}
            schemaName="systems"
            entityId={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByText('DATA NOT FOUND')).toBeDefined()
      })
    })

    test('calls onClose when Close button is clicked in error state', async () => {
      const onCloseSpy = mock(() => {})

      await act(async () => {
        await render(
          <EntityDisplayModal
            isOpen={true}
            onClose={onCloseSpy}
            schemaName="systems"
            entityId="nonexistent-id"
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByText('DATA NOT FOUND')).toBeDefined()
      })

      const closeButton = screen.getByRole('button', { name: /close/i })
      await act(async () => {
        fireEvent.click(closeButton)
      })

      expect(onCloseSpy).toHaveBeenCalled()
    })
  })
})
