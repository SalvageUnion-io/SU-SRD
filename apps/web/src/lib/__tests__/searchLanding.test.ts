import { describe, expect, test } from 'bun:test'
import { atContent } from '../searchHref'

describe('a page opened from search, at its content (RR7-09)', () => {
  test('opens at the skip link’s target, past the bar', () => {
    expect(atContent('/roll-tables/reaction-roll/')).toBe(
      '/roll-tables/reaction-roll/#main-content'
    )
  })

  test('a page opened on its own anchor keeps it', () => {
    expect(atContent('/guides/crawler-downtime/#train-your-pilot')).toBe(
      '/guides/crawler-downtime/#train-your-pilot'
    )
  })
})
