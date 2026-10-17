import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { PageShell } from '../PageShell'

describe('PageShell', () => {
  test('padded: the gutters class, children stacked 24px apart', () => {
    render(<PageShell>body</PageShell>)
    const main = screen.getByRole('main')
    expect(main.className).toBe('su-page-shell')
    expect(main.style.flexDirection).toBe('column')
    expect(main.style.gap).toBe('24px')
    expect(main.style.minHeight).toBe('100vh')
  })

  test('padded without the stack: no column', () => {
    render(<PageShell stack={false}>body</PageShell>)
    expect(screen.getByRole('main').style.display).toBe('')
  })

  test('measured: the band, then the page body at the measure', () => {
    render(
      <PageShell measure="75rem" gap={32} band={<header>Band</header>} className="su-x">
        <p>body</p>
      </PageShell>
    )
    const main = screen.getByRole('main')
    expect(main.className).toBe('su-x')
    expect(main.firstElementChild?.tagName).toBe('HEADER')
    const body = main.children[1] as HTMLElement
    expect(body.className).toBe('su-page-body')
    expect(body.style.maxWidth).toBe('75rem')
    expect(body.style.gap).toBe('32px')
    expect(body.style.paddingBlock).toBe('20px 48px')
  })

  test('measured body style overrides its head and foot', () => {
    render(
      <PageShell measure="75rem" stack={false} bodyStyle={{ minHeight: '60vh' }}>
        body
      </PageShell>
    )
    const body = screen.getByRole('main').firstElementChild as HTMLElement
    expect(body.style.display).toBe('')
    expect(body.style.minHeight).toBe('60vh')
  })
})
