import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SearchField } from './SearchField'

export default {
  title: 'Atoms/Search Field',
}

/**
 * The shared search box (canonical). Top: the
 * header's compact `.srd-search` default (fixed-width combobox trigger). Bottom:
 * the full-width, larger `/search` page variant (taller padding, 16px glyph).
 */
export const Default: Story = () => {
  const [a, setA] = useState('')
  const [b, setB] = useState('Iron Mongrel')
  return (
    <div className="flex max-w-[900px] flex-col gap-6">
      <SearchField
        aria-label="Search the SRD"
        placeholder="Search…"
        className="w-52"
        value={a}
        onChange={(e) => setA(e.target.value)}
      />
      <SearchField
        type="search"
        aria-label="Search the SRD"
        placeholder="Search the SRD…"
        glyphSize={16}
        containerClassName="py-2 text-sm"
        value={b}
        onChange={(e) => setB(e.target.value)}
      />
    </div>
  )
}
