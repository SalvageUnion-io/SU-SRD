/**
 * The running encounter's briefing (ADR-059 §5): shown as written, sent to the
 * table only when the Mediator presses Tell the table.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToasterMount } from '../../../components/index'
import { RunningBriefing } from '../RunningBriefing'

async function renderBriefing(onTell: (message: string) => Promise<void>, canWrite = true) {
  await act(async () => {
    render(
      <>
        <ToasterMount />
        <RunningBriefing
          briefing={'Smoke rises from the crusher.\nSomething moves on the gantry.'}
          canWrite={canWrite}
          onTell={onTell}
        />
      </>
    )
  })
}

describe('a running briefing', () => {
  test('shows as written and sends only on Tell the table', async () => {
    const onTell = mock(async (_message: string) => {})
    await renderBriefing(onTell)
    expect(screen.getByRole('heading', { name: 'Briefing' })).toBeTruthy()
    expect(screen.getByText(/Something moves on the gantry/)).toBeTruthy()
    expect(onTell).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tell the table' }))
    })
    expect(onTell).toHaveBeenCalledWith(
      'Smoke rises from the crusher.\nSomething moves on the gantry.'
    )
    expect(await screen.findByText('Briefing sent to the table.')).toBeTruthy()
  })

  test('a refusal keeps the button for another try', async () => {
    const onTell = mock(async (_message: string) => {
      throw new Error('refused')
    })
    await renderBriefing(onTell)
    const button = screen.getByRole('button', { name: 'Tell the table' }) as HTMLButtonElement
    await act(async () => {
      fireEvent.click(button)
    })
    expect(button.disabled).toBe(false)
  })

  test('read-only, nothing can be sent', async () => {
    await renderBriefing(async () => {}, false)
    const button = screen.getByRole('button', { name: 'Tell the table' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
