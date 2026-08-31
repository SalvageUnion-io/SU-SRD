/*
 * Ported from packages/component-lib/src/components/referenceEntity/Content.stories.tsx.
 *
 * Two departures from the story. It hand-writes its blocks ("This system
 * provides enhanced capabilities"); real blocks are collected off real entities
 * here instead, since the package's own story standard asks for SRD data and
 * production text is what exposes wrapping and spacing.
 *
 * And the blocks are gathered BY TYPE across every schema rather than taken from
 * one entity. Measured over the whole dataset there are 2003 paragraph blocks
 * but only 17 headings, 15 hints, 7 flavor and 4 label blocks — so no single
 * entity carries the variety this component exists to render, and a
 * one-entity cell is a wall of paragraphs.
 */
import { Content } from 'component-lib'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

type Block = SURefObjectContentBlock & { type?: string }

function everyBlock(): Block[] {
  return [
    ...SalvageUnionReference.Actions.all(),
    ...SalvageUnionReference.Abilities.all(),
    ...SalvageUnionReference.Systems.all(),
    ...SalvageUnionReference.Guides.all(),
  ].flatMap((e) => (e.content ?? []) as Block[])
}

/** One real block of each type, in the order a body tends to use them. */
function sampler(): Block[] {
  const all = everyBlock()
  const first = (type: string, n = 1) => all.filter((b) => b?.type === type).slice(0, n)
  return [
    ...first('heading'),
    ...first('paragraph'),
    ...first('list-item', 3),
    ...first('hint'),
    ...first('flavor'),
  ]
}

/**
 * Renders a content-block array — this is how every entity body reaches the
 * page. Headings, paragraphs, list-items, hints and flavour each get their own
 * treatment.
 */
export function BlockTypes() {
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 text-ink">
      <Caption>one real block of each type</Caption>
      <div className="w-[500px] bg-paper p-3">
        <Content body={sampler()} />
      </div>
    </div>
  )
}

/** A single entity's body, end to end — the common case. */
export function EntityBody() {
  const action =
    SalvageUnionReference.Actions.all().find((a) => (a.content ?? []).length > 3) ??
    SalvageUnionReference.Actions.all()[0]
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 text-ink">
      <Caption>{action?.name ?? 'Action'} — its own content, as printed</Caption>
      <div className="w-[500px] bg-paper p-3">
        <Content body={((action?.content ?? []) as Block[]).slice(0, 6)} />
      </div>
    </div>
  )
}

/** `compact` tightens the spacing — what a nested card uses. */
export function Compact() {
  const body = sampler()
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 text-ink">
      <Caption>default spacing</Caption>
      <div className="w-[420px] bg-paper p-3">
        <Content body={body} />
      </div>
      <Caption>compact</Caption>
      <div className="w-[420px] bg-paper p-3">
        <Content body={body} compact />
      </div>
    </div>
  )
}
