import { describe, expect, test } from 'bun:test'
import { classContexts, isTailwindUtility, tailwindUtilitiesIn } from '../lib/tailwindClasses'

describe('isTailwindUtility', () => {
  test.each([
    'flex',
    'items-center',
    'gap-0.5',
    'px-3',
    'text-sm',
    'bg-ink-8',
    'border-ink/15',
    'md:flex-row',
    'hover:bg-rust-hi',
    'data-[open]:fade-in-0',
    '[&>span]:h-full',
    '@3xl:grid-cols-[minmax(0,1fr)_260px]',
    '-mt-2',
    '!p-0',
    'w-[3px]',
    '[mask-type:luminance]',
    'sr-only',
  ])('%s is a utility', (token) => {
    expect(isTailwindUtility(token)).toBe(true)
  })

  test.each([
    'su-btn',
    'su-btn--primary',
    'pc-root',
    'pc-flex-row',
    'compact',
    'sheet--pilot',
    'engraved-text',
    'rivet',
  ])('%s is not a utility', (token) => {
    expect(isTailwindUtility(token)).toBe(false)
  })
})

describe('classContexts', () => {
  test('reads className attributes in all three spellings and cn()/cva() arguments', () => {
    const src = [
      `<a className="flex gap-2" />`,
      `<b className='p-2' />`,
      `<c className={cond ? 'mt-1' : 'mt-2'} />`,
      `const x = cn('su-btn', open && 'rounded')`,
      `const v = cva('text-sm', { variants: {} })`,
    ].join('\n')
    const contexts = classContexts(src).join('\n')
    for (const token of ['flex gap-2', 'p-2', 'mt-1', 'su-btn', 'rounded', 'text-sm']) {
      expect(contexts).toContain(token)
    }
  })
})

describe('tailwindUtilitiesIn', () => {
  test('a style object is not a class list', () => {
    // The migration's TARGET pattern must never count against the ratchet.
    const src = `const s = { display: 'flex', alignItems: 'flex-start', boxSizing: 'border-box' }
      export const A = () => <div style={s} className="su-card" />`
    expect(tailwindUtilitiesIn(src)).toEqual([])
  })

  test('comments are not class lists', () => {
    const src = `// className="flex p-2"\n/* cn('mt-4') */\nexport const A = () => <div className="su-card" />`
    expect(tailwindUtilitiesIn(src)).toEqual([])
  })

  test('template literals are read with their interpolations blanked', () => {
    // `$` + `'{'` assembles a literal `${…}` in the fixture, so it is source text, not an interpolation.
    const src = `export const A = () => <div className={\`su-card $${'{'}open ? "x" : ""} md:grid\`} />`
    expect(tailwindUtilitiesIn(src)).toEqual(['md:grid'])
  })

  test('a class string held in a constant counts', () => {
    // The shape that escaped the first version of this scan (SignInControl's DARK_BUTTON).
    const src = `const B = 'flex items-center gap-2 hover:bg-rust'\nexport const A = () => <div className={B} />`
    expect(tailwindUtilitiesIn(src)).toEqual(['flex', 'items-center', 'gap-2', 'hover:bg-rust'])
  })

  test('a constant mixing the package classes with utilities counts its utilities', () => {
    // The mid-migration shape: a `.su-*` class beside the utilities it has not yet replaced.
    const src = `const B = 'su-button flex items-center gap-2'\nconst C = 'su-chip hidden'\nconst D = 'su-button su-button--dark'`
    expect(tailwindUtilitiesIn(src)).toEqual(['flex', 'items-center', 'gap-2', 'hidden'])
  })

  test('a lookup map of class strings counts, lone-token values included', () => {
    // techLevelStyles.ts / sizing.ts shape.
    const src = `const TL = { '1': 'bg-tl-1 text-ink', 2: 'bg-tl-2' }\nconst RUNG = { full: { label: 'text-sm' } }`
    expect(tailwindUtilitiesIn(src)).toEqual(['bg-tl-1', 'text-ink', 'bg-tl-2', 'text-sm'])
  })

  test('style-object values never count, even multi-token ones', () => {
    const src = `const s = { display: 'inline flex', textDecoration: 'underline', transitionTimingFunction: 'ease-in-out', 'align-items': 'flex-end' }`
    expect(tailwindUtilitiesIn(src)).toEqual([])
  })

  test('lone ambiguous literals outside a class context do not count', () => {
    // A bare standalone ('flex', 'hidden'), a CSS keyword, an HTTP header, a position.
    const src = `type D = 'flex' | 'hidden'\nconst h = headers.get('content-type')\ntoast({ position: 'bottom-right' })\nconst k = 'list-item'`
    expect(tailwindUtilitiesIn(src)).toEqual([])
  })

  test('import specifiers are not class lists', () => {
    expect(tailwindUtilitiesIn(`import x from 'text-sm'`)).toEqual([])
  })

  test('finds utilities inside cn() across lines', () => {
    const src = `const c = cn(\n  'su-btn',\n  disabled && 'opacity-50 cursor-not-allowed'\n)`
    expect(tailwindUtilitiesIn(src)).toEqual(['opacity-50', 'cursor-not-allowed'])
  })
})
