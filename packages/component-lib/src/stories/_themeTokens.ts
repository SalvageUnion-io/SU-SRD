/**
 * The Foundations token pages' source of truth: `styles/theme.css` itself.
 * Each page imports the stylesheet's source (`?raw`) and hands it to
 * `parseThemeTokens`, so a token the stylesheet declares is a token the page
 * shows, and a token it drops vanishes from the page. Nothing lists a token by
 * hand. The page chrome is `_foundations.tsx`.
 */

export type ThemeToken = { name: string; value: string }

/**
 * Every custom property theme.css declares in its `@theme` and `:root` blocks,
 * in source order, comments stripped. The per-sheet `.sheet--*` rules are not
 * tokens (they derive from them), so they are not read.
 */
export function parseThemeTokens(css: string): ThemeToken[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...source.matchAll(/(?:@theme(?:\s+static)?|:root)\s*\{([^}]*)\}/g)].flatMap(
    ([, block = '']) =>
      [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name = '', value = '']) => ({
        name,
        value: value.trim().replace(/\s+/g, ' '),
      }))
  )
}

/**
 * A token's value with every `var(--x)` it names substituted from the same
 * set, so `--color-status-ok` swatches as the roll tier it aliases. A specimen
 * paints the resolved literal rather than `var(--name)` because Tailwind emits
 * only the theme variables some utility uses, and an unused token would
 * otherwise swatch as nothing.
 */
export function resolveToken(value: string, tokens: readonly ThemeToken[], depth = 0): string {
  if (depth > 8) return value
  return value.replace(/var\((--[\w-]+)\)/g, (match, name: string) => {
    const target = tokens.find((t) => t.name === name)
    return target ? resolveToken(target.value, tokens, depth + 1) : match
  })
}

/** The tokens under one namespace, e.g. `--space-`. */
export const tokensIn = (tokens: readonly ThemeToken[], prefix: string): ThemeToken[] =>
  tokens.filter((t) => t.name.startsWith(prefix))

/**
 * Tokens grouped by the first segment after `prefix`, in first-seen order:
 * `--color-ink-2` and `--color-ink-75` both land in `ink`.
 */
export function familiesOf(
  tokens: readonly ThemeToken[],
  prefix: string
): [string, ThemeToken[]][] {
  const families = new Map<string, ThemeToken[]>()
  for (const token of tokensIn(tokens, prefix)) {
    const family = token.name.slice(prefix.length).split('-')[0] ?? ''
    families.set(family, [...(families.get(family) ?? []), token])
  }
  return [...families]
}
