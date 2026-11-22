/** A confirmed delete says what it did, once it is done (r5 C12). */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ROW_ACTION_COPY } from '../../../lib/games/rowActionCopy'
import { toast } from '../../containers/toast'
import { useConfirm } from '../useConfirm'

afterEach(() => {
  toast.dismiss()
})

const titles = () =>
  toast
    .getToasts()
    .filter((t) => !('dismiss' in t && t.dismiss))
    .map((t) => (t as { title?: unknown }).title)

function Asker({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <button
        type="button"
        onClick={() => confirm({ ...ROW_ACTION_COPY.deleteBuild('Scuttler'), onConfirm })}
      >
        Ask
      </button>
      {dialog}
    </>
  )
}

describe('useConfirm', () => {
  test("a confirmed delete toasts 'Deleted Scuttler.' once the delete lands", async () => {
    let deleted = false
    render(
      <Asker
        onConfirm={async () => {
          deleted = true
        }}
      />
    )
    fireEvent.click(screen.getByText('Ask'))
    expect(titles()).toEqual([])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    expect(deleted).toBe(true)
    expect(titles()).toEqual(['Deleted Scuttler.'])
  })

  test('a delete that fails says nothing of having deleted', async () => {
    render(
      <Asker
        onConfirm={async () => {
          throw new Error('refused')
        }}
      />
    )
    fireEvent.click(screen.getByText('Ask'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    expect(titles()).not.toContain('Deleted Scuttler.')
  })
})
