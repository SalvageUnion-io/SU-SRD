import type { Page } from '@playwright/test'

/**
 * Hard rule R11, one Live Sheet grammar (ruleset §0, §1.2): the scan a sheet's
 * view is held to, Read or Edit, whichever kind it is (`sheet-grammar.e2e.ts`).
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

export async function findSheetGrammar(
  page: Page,
  state: { edit: boolean }
): Promise<SheetGrammarFinding[]> {
  // The sheet loads its record after the route settles: wait for its opening.
  await page
    .locator('main[data-variant] .su-sheet-hero')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {})
  return page.evaluate(
    ({ edit, words, emptyLines }) => {
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
          if (!b.classList.contains('su-sheet-item__ctl--square')) {
            found.push({
              rule: 'remove',
              detail: `${kind}: "${name}" is not the one remove control`,
            })
          }
        }
      }
      return found
    },
    { edit: state.edit, words: SHEET_VITAL_WORDS, emptyLines: EMPTY_LINES }
  )
}
