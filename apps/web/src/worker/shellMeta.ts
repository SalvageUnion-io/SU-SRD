/**
 * Per-route metadata for the SPA shell.
 *
 * The Cantina is client-rendered, and an unfurl bot runs no JavaScript, so a route's
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
 * The shell (`shell/shell.ts`) carries `<!-- cantina:meta:start -->` / `<!-- cantina:meta:end -->`
 * around its defaults, and this swaps that whole block. A precise delimiter
 * beats pattern-matching tags: the block is replaced wholesale, so a per-route
 * tag and a default tag can never both survive for a parser to choose between.
 */

import { PRODUCT } from 'cantina-domain/product'
import { BAR_HIDDEN_ATTRIBUTE } from '../shell/unionSlots'

/** Everything the shell's meta block says for one route. */
export type ShellMeta = {
  title: string
  description: string
  /** Absolute URL of the page being served. */
  url: string
  /**
   * The page's canonical address, for a page search may list
   * (`publicPages.ts`). A shared thing's preview has none: the shell names no
   * canonical (`shell/shell.ts`), and neither does its swap.
   */
  canonical?: string
  /** The band's tone, so the unfurl's side bar matches the card. */
  themeColor: string
  /** The card's image, when one can be rendered; without it the unfurl is text. */
  image?: { url: string; alt: string }
}

export const META_START = '<!-- cantina:meta:start -->'
export const META_END = '<!-- cantina:meta:end -->'

/** Minimal HTML-attribute escaping. Names are player-controlled. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Collapse whitespace and cap length, so a long name cannot bloat the head. */
function tidy(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

function canonicalTag(href: string): string {
  return `<link rel="canonical" href="${escapeAttr(href)}" />`
}

/** Render the meta block for one route. */
function renderMeta(meta: ShellMeta): string {
  const title = escapeAttr(tidy(meta.title, 70))
  const description = escapeAttr(tidy(meta.description, 200))
  const url = escapeAttr(meta.url)
  const image = meta.image
  return [
    META_START,
    `<meta name="theme-color" content="${escapeAttr(meta.themeColor)}" />`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttr(PRODUCT.name)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    ...(meta.canonical ? [canonicalTag(meta.canonical)] : []),
    ...(image
      ? [
          `<meta property="og:image" content="${escapeAttr(image.url)}" />`,
          `<meta property="og:image:width" content="1200" />`,
          `<meta property="og:image:height" content="630" />`,
          `<meta property="og:image:alt" content="${escapeAttr(tidy(image.alt, 120))}" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:image" content="${escapeAttr(image.url)}" />`,
        ]
      : [`<meta name="twitter:card" content="summary" />`]),
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    META_END,
  ].join('\n    ')
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
  const title = `<title>${escapeAttr(tidy(meta.title, 70))}</title>`
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
  return `${shell.slice(0, end)}${canonicalTag(href)}\n    ${shell.slice(end)}`
}

/**
 * Mark the shell as drawing no Union bar (`shell/unionSlots.ts`), for a route
 * that hides it, so the bar is hidden from the first paint. Unchanged when the
 * shell has no `<html` tag to mark.
 */
export function hideUnionBar(shell: string): string {
  return shell.replace(/<html(?=[\s>])/, () => `<html ${BAR_HIDDEN_ATTRIBUTE}`)
}
