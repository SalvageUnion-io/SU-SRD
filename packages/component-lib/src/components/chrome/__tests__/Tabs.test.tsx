/**
 * Tabs — the tabs keyboard model the Dashboard's display relies on (plan
 * layer 6, audit UX-15): arrows and Home/End move and select, and every tab
 * names the panel it controls.
 */
import { describe, expect, it } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Tab, TabList, TabPanel, Tabs } from '../Tabs'

const VALUES = ['resolve', 'reference', 'tables'] as const
type Value = (typeof VALUES)[number]

function Harness({ seen }: { seen: Value[] }) {
  const [open, setOpen] = useState<Value>('resolve')
  return (
    <Tabs
      value={open}
      onValueChange={(next) => {
        seen.push(next)
        setOpen(next)
      }}
    >
      <TabList label="Display">
        {VALUES.map((v) => (
          <Tab key={v} value={v}>
            {v}
          </Tab>
        ))}
      </TabList>
      {VALUES.map((v) => (
        <TabPanel key={v} value={v}>
          {`${v} panel`}
        </TabPanel>
      ))}
    </Tabs>
  )
}

async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement as Element, { key })
  })
}

describe('Tabs', () => {
  it('is a labelled tablist whose open tab controls the panel shown', () => {
    render(<Harness seen={[]} />)
    expect(screen.getByRole('tablist', { name: 'Display' })).toBeTruthy()
    const open = screen.getByRole('tab', { name: 'resolve' })
    expect(open.getAttribute('aria-selected')).toBe('true')
    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toBe('resolve panel')
    expect(open.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(open.id)
  })

  it('ArrowRight selects the next tab, Home and End the ends, wrapping round', async () => {
    const seen: Value[] = []
    render(<Harness seen={seen} />)
    await act(async () => {
      screen.getByRole('tab', { name: 'resolve' }).focus()
    })

    await press('ArrowRight')
    expect(screen.getByRole('tab', { name: 'reference' }).getAttribute('aria-selected')).toBe(
      'true'
    )
    expect(screen.getByRole('tabpanel').textContent).toBe('reference panel')

    await press('End')
    expect(screen.getByRole('tabpanel').textContent).toBe('tables panel')
    await press('ArrowRight')
    expect(screen.getByRole('tabpanel').textContent).toBe('resolve panel')
    await press('ArrowLeft')
    expect(screen.getByRole('tabpanel').textContent).toBe('tables panel')
    await press('Home')
    expect(screen.getByRole('tabpanel').textContent).toBe('resolve panel')

    expect(seen).toEqual(['reference', 'tables', 'resolve', 'tables', 'resolve'])
  })

  it('a click selects, and only the open panel renders', () => {
    render(<Harness seen={[]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'tables' }))
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel').textContent).toBe('tables panel')
  })
})
