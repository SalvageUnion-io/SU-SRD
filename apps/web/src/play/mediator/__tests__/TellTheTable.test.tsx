/**
 * Tell the table (play.md §15): a word to every player at once.
 * Send trims what was typed and clears the box once sent; a refusal keeps the
 * message to send again; Enter sends; offline nothing sends; under the form,
 * the five newest alerts with how long ago each went.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AlertLine } from '../../useGameFeed'
import { TellTheTable } from '../TellTheTable'

const NOW = Date.parse('2026-10-09T12:00:00.000Z')
const MIN = 60_000

function alert(n: number, minutesAgo: number): AlertLine {
  return { _id: `a${n}`, message: `Alert ${n}`, ts: NOW - minutesAgo * MIN }
}

type Sender = { sent: string[]; onSend: (message: string) => Promise<void> }

function sender(outcome: 'sent' | 'refused' = 'sent'): Sender {
  const sent: string[] = []
  return {
    sent,
    onSend: async (message) => {
      sent.push(message)
      if (outcome === 'refused') throw new Error('refused')
    },
  }
}

async function renderTell({
  alerts = [],
  canWrite = true,
  send = sender(),
}: {
  alerts?: AlertLine[]
  canWrite?: boolean
  send?: Sender
} = {}) {
  await act(async () => {
    render(<TellTheTable alerts={alerts} now={NOW} canWrite={canWrite} onSend={send.onSend} />)
  })
  return {
    box: screen.getByLabelText('Alert') as HTMLInputElement,
    button: screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement,
  }
}

async function type(box: HTMLInputElement, value: string) {
  await act(async () => {
    fireEvent.change(box, { target: { value } })
  })
}

describe('sending', () => {
  test('Send waits for words, sends them trimmed, and clears the box', async () => {
    const send = sender()
    const { box, button } = await renderTell({ send })
    expect(button.disabled).toBe(true)
    await type(box, '   ')
    expect(button.disabled).toBe(true)

    await type(box, '  Contact front, two squads  ')
    expect(button.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(button)
    })
    expect(send.sent).toEqual(['Contact front, two squads'])
    expect(box.value).toBe('')
  })

  test('Enter sends too', async () => {
    const send = sender()
    const { box } = await renderTell({ send })
    await type(box, 'Hold the line')
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' })
    })
    expect(send.sent).toEqual(['Hold the line'])
    expect(box.value).toBe('')
  })

  test('Enter on an empty box sends nothing, and other keys never send', async () => {
    const send = sender()
    const { box } = await renderTell({ send })
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' })
    })
    await type(box, 'Almost')
    await act(async () => {
      fireEvent.keyDown(box, { key: 'a' })
    })
    expect(send.sent).toEqual([])
  })

  test('a refusal keeps the message, ready to send again', async () => {
    const send = sender('refused')
    const { box, button } = await renderTell({ send })
    await type(box, 'Storm incoming')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(send.sent).toEqual(['Storm incoming'])
    expect(box.value).toBe('Storm incoming')
    expect(button.disabled).toBe(false)
  })

  test('offline, the box and Send are disabled', async () => {
    const send = sender()
    const { box, button } = await renderTell({ canWrite: false, send })
    expect(box.disabled).toBe(true)
    expect(button.disabled).toBe(true)
  })
})

describe('what was sent', () => {
  test('nothing yet says so', async () => {
    await renderTell()
    expect(screen.getByText('Nothing sent yet.')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Sent to the table' })).toBeNull()
  })

  test('the five newest, each with how long ago', async () => {
    const alerts = [
      alert(1, 0),
      alert(2, 5),
      alert(3, 90),
      alert(4, 60 * 30),
      alert(5, 7),
      alert(6, 9),
    ]
    await renderTell({ alerts })
    const list = within(screen.getByRole('list', { name: 'Sent to the table' }))
    const rows = list.getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual([
      'Alert 1just now',
      'Alert 25 min ago',
      'Alert 31 h ago',
      'Alert 41 day ago',
      'Alert 57 min ago',
    ])
    expect(list.queryByText('Alert 6')).toBeNull()
  })
})
