import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
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
      // `tracking-eyebrow` was the unregistered rung: unknown tracking values
      // pass through rather than being eaten, so both classes were emitted and
      // stylesheet source order — not the last class — picked the winner.
      expect(cn('tracking-caps', 'tracking-eyebrow')).toBe('tracking-eyebrow')
      expect(cn('tracking-eyebrow', 'tracking-caps-tight')).toBe('tracking-caps-tight')
    })

    // Regression: `theme.css` gained `@utility border-l-entity` without
    // `entity` being added to this file's `border-w-l` group, so twMerge read
    // it as a border COLOR and the real color class won the conflict — the 3px
    // left accent spine was deleted from every SheetSectionCard (all three live
    // sheets via SheetHero, and every wizard RuleBrief). Same bug class as the
    // display-rung one above, third occurrence, hence the exhaustive matrix.
    test('keeps every semantic border width on every side alongside a color', () => {
      for (const side of ['', 't-', 'b-', 'l-', 'r-']) {
        for (const weight of ['chrome', 'rail', 'entity']) {
          const width = `border-${side}${weight}`
          expect(cn(`${width} border-ink`)).toBe(`${width} border-ink`)
          expect(cn(`${width} border-[var(--tone-deep)]`)).toBe(
            `${width} border-[var(--tone-deep)]`
          )
        }
      }
    })

    test('keeps the accent spine in the real SheetSectionCard class string', () => {
      expect(cn('flex-1 border-l-entity border-[var(--tone-deep)] bg-paper px-3.5 py-3')).toBe(
        'flex-1 border-l-entity border-[var(--tone-deep)] bg-paper px-3.5 py-3'
      )
    })
  })

  // Closes the bug CLASS rather than the instance. Every custom utility and
  // scale rung `theme.css` declares is exercised against a class it would
  // conflict with if twMerge mis-classified it, so a token added there without
  // a matching entry in `cn.ts` fails here instead of silently vanishing at
  // runtime (Tailwind preflight zeroes border-width, so a dropped width leaves
  // a colored border with no width and nothing errors).
  describe('every theme.css utility is registered in cn()', () => {
    const themeCss = readFileSync(
      new URL('../../styles/theme.css', import.meta.url),
      'utf8'
      // Strip comments first: the doc blocks quote class names and token
      // prefixes, and a citation must not be read as a declaration.
    ).replace(/\/\*[\s\S]*?\*\//g, '')

    const namesFor = (pattern: RegExp) => [...themeCss.matchAll(pattern)].map((m) => m[1] as string)

    test('theme.css was actually read', () => {
      expect(themeCss).toContain('@utility')
    })

    test('every @utility survives a conflicting class', () => {
      const utilities = namesFor(/@utility\s+([a-z0-9-]+)\s*\{/g)
      expect(utilities.length).toBeGreaterThan(0)
      for (const utility of utilities) {
        // Every custom utility declared today is a border width. A future
        // utility of another kind needs its own conflict partner added here.
        expect(utility.startsWith('border-')).toBe(true)
        expect(cn(`${utility} border-ink`)).toBe(`${utility} border-ink`)
      }
    })

    test('every --text-* rung survives a conflicting text color', () => {
      const rungs = namesFor(/--text-([a-z0-9-]+)\s*:/g)
      expect(rungs.length).toBeGreaterThan(0)
      for (const rung of rungs) {
        expect(cn(`text-${rung} text-paper`)).toBe(`text-${rung} text-paper`)
      }
    })

    test('every --tracking-* rung resolves as letter-spacing (last wins)', () => {
      const rungs = namesFor(/--tracking-([a-z0-9-]+)\s*:/g)
      expect(rungs.length).toBeGreaterThan(0)
      for (const rung of rungs) {
        expect(cn('tracking-widest', `tracking-${rung}`)).toBe(`tracking-${rung}`)
      }
    })

    test('every --radius-* rung resolves as a border radius (last wins)', () => {
      const rungs = namesFor(/--radius-([a-z0-9-]+)\s*:/g)
      expect(rungs.length).toBeGreaterThan(0)
      for (const rung of rungs) {
        expect(cn('rounded-none', `rounded-${rung}`)).toBe(`rounded-${rung}`)
      }
    })
  })
})
