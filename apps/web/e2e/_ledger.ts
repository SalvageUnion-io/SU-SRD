import type { Page } from '@playwright/test'
import { ledgerOrderFaults } from 'gates/lib/ledgerOrder'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * The Ledger at render (ledger.md L1 to L9): every `.su-ledger`
 * on the page. Each fault is `<rule>: <detail>`, its rule one of
 *
 * - `frame` (L1): a Ledger inside a Ledger's row, or a row that frames or
 *   bands itself (its pick's card under it aside);
 * - `tab` (L2): a head strip with no title on its cut-out tab (unless the
 *   header over it, its page's h1 or its Peek's title, names it), or a Slab
 *   standing over the Ledger as its section's whole body;
 * - `order` (L5, §2.6): head stamps out of the stat order;
 * - `empty` (L5): a cell that draws nothing, not `—`;
 * - `picked` (L7): a picked row not set in ink, or wearing a seal;
 * - `sort` (L2, §3.13): a head stamp that is a button off an SRD index.
 *
 * `findLedgers` reads the page; `findLedgerFaults`, pure, judges what it read
 * (`e2e/__tests__/ledger.test.ts`).
 */

export type LedgerRead = {
  label: string
  /** The tab's title, as drawn. */
  title: string
  /** The column stamps, in order, the name's aside. */
  stamps: string[]
  /** Whether a head stamp or the tab is a button. */
  sorts: boolean
  /** Whether a Slab's section holds this Ledger alone. */
  underSlab: boolean
  /** Ledgers and framed boxes inside its rows, the pick's card aside. */
  framedRows: number
  /** Cells that draw no text. */
  blankCells: number
  /** Picked rows whose ground is not ink, or that carry a seal. */
  unpicked: number
}

/** The Ledgers off an SRD index whose head stamps sort (L2): the Training Bay's Mechs and Patterns shelves (r4 E13). */
const SORTING_SHELVES: readonly string[] = ['Mechs', 'Patterns']

export function findLedgerFaults(
  ledgers: readonly LedgerRead[],
  { index, shelves = false }: { index: boolean; shelves?: boolean }
): string[] {
  const faults: string[] = []
  for (const l of ledgers) {
    if (l.framedRows > 0) faults.push(`frame: ${l.label}: ${l.framedRows} framed row(s)`)
    if (!l.title) faults.push(`tab: ${l.label}: no title on its tab`)
    if (l.underSlab) faults.push(`tab: ${l.label}: a Slab stands over its tab`)
    for (const fault of ledgerOrderFaults(l.stamps)) faults.push(`order: ${l.label}: ${fault}`)
    if (l.blankCells > 0) faults.push(`empty: ${l.label}: ${l.blankCells} blank cell(s)`)
    if (l.unpicked > 0) faults.push(`picked: ${l.label}: ${l.unpicked} picked row(s) not inked`)
    if (l.sorts && !index && !(shelves && SORTING_SHELVES.includes(l.label)))
      faults.push(`sort: ${l.label}: a head stamp sorts off an SRD index`)
  }
  return faults
}

function readLedgers(page: Page): Promise<LedgerRead[]> {
  return page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-ink)'
    document.body.append(probe)
    const ink = getComputedStyle(probe).color
    probe.remove()
    const text = (el: Element | null | undefined) =>
      (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    /** Whether the header over a list (its Peek's title, else the page's h1) says its name. */
    const namedBy = (ledger: Element, name: string) => {
      const host = ledger.closest('[data-peek-popup], [role="dialog"]')
      const header = host
        ? host.querySelector('h1, h2, [data-fill-name]')
        : document.querySelector('main h1')
      const said = text(header).toLowerCase()
      return name !== '' && said.includes(name.toLowerCase())
    }
    const out: LedgerRead[] = []
    for (const ledger of document.querySelectorAll('.su-ledger')) {
      const r = ledger.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || ledger.closest('[aria-hidden="true"], [inert]')) continue
      const table = ledger.querySelector(':scope table')
      if (!table) continue
      const rows = [...table.querySelectorAll(':scope > tbody > tr')].filter(
        (row) => !row.matches('.su-ledger__detail, .su-ledger__empty')
      )
      const heads = [...table.querySelectorAll(':scope > thead > tr > th')]
      const body = ledger.closest('.su-slab-section__body')
      out.push({
        label: table.getAttribute('aria-label') ?? 'a Ledger',
        title:
          text(heads[0]?.querySelector('.su-entity-compact__notch .su-entity-compact__title')) ||
          // A list whose header names it (its page's title, its Peek's) prints no
          // tab: its name is that header's, and only then.
          (table.hasAttribute('data-plain-title') &&
          namedBy(ledger, table.getAttribute('aria-label') ?? '')
            ? '(its header)'
            : ''),
        stamps: heads
          .slice(1)
          .filter((th) => th.getAttribute('data-kind') !== 'trailing')
          .map((th) => text(th)),
        sorts: table.querySelector(':scope > thead button.su-ledger__sort') !== null,
        underSlab: body !== null && body.children.length === 1 && body.contains(ledger),
        framedRows: rows.filter((row) => row.querySelector('.su-ledger, .su-box')).length,
        blankCells: rows
          .flatMap((row) => [...row.querySelectorAll(':scope > td:not([data-kind="trailing"])')])
          .filter((td) => getComputedStyle(td).display !== 'none' && text(td) === '').length,
        unpicked: rows.filter(
          (row) =>
            row.hasAttribute('data-picked') &&
            (getComputedStyle(row).backgroundColor !== ink ||
              row.querySelector('.su-selected-seal') !== null)
        ).length,
      })
    }
    return out
  })
}

/** Every Ledger fault on the page; `index` on an SRD index, whose head stamps sort. */
export async function findLedgers(
  page: Page,
  context: { index: boolean; shelves?: boolean }
): Promise<Finding[]> {
  return fromFaults(findLedgerFaults(await readLedgers(page), context))
}
