/**
 * BlankChassisPick — the Blank Mech dialog's chassis: every chassis in the
 * one Ledger picker (ledger.md L7), a Tech Level and its figures a row, with
 * a search over the 51 names. Nothing picked is a mech with no chassis yet,
 * decided on the sheet.
 */

import type { CSSProperties, KeyboardEvent, Ref } from 'react'
import { useMemo, useRef, useState } from 'react'
import type { RefChassis } from 'salvageunion-reference'
import { byTechLevelThenName, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { EmptyState, SearchField, tokens } from '../../components/index'
import { nameMatches } from '../../lib/nameMatch'
import { readReference } from '../../lib/readReference'
import { buildWizardCopy } from '../../messages/build-wizard'
import { CHASSIS_COLUMNS } from '../mech/chassisColumns.model'
import { PickList } from './PickList'
import type { PickColumn } from './pickLedger.model'

const TECH_LEVEL: PickColumn<RefChassis> = {
  key: 'tl',
  label: buildWizardCopy('tl3'),
  title: buildWizardCopy('techLevel'),
  phone: true,
  value: (c) => c.techLevel,
}
/**
 * A dialog's width holds the Tech Level and the four figures a build starts
 * from. A phone keeps the Tech Level, Structure Points and both slot counts
 * (r4 E17): the slots are what a chassis is chosen by.
 */
const KEPT = new Set(['sv', 'sp', 'ep', 'sys', 'mod'])
const ON_PHONE = new Set(['sp', 'sys', 'mod'])
const COLUMNS = [
  TECH_LEVEL,
  ...CHASSIS_COLUMNS.filter((column) => KEPT.has(column.key)).map((column) => ({
    ...column,
    phone: ON_PHONE.has(column.key),
  })),
]

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties
/** The list scrolls in the dialog; the search and the actions stay in reach. */
const LIST = { maxHeight: '40dvh', overflowY: 'auto' } satisfies CSSProperties

export function BlankChassisPick({
  value,
  onChange,
  onEnter,
  searchRef,
}: {
  /** The picked chassis's slug; '' while none is. */
  value: string
  onChange: (slug: string) => void
  /** Enter in the search: the picked chassis, or the only one left (r4 E4). */
  onEnter?: (slug: string) => void
  /** The search field: where the dialog's typing starts (r4 E14). */
  searchRef?: Ref<HTMLInputElement>
}) {
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const all = useMemo(
    () =>
      readReference(
        'BlankChassisPick.chassis',
        () => [...SalvageUnionReference.Chassis.all()].sort((a, b) => byTechLevelThenName(a, b)),
        []
      ),
    []
  )
  const needle = query.trim().toLowerCase()
  // Forgiving, as the System picker's search is (r4 E14).
  const rows = needle === '' ? all : all.filter((c) => nameMatches(c.name, needle))
  const slugs = rows.map((c) => nameToSlug(c.name))
  // Down and Up move the pick through the rows shown; Enter takes it (r4 E4).
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (slugs.length === 0) return
      event.preventDefault()
      const at = slugs.indexOf(value)
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = at === -1 ? (step === 1 ? 0 : slugs.length - 1) : at + step
      const slug = slugs[Math.max(0, Math.min(slugs.length - 1, next))]
      if (slug === undefined) return
      onChange(slug)
      listRef.current
        ?.querySelector<HTMLElement>('[data-picked]')
        ?.scrollIntoView?.({ block: 'nearest' })
      return
    }
    if (event.key !== 'Enter' || !onEnter) return
    const pick = slugs.includes(value) ? value : slugs.length === 1 ? slugs[0] : undefined
    if (pick === undefined) return
    event.preventDefault()
    if (pick !== value) onChange(pick)
    onEnter(pick)
  }
  return (
    // `.su-sheet--mech` gives the picker its band's tone, as the wizard's has.
    <div className="su-sheet--mech" style={COLUMN}>
      <SearchField
        ref={searchRef}
        onKeyDown={onKeyDown}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={buildWizardCopy('searchChassis')}
        aria-label={buildWizardCopy('searchChassis')}
        autoComplete="off"
      />
      <div ref={listRef} style={LIST}>
        {rows.length === 0 && (
          <EmptyState variant="inline" body={buildWizardCopy('nothingFound')} />
        )}
        <PickList
          title={buildWizardCopy('chassis')}
          note={buildWizardCopy('optionalDecideOnTheSheet')}
          rows={rows}
          rowKey={(c) => nameToSlug(c.name)}
          rowName={(c) => c.name}
          columns={COLUMNS}
          selected={value || undefined}
          onSelect={onChange}
        />
      </div>
    </div>
  )
}
