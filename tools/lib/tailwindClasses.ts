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
 * `[start, end)` spans of the class-list CONTEXTS of a source file: the value
 * of every `className=` attribute, and the arguments of every `cn(` / `clsx(` /
 * `cva(` call. Inside a context every literal is a class list, so an ambiguous
 * lone token (`'flex'`, `'hidden'`) counts there and nowhere else.
 */
function classContextSpans(src: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const balanced = (start: number, open: string, close: string): [number, number] => {
    let depth = 0
    for (let i = start; i < src.length && i < start + 4000; i++) {
      if (src[i] === open) depth++
      else if (src[i] === close && --depth === 0) return [start, i + 1]
    }
    return [start, Math.min(src.length, start + 4000)]
  }
  for (const m of src.matchAll(/\bclassName\s*=\s*(["'{])/g)) {
    const at = (m.index ?? 0) + m[0].length - 1
    const opener = m[1]
    if (opener === '{') out.push(balanced(at, '{', '}'))
    else {
      const end = src.indexOf(opener as string, at + 1)
      out.push([at, end === -1 ? at + 1 : end + 1])
    }
  }
  for (const m of src.matchAll(/\b(?:cn|clsx|cva)\(/g)) {
    out.push(balanced((m.index ?? 0) + m[0].length - 1, '(', ')'))
  }
  return out
}

/** The class-list contexts of a source file, as text (see `classContextSpans`). */
export function classContexts(src: string): string[] {
  return classContextSpans(src).map(([a, b]) => src.slice(a, b))
}

/**
 * Lone literals that happen to have a Tailwind utility's shape but, outside a
 * class-list context, are far more likely something else — a CSS value
 * (`alignItems: 'flex-start'`, `'ease-in-out'`) or one of the non-CSS strings
 * listed below. Found by diffing the scan against the whole UI tree; extend it
 * when a new false match appears rather than weakening the lone-token rule.
 */
const CSS_KEYWORD_COLLISIONS = new Set([
  'flex-start',
  'flex-end',
  'border-box',
  'content-box',
  'padding-box',
  'fill-box',
  'stroke-box',
  'text-top',
  'text-bottom',
  'break-word',
  'break-all',
  'break-spaces',
  'scroll-position',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'list-item',
  // Not CSS, but the same shape, and each is live as a non-class literal here:
  // HTTP header names, toast/popover positions, and a game-data slug.
  'content-type',
  'content-length',
  'content-security-policy',
  'content-disposition',
  'content-encoding',
  'top-left',
  'top-right',
  'top-center',
  'bottom-left',
  'bottom-right',
  'bottom-center',
  'self-destruct',
])

/**
 * The text immediately before a style-object value: `key: '…'` where the key
 * is a CSS property. A style object is the migration's TARGET pattern, so its
 * values never count — even multi-token ones.
 */
const CSS_PROPERTY_KEY =
  /(?:^|[{,\s])['"]?(?:display|position|visibility|overflow[XY]?|float|clear|cursor|resize|appearance|content|isolation|(?:align|justify|place)(?:Items|Content|Self)|flex(?:Direction|Wrap|Flow|Grow|Shrink|Basis)?|grid\w*|gap|rowGap|columnGap|order|(?:margin|padding|inset)\w*|top|right|bottom|left|(?:min|max)?(?:Width|Height|width|height)|boxSizing|aspectRatio|object(?:Fit|Position)|font\w*|lineHeight|letterSpacing|text\w*|whiteSpace|wordBreak|overflowWrap|hyphens|verticalAlign|color|background\w*|border\w*|outline\w*|boxShadow|opacity|mixBlendMode|filter|backdropFilter|transform\w*|transition\w*|animation\w*|willChange|pointerEvents|userSelect|touchAction|zIndex|listStyle\w*|fill|stroke\w*|accentColor|caretColor|scroll\w*|columns|columnCount|tableLayout|borderCollapse)['"]?\s*:\s*$/

/**
 * Is this literal, found OUTSIDE a class-list context, a class list anyway?
 * The shapes that matter are a constant (`const DARK = 'border-x bg-y'`) and a
 * lookup map (`{ small: 'text-sm', large: 'text-lg' }`) later handed to
 * `className`. Every token must be a utility; a lone token must additionally
 * be a prefixed or variant form (a bare `'flex'` / `'hidden'` is as likely a
 * union member or a CSS value) and not a CSS keyword collision; and a
 * style-object value never counts.
 */
function isLooseClassList(text: string, before: string): boolean {
  const all = text.trim().split(/\s+/).filter(Boolean)
  // The package's own `.su-*` / `.pc-*` classes may sit beside utilities in the
  // same string (`'su-button flex items-center'`) — the mid-migration shape.
  // They are not utilities, but their presence proves the literal is a class
  // list, so the single-token ambiguity rules below no longer apply.
  const tokens = all.filter((t) => !OWN_CLASS.test(t))
  const hasOwnClass = tokens.length < all.length
  if (tokens.length === 0 || !tokens.every(isTailwindUtility)) return false
  if (CSS_PROPERTY_KEY.test(before)) return false
  if (tokens.length === 1 && !hasOwnClass) {
    const token = tokens[0] as string
    const bare = bareUtility(token)
    if (CSS_KEYWORD_COLLISIONS.has(bare)) return false
    if (bare === token && TW_STANDALONE.has(bare)) return false
  }
  return true
}

/** The package's own class namespaces, which are not Tailwind utilities. */
const OWN_CLASS = /^(?:su|pc)-[\w-]+$/

const LITERAL = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`]*)`/g

function literalText(lit: RegExpMatchArray): string {
  return (lit[1] ?? lit[2] ?? lit[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
}

/**
 * Every Tailwind utility token in a source text: each utility inside a
 * class-list context, plus every token of any OTHER literal that is wholly a
 * class list (`isLooseClassList`). The second half is what stops a class
 * string held in a constant or a lookup map from escaping the ratchet — and
 * from passing the plan's P6 exit check only to lose its styling silently when
 * P7 removes Tailwind.
 */
export function tailwindUtilitiesIn(src: string): string[] {
  const clean = stripComments(src)
  const spans = classContextSpans(clean)
  const found: string[] = []
  for (const [a, b] of spans) {
    for (const lit of clean.slice(a, b).matchAll(LITERAL)) {
      for (const token of literalText(lit).split(/\s+/))
        if (token && isTailwindUtility(token)) found.push(token)
    }
  }
  const inContext = (i: number): boolean => spans.some(([a, b]) => i >= a && i < b)
  for (const lit of clean.matchAll(LITERAL)) {
    const at = lit.index ?? 0
    if (inContext(at)) continue
    const lineStart = clean.lastIndexOf('\n', at - 1) + 1
    if (/\b(?:import|from|require)\b/.test(clean.slice(lineStart, at))) continue
    // A quoted object KEY (`{ 'align-items': … }`) is a name, not a class list.
    const end = at + lit[0].length
    if (/[{,]\s*$/.test(clean.slice(Math.max(0, at - 40), at)) && /^\s*:/.test(clean.slice(end)))
      continue
    const text = literalText(lit)
    if (isLooseClassList(text, clean.slice(Math.max(0, at - 80), at))) {
      for (const token of text.split(/\s+/)) if (token && !OWN_CLASS.test(token)) found.push(token)
    }
  }
  return found
}
