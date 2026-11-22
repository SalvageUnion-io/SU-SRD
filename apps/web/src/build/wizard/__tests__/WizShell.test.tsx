/**
 * WizShell render tests: a wizard step is its title and its content (N6) —
 * the number chip and h1 over an untitled frame, no head band around the
 * step's entities.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { WizShell } from '../WizShell'

function renderStep() {
  return render(
    <WizShell
      kind="mech"
      eyebrow="New Mech"
      steps={['Gain Scrap', 'Chassis', 'Review']}
      active={1}
      title="Choose your Chassis"
      onCancel={() => {}}
      onNext={() => {}}
      submitLabel="Create Mech"
    >
      <p>Step content</p>
    </WizShell>
  )
}

describe('WizShell', () => {
  test('the Next button says "Next:" once, in the text a reader reads (RR2-19)', () => {
    renderStep()
    const next = screen.getByRole('button', { name: 'Next: Review' })
    expect(next.textContent?.match(/Next:/g)).toHaveLength(1)
    expect(next.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull()
  })

  test('every step opens at the top with focus on its heading, the first too (PT-20)', () => {
    const scrollTo = mock((..._args: unknown[]) => {})
    const original = window.scrollTo
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    const step = (active: number, title: string) => (
      <WizShell
        kind="mech"
        eyebrow="New Mech"
        steps={['Gain Scrap', 'Chassis', 'Review']}
        active={active}
        title={title}
        onCancel={() => {}}
        onNext={() => {}}
        submitLabel="Create Mech"
      >
        <p>Step content</p>
      </WizShell>
    )
    try {
      const view = render(step(0, 'Gain Scrap'))
      expect(scrollTo).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
      view.rerender(step(1, 'Choose your Chassis'))
      expect(scrollTo).toHaveBeenCalledTimes(2)
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(document.activeElement).toBe(h1)
      expect(h1.getAttribute('tabindex')).toBe('-1')
      // The same step drawn again moves nothing.
      view.rerender(step(1, 'Choose your Chassis'))
      expect(scrollTo).toHaveBeenCalledTimes(2)
    } finally {
      window.scrollTo = original
    }
  })

  test("the step's title is the page's h1, read with its place in the steps", () => {
    renderStep()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Step 2 of 3 · Choose your Chassis')
    expect(h1.closest('article')).toBeTruthy()
  })

  test('the number chip sits beside the title, hidden from a screen reader', () => {
    const { container } = renderStep()
    const h1 = screen.getByRole('heading', { level: 1 })
    const chip = h1.previousElementSibling
    expect(chip?.textContent).toBe('2')
    expect(chip?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('article')?.contains(chip ?? null)).toBe(true)
  })

  test('the content sits in an untitled frame: no head band wraps it', () => {
    const { container } = renderStep()
    const content = screen.getByText('Step content')
    const frame = content.closest('.su-box')
    expect(frame).toBeTruthy()
    expect(frame?.querySelector('.su-entity-compact__head')).toBeNull()
    expect(container.querySelector('.su-entity-compact__head')).toBeNull()
  })

  test("a phone's rail says the step in words: its number, the count and its name", () => {
    const { container } = renderStep()
    expect(container.querySelector('.su-wiz-rail-line')?.textContent).toBe('Step 2 of 3 · Chassis')
  })

  test("the dock's ⋯ holds Cancel and the off-rules way out, a phone's rows (R44)", async () => {
    const onEscape = mock(() => {})
    render(
      <WizShell
        kind="mech"
        eyebrow="New Mech"
        steps={['Chassis', 'Review']}
        active={0}
        title="Choose your Chassis"
        onCancel={() => {}}
        onNext={() => {}}
        onEscape={onEscape}
        submitLabel="Create Mech"
      >
        <p>Step content</p>
      </WizShell>
    )
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Cancel' })).toBeTruthy()
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Off-rules build? Build it on the Live Sheet' })
    )
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  test('signed out: step 1 says saving needs a sign-in; Review keeps the build as a file (r2 D2, D3)', () => {
    const kept: string[] = []
    const shell = (active: number, signedOut: boolean) => (
      <WizShell
        kind="mech"
        eyebrow="New Mech"
        steps={['Chassis', 'Review']}
        active={active}
        title="Step"
        onCancel={() => {}}
        onNext={() => {}}
        submitLabel="Create Mech"
        tryNote={signedOut && active === 0 ? 'Try it now. Saving needs a free sign-in.' : undefined}
        keepAsFile={
          signedOut && active === 1
            ? {
                fileName: 'salvageunion-mech-diva.json',
                onDownload: () => kept.push('file') > 0,
                onPrint: () => kept.push('paper'),
              }
            : undefined
        }
      >
        <p>Step content</p>
      </WizShell>
    )
    const view = render(shell(0, true))
    expect(screen.getByText('Try it now. Saving needs a free sign-in.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    view.rerender(shell(1, true))
    expect(screen.queryByText('Try it now. Saving needs a free sign-in.')).toBeNull()
    // Download says what it gives before it is pressed, and that it came (r3 E2).
    expect(screen.getByText(/salvageunion-mech-diva\.json: the build as a data file/)).toBeTruthy()
    expect(screen.getByText(/Backups in the Training Bay loads it/)).toBeTruthy()
    expect(screen.queryByText('Downloaded salvageunion-mech-diva.json.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(screen.getByRole('status').textContent).toBe('Downloaded salvageunion-mech-diva.json.')
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(kept).toEqual(['file', 'paper'])
    // It stands before the build, where it is seen with Create.
    const keep = screen.getByText('Keep it without an account')
    expect(
      keep.compareDocumentPosition(screen.getByText('Step content')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    view.rerender(shell(1, false))
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })
})

describe('the action bar’s prompt (r2 H1)', () => {
  test('a press scrolls to what it points at, and the line leaves once used', () => {
    const scrolled: ScrollIntoViewOptions[] = []
    const view = render(
      <WizShell
        kind="mech"
        eyebrow="New Mech"
        steps={['Chassis', 'Review']}
        active={0}
        title="Choose your Chassis"
        onCancel={() => {}}
        onNext={() => {}}
        submitLabel="Create Mech"
        prompt={{ text: 'Or start from a Pattern', targetId: 'the-patterns' }}
      >
        <div id="the-patterns">Patterns</div>
      </WizShell>
    )
    const target = view.container.querySelector('#the-patterns') as HTMLElement
    target.scrollIntoView = ((options: ScrollIntoViewOptions) => {
      scrolled.push(options)
    }) as typeof target.scrollIntoView
    fireEvent.click(screen.getByRole('button', { name: 'Or start from a Pattern' }))
    expect(scrolled).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Or start from a Pattern' })).toBeNull()
  })

  test('a locked Next’s reason scrolls to the thing it waits for, where the step names it', () => {
    let hit = ''
    const view = render(
      <WizShell
        kind="pilot"
        eyebrow="New Pilot"
        steps={['Class', 'Review']}
        active={0}
        title="Class"
        onCancel={() => {}}
        onNext={() => {}}
        submitLabel="Create Pilot"
        footerNote="Choose your first Ability to continue"
        noteTargetId="the-abilities"
      >
        <div id="the-abilities">Abilities</div>
      </WizShell>
    )
    for (const el of view.container.querySelectorAll<HTMLElement>('#the-abilities, [role=status]'))
      el.scrollIntoView = () => {
        hit = el.id
      }
    fireEvent.click(screen.getByRole('button', { name: /^First: Choose your first Ability/ }))
    expect(hit).toBe('the-abilities')
  })
})
