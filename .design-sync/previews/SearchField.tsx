/*
 * Ported from packages/component-lib/src/components/shared/SearchField.stories.tsx.
 *
 * The story passes the compact width as `className="w-52"`, which lands on the
 * input rather than the field's container, so both call-sites rendered at the
 * same full width and the size axis was invisible. The width is constrained on a
 * wrapper here instead, which is what the header does.
 */
import { SearchField } from 'component-lib'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The shared search box. Two call-sites ship: the header's compact
 * `.srd-search` trigger and the full-width `/search` page variant (taller
 * padding, 16px glyph).
 */
export function Sizes() {
  return (
    <div className="flex max-w-[900px] flex-col gap-6 bg-paper p-6">
      <Group caption="header — compact, fixed width, empty">
        <div className="w-52">
          <SearchField aria-label="Search the SRD" placeholder="Search…" defaultValue="" />
        </div>
      </Group>
      <Group caption="search page — full width, larger glyph, with a query">
        <SearchField
          type="search"
          aria-label="Search the SRD"
          placeholder="Search the SRD…"
          glyphSize={16}
          containerClassName="py-2 text-sm"
          defaultValue="Iron Mongrel"
        />
      </Group>
    </div>
  )
}
