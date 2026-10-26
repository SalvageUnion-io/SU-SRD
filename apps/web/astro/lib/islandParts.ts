/**
 * islandParts — a rendered body cut at its island markers, for `Page.astro`.
 *
 * `<Island>` renders `<template data-island="Name" data-island-id="iN">stand-in</template>`
 * where an island goes (`src/runtime/Island.tsx`). Each marker becomes the
 * island it names, with its stand-in markup; the markup between them stays
 * as it was rendered.
 */

import type { CollectedIsland, CollectedIslands } from '../../src/runtime/Island'

/** One island to render, with the stand-in `<Island ssr>` drew for it ('' when none). */
export type IslandPart = CollectedIsland & { standIn: string }

export type BodyPart = { html: string } | { island: IslandPart }

const MARKER = /<template data-island="\w+" data-island-id="(i\d+)">([\s\S]*?)<\/template>/g

export function islandParts(body: string, islands: CollectedIslands): BodyPart[] {
  const parts: BodyPart[] = []
  let last = 0
  for (const match of body.matchAll(MARKER)) {
    const [whole, id = '', standIn = ''] = match
    const island = islands[id]
    if (!island) throw new Error(`[build] island marker ${id} has no collected island`)
    if (match.index > last) parts.push({ html: body.slice(last, match.index) })
    parts.push({ island: { ...island, standIn } })
    last = match.index + whole.length
  }
  if (last < body.length) parts.push({ html: body.slice(last) })
  return parts
}

/** The props `mountsNow` reads, all an `interaction` island's directive carries. */
export function nowProps(props: Record<string, unknown>): Record<string, unknown> {
  const { variant, schemaId } = props
  return Object.fromEntries(
    Object.entries({ variant, schemaId }).filter(([, value]) => value !== undefined)
  )
}
