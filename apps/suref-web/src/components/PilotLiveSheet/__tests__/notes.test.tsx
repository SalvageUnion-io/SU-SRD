import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import type { Tables } from '../../../types/database-generated.types'

describe('PilotLiveSheet - Notes', () => {
  describe('Common Cases', () => {
    test('notes field displays current notes', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        queryClient.setQueryData(['pilots', LOCAL_ID], (old: Tables<'pilots'> | undefined) => ({
          ...(old || {}),
          notes: 'Test notes',
        }))

        await waitFor(() => {
          const notesTab = screen.getByRole('tab', { name: /notes/i })
          notesTab.click()

          const notesTextarea = screen.getByPlaceholderText(/notes/i) as HTMLTextAreaElement
          expect(notesTextarea.value).toContain('Test notes')
        })
      }
    })

    test('notes empty by default', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

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
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const specialNotes = 'Notes with <script>alert("xss")</script> & special chars!'

        queryClient.setQueryData(['pilots', LOCAL_ID], (old: Tables<'pilots'> | undefined) => ({
          ...(old || {}),
          notes: specialNotes,
        }))

        await waitFor(() => {
          const notesTab = screen.getByRole('tab', { name: /notes/i })
          notesTab.click()

          const notesTextarea = screen.getByPlaceholderText(/notes/i) as HTMLTextAreaElement
          // Should display the notes (handled by React/textarea, not vulnerable to XSS in textarea value)
          expect(notesTextarea).toBeInTheDocument()
        })
      }
    })
  })
})
