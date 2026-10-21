import type { Page } from '@playwright/test'

/**
 * Hard rule R11, one Live Sheet grammar (ruleset §0, §1.2): the scan a sheet's
 * view is held to, Read or Edit, whichever kind it is (`design-walk.e2e.ts`).
 *
 * - `shell` — the page is `LiveSheet`'s (`main[data-variant]`), its chapter
 *   band's corner holds the sheet's actions, and on a sheet the viewer may
 *   write the band offers Read | Edit.
 * - `hero` — the body opens on `SheetHero` (`.su-sheet-hero`), its vitals the
 *   one stack (`.su-sheet-vitals`).
 * - `vitals` — every gauge in the opening is a `SheetVitalGauge`
 *   (`[data-vital]`), captioned in full words from the one map
 *   (`SHEET_VITAL_WORDS`, kept equal to `sheetVitals.model.ts` by
 *   `sheetVitals.test.ts`).
 * - `read` — Read is typeset: no field, slider or stepper in the body, and no
 *   empty section's "nothing here" line.
 * - `remove` — in Edit every remove control in the body is the one
 *   `SheetRemoveButton` (a photo's own control aside).
 * - `aside` — what the unit carries is the permanent right sidebar
 *   (`SheetColumns`, ruleset §1.2): a sheet that carries something has one
 *   (`[data-sheet-aside]`), every carried list (`[data-sheet-carried]`) and
 *   hold (`[data-storage-side]`) is in it, nothing in it folds, and it is
 *   under the opening: from the 64rem rung a column beside the main column
 *   (its top the main column's, its left past the main column's right), else
 *   stacked straight under the opening and over the main column. A sheet that
 *   carries nothing (an NPC) has none.
 */

/** Each vital's full words, by its `data-vital` key (`SHEET_VITALS`' labels). */
export const SHEET_VITAL_WORDS: Record<string, string> = {
  hp: 'Hit Points',
  ap: 'Ability Points',
  sp: 'Structure Points',
  ep: 'Energy Points',
  heat: 'Heat Capacity',
  upgrade: 'Upgrade Pool',
}

/** What an empty section says when Edit could fill it; Read leaves the section out. */
export const EMPTY_LINES = [
  'No abilities learned yet.',
  'Nothing carried.',
  'No systems installed.',
  'No modules installed.',
  'No weapons mounted.',
  'Hold empty.',
]

export type SheetGrammarFinding = { rule: string; detail: string }

/** What the scan is handed: the view's state and the words it holds a sheet to. */
export type SheetGrammarArgs = {
  edit: boolean
  /** The seeded unit carries something (every kind but the NPC): its sheet has a sidebar. */
  carries: boolean
  words: Record<string, string>
  emptyLines: readonly string[]
}

/**
 * The scan itself, run in the page (`page.evaluate` sends its source, so it
 * reads nothing from this module's scope: everything comes in its one argument).
 */
