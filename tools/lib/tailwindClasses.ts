/**
 * Tailwind-utility detection for the #802 migration ratchet
 * (`tailwind-utility-file` in tools/check-styling-ownership.ts).
 *
 * A heuristic, and scoped so that its errors fall on the safe side: it only
 * reads class-list CONTEXTS (see `classContexts`) and only recognises utility
 * shapes no `.su-*` / `.pc-*` / app class shares, so a file that has been
 * migrated reads as clean rather than being held in the backlog by a false
 * match. Lives outside the checker so it can be tested — the checker is a
 * top-level script that exits.
 */

/** Strip block and `//` line comments so prose never reads as a class list. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

/** Bare Tailwind utilities — a token that IS the whole utility. */
const TW_STANDALONE = new Set([
  'flex',
  'grid',
  'hidden',
  'block',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'contents',
  'truncate',
  'uppercase',
  'lowercase',
  'capitalize',
  'normal-case',
  'italic',
  'underline',
  'line-through',
  'no-underline',
  'sr-only',
  'not-sr-only',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'static',
  'grow',
  'shrink',
  'border',
  'rounded',
  'shadow',
  'transition',
  'container',
  'isolate',
  'tabular-nums',
  'antialiased',
  'invisible',
  'visible',
  'group',
  'peer',
  'flow-root',
  'not-italic',
  '@container',
])

/**
 * `<prefix>-<value>` Tailwind utilities. Deliberately limited to prefixes that
 * no `.su-*` / `.pc-*` / app class starts with, so a class-list token matching
 * one is a Tailwind utility and nothing else.
 */
const TW_PREFIXED = new RegExp(
  `^(?:${[
    'p[xytrblse]?',
    'm[xytrblse]?',
    'gap(?:-[xy])?',
    'space-[xy]',
    '(?:min-|max-)?[wh]',
    'size',
    'text',
    'bg',
    'border(?:-[trblxyse])?',
    'rounded(?:-[trblse]{1,2})?',
    'font',
    'leading',
    'tracking',
    'shadow',
    'ring(?:-offset)?',
    'outline',
    'opacity',
    'z',
    'top',
    'right',
    'bottom',
    'left',
    'inset(?:-[xy])?',
    'grid-(?:cols|rows)',
    '(?:col|row)-(?:span|start|end)',
    'flex',
    'items',
    'justify(?:-items|-self)?',
    'self',
    'place-(?:items|content|self)',
    'content',
    'overflow(?:-[xy])?',
    'whitespace',
    'break',
    'line-clamp',
    'aspect',
    'order',
    'basis',
    'grow',
    'shrink',
    'translate-[xy]',
    'scale(?:-[xy])?',
    'rotate',
    'duration',
    'delay',
    'ease',
    'transition',
    'animate',
    'cursor',
    'decoration',
    'underline-offset',
    'fill',
    'stroke',
    'object',
    'divide(?:-[xy])?',
    'from',
    'via',
    'to',
    'list',
    'select',
    'pointer-events',
    'scroll',
    'snap',
    'columns',
    'backdrop',
    'blur',
    'mix-blend',
    'align',
    'indent',
    'accent',
    'caret',
    'will-change',
    'touch',
    'resize',
    'appearance',
    'float',
    'clear',
    'brightness',
    'contrast',
    'saturate',
    'grayscale',
    'origin',
    'box-decoration',
    '(?:fade|zoom|spin)-(?:in|out)',
    'slide-(?:in|out)-from-[a-z]+',
  ].join('|')})-\\S+$`
)

/**
 * Strip variants — `md:`, `hover:`, `data-[x]:`, container `@3xl:` and
 * arbitrary `[&>span]:` — then `!` and a negative `-`.
 */
function bareUtility(token: string): string {
  return token.replace(/^(?:(?:[\w@-]+(?:\[[^\]]*\])?|\[[^\]]*\]):)+/, '').replace(/^!?-?/, '')
}

/** Is this whitespace-separated class-list token a Tailwind utility? */
export function isTailwindUtility(token: string): boolean {
  if (/^\[[\w-]+:[^\]]+\]$/.test(bareUtility(token))) return true // arbitrary property
  const bare = bareUtility(token)
  if (bare.startsWith('su-') || bare.startsWith('pc-')) return false
  return TW_STANDALONE.has(bare) || TW_PREFIXED.test(bare)
}

/**
 * The class-list CONTEXTS of a source file: the value of every `className=`
 * attribute, and the arguments of every `cn(` / `clsx(` / `cva(` call. Scoping
 * to these (rather than every string literal) is what keeps a style object's
 * `display: 'flex'` or `alignItems: 'flex-start'` — the pattern the migration is
 * moving TO — from counting as Tailwind.
 */
export function classContexts(src: string): string[] {
  const out: string[] = []
  const balanced = (start: number, open: string, close: string): string => {
    let depth = 0
    for (let i = start; i < src.length && i < start + 4000; i++) {
      if (src[i] === open) depth++
      else if (src[i] === close && --depth === 0) return src.slice(start, i + 1)
    }
    return src.slice(start, start + 4000)
  }
  for (const m of src.matchAll(/\bclassName\s*=\s*(["'{])/g)) {
    const at = (m.index ?? 0) + m[0].length - 1
    const opener = m[1]
    if (opener === '{') out.push(balanced(at, '{', '}'))
    else {
      const end = src.indexOf(opener as string, at + 1)
      out.push(src.slice(at, end === -1 ? at + 1 : end + 1))
    }
  }
  for (const m of src.matchAll(/\b(?:cn|clsx|cva)\(/g)) {
    out.push(balanced((m.index ?? 0) + m[0].length - 1, '(', ')'))
  }
  return out
}

/** Every Tailwind utility token in a source text's class-list contexts. */
export function tailwindUtilitiesIn(src: string): string[] {
  const found: string[] = []
  for (const context of classContexts(stripComments(src))) {
    for (const lit of context.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`]*)`/g)) {
      const text = (lit[1] ?? lit[2] ?? lit[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
      for (const token of text.split(/\s+/))
        if (token && isTailwindUtility(token)) found.push(token)
    }
  }
  return found
}
