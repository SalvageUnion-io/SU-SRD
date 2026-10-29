/**
 * Reading a CSS declaration out of a line of source — a stylesheet rule or a
 * style-object entry — for the `tokens` rule set (`../rules/designTokens.ts`):
 * which part of a value a token wrote, which lengths it spells, whether a
 * shadow casts. Pure string work, no file access.
 */

/** A stylesheet declaration whose value continues on the following lines. */
const OPEN_DECLARATION = /^\s*[\w-]+\s*:\s*$/

/** `lines[i]`, with a stylesheet value that starts on the next line joined up to its `;`. */
export function logicalLine(lines: readonly string[], i: number): string {
  const line = lines[i] ?? ''
  if (!OPEN_DECLARATION.test(line)) return line
  let out = line
  for (let j = i + 1; j < lines.length; j++) {
    const next = lines[j] ?? ''
    out += ` ${next.trim()}`
    if (/[;{}]/.test(next)) break
  }
  return out
}

/**
 * A declaration's value with every `var(…)` (fallback included) and every
 * `${…}` interpolation taken out, so what is left is the part a token did not
 * write. Nested parentheses inside a `var()` fallback are removed innermost
 * first.
 */
export function outsideTokens(value: string): string {
  let out = value.replace(/\$\{[^}]*\}/g, ' ')
  let prev: string
  do {
    prev = out
    out = out.replace(/var\([^()]*\)/g, ' ')
  } while (out !== prev)
  return out
}

/** A non-zero length literal (`3px`, `0.5rem`, `-0.025em`), not part of a name. */
const LENGTH_LITERAL = /(?<![\w.#-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)(?![\w-])/g

/** The non-zero length literals a value spells outside its tokens. */
function lengthLiterals(value: string): string[] {
  return (outsideTokens(value).match(LENGTH_LITERAL) ?? []).filter(
    (lit) => Number.parseFloat(lit) !== 0
  )
}

/**
 * The value of a CSS declaration (`prop: value`) or a style-object entry
 * (`prop: 'value'`, a template literal included) as a rule pattern matched it.
 */
export function declaredValue(match: string): string {
  return match.slice(match.indexOf(':') + 1)
}

/**
 * A value that is a bare non-zero number (`7`, `-1`, `0.5`): React reads one
 * as px on a length property, so a style object's `{ gap: 13 }` is `13px`.
 */
const BARE_NUMBER = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*,?\s*$/

/** The px a bare-number value stands for, or `undefined` when the value is not one. */
export function bareNumber(value: string): number | undefined {
  const m = value.match(BARE_NUMBER)
  return m ? Number(m[1]) : undefined
}

/**
 * Keep a declaration that spells a length outside its tokens: a literal with
 * a unit, or a bare non-zero number (a style object's unitless px).
 */
export const keepLengthLiteral = (match: string) => {
  const value = declaredValue(match)
  return lengthLiterals(value).length > 0 || (bareNumber(value) ?? 0) !== 0
}

/**
 * A declaration of one of `js` (camelCase, in a style object, its value a
 * quoted string, a template literal or a bare number, which React reads as px
 * on a length) or `css` (kebab-case, in a stylesheet).
 * The JS arm is tried first and stops at its closing quote; the CSS arm takes
 * an unquoted value and stops at `;`, `{`, `}` or the next `, name:` of a
 * style object, so one entry never swallows its neighbours.
 */
export function declaration(css: string, js: string): RegExp {
  return new RegExp(
    `(?<![\\w-])(?:${js})\\s*:\\s*(?:'[^'\\n]*'|"[^"\\n]*"|\`[^\`\\n]*\`|-?(?:\\d+\\.?\\d*|\\.\\d+)(?=\\s*(?:[,}]|$)))|(?<![\\w-])(?:${css})\\s*:\\s*(?!['"\`])(?:(?!,\\s*[\\w-]+\\s*:)[^;{}\\n])+`,
    'g'
  )
}

/**
 * Whether a `box-shadow` value casts a shadow: a layer with a blur. A
 * spread-only ring (`0 0 0 3px`, a selection halo) and a hard offset line
 * (`0 2px 0`, `inset 0 -2px 0`) are lines drawn with box-shadow, not lifts.
 * Functions (`var()`, `rgb()`, `color-mix()`) are taken out first, so a colour's
 * own numbers are never read as lengths.
 */
export function castsShadow(value: string): boolean {
  let out = value.replace(/\$\{[^}]*\}/g, ' ')
  let prev: string
  do {
    prev = out
    out = out.replace(/[a-z][\w-]*\([^()]*\)/gi, ' ')
  } while (out !== prev)
  return out.split(',').some((layer) => {
    const lengths =
      layer
        .replace(/\binset\b/, ' ')
        .match(/(?<![\w.#-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)?(?![\w%-])/g) ?? []
    return lengths.length >= 3 && Number.parseFloat(lengths[2] ?? '0') !== 0
  })
}
