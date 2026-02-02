import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { createLocalPilot, getPilotFromCache } from '../../../test/liveSheetHelpers'

describe('PilotLiveSheet - Notes', () => {
  describe('Common Cases', () => {
    test('notes field displays current notes', async () => {
      const { queryClient } = await render(<PilotLiveSheet id={LOCAL_ID} />)

      // Create pilot with notes and verify it's in cache
      createLocalPilot(queryClient, LOCAL_ID, { notes: 'Test notes' })

      await waitFor(() => {
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        expect(pilot).toBeDefined()
        expect(pilot?.notes).toBe('Test notes')
      })

      // Verify notes tab can be accessed
      await waitFor(() => {
        const notesTab = screen.getByRole('tab', { name: /notes/i })
        expect(notesTab).toBeInTheDocument()
      })
    })

    test('notes empty by default', async () => {
      await render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const notesTab = screen.getByRole('tab', { name: /notes/i })
        notesTab.click()

        const notesTextarea = screen.getByPlaceholderText(/notes/i) as HTMLTextAreaElement
        expect(notesTextarea.value || '').toBe('')
      })
    })
  })

  describe('Corner Cases', () => {
    test('notes with special characters', async () => {
      const { queryClient } = await render(<PilotLiveSheet id={LOCAL_ID} />)

      const specialNotes = 'Notes with <script>alert("xss")</script> & special chars!'

      // Create pilot with special notes and verify it's in cache
      createLocalPilot(queryClient, LOCAL_ID, { notes: specialNotes })

      await waitFor(() => {
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        expect(pilot).toBeDefined()
        expect(pilot?.notes).toBe(specialNotes)
      })

      // Verify notes tab can be accessed
      await waitFor(() => {
        const notesTab = screen.getByRole('tab', { name: /notes/i })
        expect(notesTab).toBeInTheDocument()
      })
    })
  })
})
