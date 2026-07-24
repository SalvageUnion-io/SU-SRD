import { describe, test, expect } from 'bun:test'
import { cn } from '../cn'

describe('cn', () => {
  test('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  test('handles falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  test('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  test('deduplicates tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  test('handles empty input', () => {
    expect(cn()).toBe('')
  })

  test('handles array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  // The custom T-5 utilities registered in the extended tailwind-merge
  // config — the default config classifies these as COLORS and drops them
  // whenever a real color class shares the merged list.
  describe('custom semantic utilities (design-review T-5)', () => {
    test('keeps semantic border widths alongside border colors', () => {
      expect(cn('border-entity border-ink')).toBe('border-entity border-ink')
      expect(cn('border-rail border-ink')).toBe('border-rail border-ink')
      expect(cn('border-b-entity border-rust')).toBe('border-b-entity border-rust')
    })

    test('resolves semantic border-width conflicts (last wins)', () => {
      expect(cn('border-rail', 'border-chrome')).toBe('border-chrome')
      expect(cn('border-entity', 'border-2')).toBe('border-2')
    })

    test('keeps semantic font sizes alongside text colors', () => {
      expect(cn('text-badge text-ink')).toBe('text-badge text-ink')
      expect(cn('text-label-lg text-paper')).toBe('text-label-lg text-paper')
    })

    // Regression: the display/heading rungs (readout/title/display/display-lg/
    // hero) were missing from the registered scale, so tailwind-merge treated
    // them as COLORS and dropped a real color that shared the list. The sheet
    // hero name-stamp is `cn('… bg-ink text-paper …', 'text-display …')`, which
    // lost `text-paper` and rendered ink-on-ink — an invisible title.
    test('keeps the display/heading font sizes alongside text colors', () => {
      expect(cn('bg-ink text-paper', 'text-display')).toBe('bg-ink text-paper text-display')
      expect(cn('text-paper text-display-lg')).toBe('text-paper text-display-lg')
      expect(cn('text-readout text-ink')).toBe('text-readout text-ink')
      expect(cn('text-title text-paper')).toBe('text-title text-paper')
      expect(cn('text-hero text-ink')).toBe('text-hero text-ink')
    })

    test('resolves semantic font-size conflicts (last wins)', () => {
      expect(cn('text-nano', 'text-micro')).toBe('text-micro')
      expect(cn('text-sm', 'text-caption')).toBe('text-caption')
    })

    test('resolves caps tracking conflicts (last wins)', () => {
      expect(cn('tracking-caps', 'tracking-caps-wide')).toBe('tracking-caps-wide')
      expect(cn('tracking-widest', 'tracking-caps')).toBe('tracking-caps')
    })
  })
})
