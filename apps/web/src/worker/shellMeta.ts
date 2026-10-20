/**
 * Per-route metadata for the SPA shell.
 *
 * The app is client-rendered, and an unfurl bot runs no JavaScript, so a route's
 * runtime `<title>` never reaches Discord: every link unfurled as the app
 * itself. This rewrites the shell's head for the routes a player shares, so a
 * link looks like the page it opens.
 *
 * ## Why a marked block and not HTMLRewriter
 *
 * `HTMLRewriter` is the idiomatic Workers answer and is **not available under
 * Bun**, where this repo's tests run. The routing rules this sits beside are
 * exactly the kind that have broken production before, so the testable form
 * wins.
 *
 * The shell (`shell/shell.ts`) carries `<!-- app:meta:start -->` / `<!-- app:meta:end -->`
 * around its defaults, and this swaps that whole block. A precise delimiter
 * beats pattern-matching tags: the block is replaced wholesale, so a per-route
 * tag and a default tag can never both survive for a parser to choose between.
 */

import { unionHere } from '../lib/barLinks'
import type { PreviewMeta } from '../lib/documentHead'
import { escapeMarkup, META_END, META_START, metaTags, renderTags } from '../lib/documentHead'
import { escapeJsonForScript } from '../lib/escapeJsonForScript'
import { BAR_HIDDEN_ATTRIBUTE } from '../shell/unionSlots'

/**
 * Everything the shell's meta block says for one route. `canonical` is the
 * page's address for a page search may list (`publicPages.ts`); a shared
 * thing's preview has none: the shell names no canonical (`shell/shell.ts`),
 * and neither does its swap. `themeColor` is the band's tone, so the unfurl's
 * side bar matches the card.
 */
export type ShellMeta = Omit<PreviewMeta, 'previewDescription' | 'type'> & {
  /**
   * The page's Discord Component Embed JSON (a shared pattern's card, as a
   * book page carries its own): Discord draws it in place of the preview.
   */
  componentEmbed?: string
}

/** Collapse whitespace and cap length, so a long name cannot bloat the head. */
function tidy(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** Render the meta block for one route. Names are player-controlled: `renderTags` escapes them. */
function renderMeta(meta: ShellMeta): string {
  const tags = metaTags({
    ...meta,
    title: tidy(meta.title, 70),
    description: tidy(meta.description, 200),
    ...(meta.image ? { image: { ...meta.image, alt: tidy(meta.image.alt, 120) } } : {}),
  })
  // Data, never run: every `<` escaped, so a player-typed name cannot end the script.
  const embed = meta.componentEmbed
    ? [
        `<script id="discord:component-embed" type="application/json">${escapeJsonForScript(meta.componentEmbed)}</script>`,
      ]
    : []
  return [META_START, renderTags(tags, '    '), ...embed, META_END].join('\n    ')
}

/**
 * Swap the shell's meta block, and its `<title>`, for this route's.
 *
 * Returns the shell unchanged when the markers are absent, so a shell that
 * drifts degrades to the sitewide defaults rather than to a broken document.
 */
export function applyMeta(shell: string, meta: ShellMeta): string {
  const start = shell.indexOf(META_START)
  const end = shell.indexOf(META_END)
  if (start === -1 || end === -1 || end < start) return shell

  const withMeta = shell.slice(0, start) + renderMeta(meta) + shell.slice(end + META_END.length)

  // The <title> is outside the block (it is not `og:` metadata); a link that
  // unfurls correctly while its tab says the bare product name is half the fix.
  // A function replacer: a string one reads `$&`, `$'` and `` $` `` in a
  // player-typed name as replacement patterns, splicing the document into
  // the title and ending the <head> early.
  const title = `<title>${escapeMarkup(tidy(meta.title, 70))}</title>`
  return withMeta.replace(/<title>[\s\S]*?<\/title>/, () => title)
}

/**
 * Add a canonical to the shell's own meta block, keeping its defaults: the
 * front door's page, which says what the shell already says. Unchanged when
 * the markers are absent, as `applyMeta`.
 */
export function applyCanonical(shell: string, href: string): string {
  const start = shell.indexOf(META_START)
  const end = shell.indexOf(META_END)
  if (start === -1 || end === -1 || end < start) return shell
  const canonical = renderTags([{ tag: 'link', attrs: { rel: 'canonical', href } }])
  return `${shell.slice(0, end)}${canonical}\n    ${shell.slice(end)}`
}

/**
 * Mark the shell as drawing no Union bar (`shell/unionSlots.ts`), for a route
 * that hides it, so the bar is hidden from the first paint. Unchanged when the
 * shell has no `<html` tag to mark.
 */
export function hideUnionBar(shell: string): string {
  return shell.replace(/<html(?=[\s>])/, () => `<html ${BAR_HIDDEN_ATTRIBUTE}`)
}

/**
 * An opening tag with an attribute set to `value` (in place, or added last),
 * or without it when `value` is null.
 */
function withAttribute(tag: string, name: string, value: string | null): string {
  const present = new RegExp(`\\s${name}="[^"]*"`)
  if (value === null) return tag.replace(present, '')
  const attribute = ` ${name}="${value}"`
  return present.test(tag) ? tag.replace(present, attribute) : tag.replace(/>$/, `${attribute}>`)
}

/**
 * Mark the shell's Union bar for the route it is served on (`unionHere`), so
 * the right tab, nav and nav item paint first: the bar wears the route's mode
 * (`data-mode`, which also shows that mode's nav), its tab is current, and
 * so is the nav link of the page you are on. The app moves all three as it
 * routes (`UnionBarSlots`). Only the bar's tags change: the header by its
 * class, the tabs by `data-tool`, the links by `data-nav`; React escapes
 * every attribute value, so no `>` sits inside a tag.
 */
export function markUnionRoute(shell: string, route: string): string {
  const { mode, nav } = unionHere(route)
  return shell.replace(/<(?:header|a)\s[^>]*>/g, (tag) => {
    if (tag.includes('class="su-union-bar"')) return withAttribute(tag, 'data-mode', mode)
    const tool = /\sdata-tool="([^"]*)"/.exec(tag)?.[1]
    if (tool !== undefined) return withAttribute(tag, 'aria-current', tool === mode ? 'true' : null)
    const link = /\sdata-nav="([^"]*)"/.exec(tag)?.[1]
    if (link !== undefined) return withAttribute(tag, 'aria-current', link === nav ? 'page' : null)
    return tag
  })
}
