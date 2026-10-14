import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'

/**
 * ConfirmDialog — the parts of a confirm that are easy to get wrong, pinned:
 * it announces itself as a question, the action waits for the answer, a
 * pending action cannot be closed underneath, and a failure stays on screen.
 */

type HarnessProps = {
  onConfirm: () => void | Promise<void>
  tone?: 'danger' | 'default'
  describeError?: (error: unknown) => ReactNode
  /** Every `onOpenChange` the dialog made, in order. */
  changes?: boolean[]
}

/** Owns `open` the way a real caller does, and exposes it as text. */
function Harness({ onConfirm, tone = 'danger', describeError, changes }: HarnessProps) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          changes?.push(next)
          setOpen(next)
        }}
        title="Scrap Iron Mongrel?"
        body="This deletes it for everyone in the game and can't be undone."
        confirmLabel="Scrap"
        pendingLabel="Scrapping…"
        tone={tone}
        onConfirm={onConfirm}
        describeError={describeError}
      />
    </>
  )
}

const state = () => screen.getByTestId('state').textContent

/**
 * Let Base UI's focus manager place initial focus, which it does after mount.
 * A macrotask inside `act`, not `waitFor`: polling `activeElement` with
 * `waitFor` while the focus trap is live hung for a minute under happy-dom.
 */
async function settleFocus(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** A promise the test settles by hand, to hold the dialog in its pending state. */
function deferred() {
  let resolve: () => void = () => {}
  let reject: (err: unknown) => void = () => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('ConfirmDialog — what it announces', () => {
  test('is an alert dialog, labelled by its question and described by its body', () => {
    render(<Harness onConfirm={() => {}} />)
    const dialog = screen.getByRole('alertdialog')

    const labelledBy = dialog.getAttribute('aria-labelledby')
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(labelledBy && document.getElementById(labelledBy)?.textContent).toBe(
      'Scrap Iron Mongrel?'
    )
    // Described by the VISIBLE body, not an sr-only restatement of the title.
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      "This deletes it for everyone in the game and can't be undone."
    )
  })

  test('a danger confirm starts on Cancel, so a stray Enter cancels', async () => {
    render(<Harness onConfirm={() => {}} tone="danger" />)
    await settleFocus()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  test('a constructive confirm starts on the confirm button', async () => {
    render(<Harness onConfirm={() => {}} tone="default" />)
    await settleFocus()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Scrap' }))
  })
})

describe('ConfirmDialog — answering it', () => {
  test('nothing runs until the confirm is pressed', async () => {
    let ran = 0
    render(<Harness onConfirm={() => void ran++} />)
    expect(ran).toBe(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    expect(ran).toBe(1)
    expect(state()).toBe('closed')
  })

  test('Cancel closes without running the action', () => {
    let ran = 0
    const changes: boolean[] = []
    render(<Harness onConfirm={() => void ran++} changes={changes} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(ran).toBe(0)
    expect(changes).toEqual([false])
    expect(state()).toBe('closed')
  })

  test('Escape cancels too', () => {
    let ran = 0
    render(<Harness onConfirm={() => void ran++} />)

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(ran).toBe(0)
    expect(state()).toBe('closed')
  })
})

describe('ConfirmDialog — while the action runs', () => {
  test('both buttons lock and the confirm says what is happening', async () => {
    const work = deferred()
    render(<Harness onConfirm={() => work.promise} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    expect(screen.getByRole('button', { name: 'Scrapping…' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)

    await act(async () => {
      work.resolve()
      await work.promise
    })
    expect(state()).toBe('closed')
  })

  test('Escape cannot close it underneath the action', async () => {
    const work = deferred()
    render(<Harness onConfirm={() => work.promise} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    // Closing mid-flight would read as done, or as cancelled — neither is true yet.
    expect(state()).toBe('open')

    await act(async () => {
      work.resolve()
      await work.promise
    })
  })

  test('a double click runs the action once', async () => {
    const work = deferred()
    let ran = 0
    render(
      <Harness
        onConfirm={() => {
          ran++
          return work.promise
        }}
      />
    )
    const confirm = screen.getByRole('button', { name: 'Scrap' })
    await act(async () => {
      fireEvent.click(confirm)
      fireEvent.click(confirm)
    })
    expect(ran).toBe(1)

    await act(async () => {
      work.resolve()
      await work.promise
    })
  })
})

describe('ConfirmDialog — when the action fails', () => {
  test('the dialog stays open with the reason, and can be retried', async () => {
    let attempts = 0
    render(
      <Harness
        onConfirm={async () => {
          attempts++
          if (attempts === 1) throw new Error('offline')
        }}
        describeError={() => 'The crawler could not be scrapped. Try again.'}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    expect(state()).toBe('open')
    expect(screen.getByRole('alert').textContent).toBe(
      'The crawler could not be scrapped. Try again.'
    )
    // Unlocked again: the reader can retry or walk away.
    expect(screen.getByRole('button', { name: 'Scrap' }).hasAttribute('disabled')).toBe(false)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    expect(attempts).toBe(2)
    expect(state()).toBe('closed')
  })

  test('with no describer, it shows a generic line — never the raw message', async () => {
    render(
      <Harness
        onConfirm={async () => {
          throw new Error('[CONVEX M(entities:removeCrawler)] Server Error')
        }}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    const alert = screen.getByRole('alert').textContent ?? ''
    expect(alert).toBe('That did not work. Try again.')
    expect(alert).not.toContain('CONVEX')
  })

  test('the failure line is about that attempt: reopening clears it', async () => {
    render(
      <Harness
        onConfirm={async () => {
          throw new Error('offline')
        }}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap' }))
    })
    expect(screen.getByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
