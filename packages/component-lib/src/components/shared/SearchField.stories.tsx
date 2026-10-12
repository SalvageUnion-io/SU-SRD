import { useState } from 'react'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import '../../stories/_stories.css'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[24], maxWidth: '900px' }}>
      <SearchField
        aria-label="Search the SRD"
        placeholder="Search…"
        style={{ width: '13rem' }}
        value={a}
        onChange={(e) => setA(e.target.value)}
      />
      <SearchField
        type="search"
        aria-label="Search the SRD"
        placeholder="Search the SRD…"
        glyphSize={16}
        containerClassName="su-story-search-field--page"
        value={b}
        onChange={(e) => setB(e.target.value)}
      />
    </div>
  )
}