export function scanSheetGrammar({
  edit,
  carries,
  words,
  emptyLines,
}: SheetGrammarArgs): SheetGrammarFinding[] {
  const found: { rule: string; detail: string }[] = []
  const main = document.querySelector<HTMLElement>('main[data-variant]')
  if (!main) return [{ rule: 'shell', detail: 'no LiveSheet (`main[data-variant]`)' }]
  const kind = main.dataset.variant ?? '?'
  const band = main.querySelector('.su-chapter-band')
  const corner = band?.querySelector('.su-chapter-band__corner')
  if (!corner) found.push({ rule: 'shell', detail: `${kind}: the band has no corner` })
  // Read | Edit is a `Segmented`: a fieldset named by its legend.
  const toggle = [...(corner?.querySelectorAll('fieldset > legend') ?? [])].find((l) =>
    (l.textContent ?? '').startsWith('Read or edit')
  )
  const writable = corner?.querySelector('[aria-label^="Share"]')
  if (writable && !toggle) {
    found.push({ rule: 'shell', detail: `${kind}: a writable sheet with no Read | Edit` })
  }
  // Actions are the corner's, never the body's foot.
  const body = main.querySelector<HTMLElement>('.su-sheet-live-body')
  if (!body) return [...found, { rule: 'shell', detail: `${kind}: no sheet body` }]
  for (const b of body.querySelectorAll('button')) {
    const name = b.getAttribute('aria-label') ?? b.textContent ?? ''
    if (/^(Share|Delete)\b/.test(name.trim())) {
      found.push({ rule: 'shell', detail: `${kind}: "${name.trim()}" in the body` })
    }
  }

  const hero = body.querySelector('.su-sheet-hero')
  if (!hero) found.push({ rule: 'hero', detail: `${kind}: the body opens on no SheetHero` })
  const vitals = hero?.querySelector('.su-sheet-vitals')
  if (hero && !vitals) found.push({ rule: 'hero', detail: `${kind}: no vitals stack` })
  for (const pip of hero?.querySelectorAll('[data-pip]') ?? []) {
    if (!pip.closest('[data-vital]')) {
      found.push({ rule: 'vitals', detail: `${kind}: a gauge that is no SheetVitalGauge` })
      break
    }
  }
  for (const v of hero?.querySelectorAll<HTMLElement>('[data-vital]') ?? []) {
    const key = v.dataset.vital ?? ''
    const full = words[key]
    const text = (v.textContent ?? '').replace(/\s+/g, ' ')
    if (!full) found.push({ rule: 'vitals', detail: `${kind}: a vital "${key}" off the map` })
    else if (!text.toLowerCase().includes(full.toLowerCase())) {
      found.push({ rule: 'vitals', detail: `${kind}: ${key} not captioned "${full}"` })
    }
  }

  // The sidebar: what the unit carries, beside the sheet or under its opening.
  const aside = body.querySelector<HTMLElement>('[data-sheet-aside]')
  if (carries && !aside) found.push({ rule: 'aside', detail: `${kind}: no sidebar` })
  if (!carries && aside) {
    found.push({ rule: 'aside', detail: `${kind}: a sidebar on a sheet that carries nothing` })
  }
  for (const held of body.querySelectorAll('[data-sheet-carried], [data-storage-side]')) {
    if (!held.closest('[data-sheet-aside]')) {
      const name = held.getAttribute('aria-label') ?? held.getAttribute('data-storage-side')
      found.push({ rule: 'aside', detail: `${kind}: carried things outside the sidebar (${name})` })
    }
  }
  if (aside) {
    if (aside.querySelector('.su-slab-section__head--fold')) {
      found.push({ rule: 'aside', detail: `${kind}: a section in the sidebar folds` })
    }
    const opening = body.querySelector('.su-sheet-columns__hero')?.getBoundingClientRect()
    const main = body.querySelector('.su-sheet-columns__main')
    const mainBox = main && main.childElementCount > 0 ? main.getBoundingClientRect() : null
    const side = aside.getBoundingClientRect()
    if (side.width === 0 || side.height === 0) {
      found.push({ rule: 'aside', detail: `${kind}: the sidebar is collapsed` })
    } else if (!opening) {
      found.push({ rule: 'aside', detail: `${kind}: no opening over the sidebar` })
    } else if (side.top < opening.bottom - 1) {
      found.push({ rule: 'aside', detail: `${kind}: the sidebar is not under the opening` })
    } else if (window.matchMedia('(width >= 64rem)').matches && mainBox) {
      // Page width: a column beside the main column, from its top.
      if (Math.abs(side.top - mainBox.top) > 1 || side.left < mainBox.right - 1) {
        found.push({ rule: 'aside', detail: `${kind}: the sidebar is not beside the sheet` })
      }
    } else if (
      Math.abs(side.left - opening.left) > 1 ||
      (mainBox && mainBox.top < side.bottom - 1)
    ) {
      // A phone: stacked straight under the opening, over the main column.
      found.push({ rule: 'aside', detail: `${kind}: the sidebar is not stacked under the opening` })
    }
  }

  if (!edit) {
    const fields = body.querySelectorAll(
      'input:not([type="hidden"]), textarea, select, [role="slider"], [contenteditable="true"]'
    )
    for (const f of fields) {
      const name = f.getAttribute('aria-label') ?? f.getAttribute('name') ?? f.tagName
      found.push({ rule: 'read', detail: `${kind}: a field in Read (${name})` })
    }
    for (const b of body.querySelectorAll('button')) {
      const name = b.getAttribute('aria-label') ?? ''
      if (/^(Increase|Decrease) /.test(name)) {
        found.push({ rule: 'read', detail: `${kind}: a stepper in Read (${name})` })
      }
    }
    const text = body.innerText
    for (const line of emptyLines) {
      if (text.includes(line)) {
        found.push({ rule: 'read', detail: `${kind}: an empty section in Read ("${line}")` })
      }
    }
  } else {
    for (const b of body.querySelectorAll('button')) {
      const name = b.getAttribute('aria-label') ?? ''
      if (!/^Remove /.test(name) || /photo$/.test(name)) continue
      if (!b.classList.contains('su-sheet-item__remove')) {
        found.push({
          rule: 'remove',
          detail: `${kind}: "${name}" is not the one remove control`,
        })
      }
    }
  }
  return found
}

export async function findSheetGrammar(
  page: Page,
  state: { edit: boolean; carries: boolean }
): Promise<SheetGrammarFinding[]> {
  // The sheet loads its record after the route settles: wait for its opening.
  await page
    .locator('main[data-variant] .su-sheet-hero')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {})
  return page.evaluate(scanSheetGrammar, {
    edit: state.edit,
    carries: state.carries,
    words: SHEET_VITAL_WORDS,
    emptyLines: EMPTY_LINES,
  })
}
