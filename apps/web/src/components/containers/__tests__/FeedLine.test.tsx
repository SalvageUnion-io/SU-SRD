/** FeedLine: one feed entry, its head, text and end, and FeedTime's three formats. */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { formatAgo, formatClock, formatDateTime } from '../../../lib/formatDate'
import { FeedLine, FeedList, FeedTime } from '../FeedLine'

const TS = Date.UTC(2026, 9, 14, 13, 5)

describe('FeedLine', () => {
  test('a list of lines, named, each its text with the head over it and the end beside it', () => {
    render(
      <FeedList label="Sent to the table">
        <FeedLine head="Rolls" end={<span>Applied</span>}>
          Contact front
        </FeedLine>
      </FeedList>
    )
    const list = screen.getByRole('list', { name: 'Sent to the table' })
    const line = screen.getByRole('listitem')
    expect(list.contains(line)).toBe(true)
    expect(line.querySelector('.su-feed-line__head')?.textContent).toBe('Rolls')
    expect(line.querySelector('.su-feed-line__text')?.textContent).toBe('Contact front')
    expect(line.querySelector('.su-feed-line__end')?.textContent).toBe('Applied')
  })

  test('without a head or an end it draws neither; struck marks the text', () => {
    render(
      <FeedList>
        <FeedLine struck>Old news</FeedLine>
      </FeedList>
    )
    const line = screen.getByRole('listitem')
    expect(line.querySelector('.su-feed-line__head')).toBeNull()
    expect(line.querySelector('.su-feed-line__end')).toBeNull()
    expect(line.querySelector('.su-feed-line__text')?.hasAttribute('data-struck')).toBe(true)
  })
})

describe('FeedTime', () => {
  test('writes a clock, a day and time, or how long ago, with its machine time', () => {
    const { container } = render(
      <>
        <FeedTime ts={TS} format="clock" />
        <FeedTime ts={TS} format="datetime" />
        <FeedTime ts={TS} format="ago" now={TS + 3 * 60_000} />
      </>
    )
    const times = [...container.querySelectorAll('time')]
    expect(times.map((t) => t.textContent)).toEqual([
      formatClock(TS),
      formatDateTime(TS),
      formatAgo(TS, TS + 3 * 60_000),
    ])
    expect(times[0]?.getAttribute('datetime')).toBe(new Date(TS).toISOString())
  })
})
