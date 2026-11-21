/**
 * The `ui-strings/hard-coded` rule's exemptions (`uiStrings.ts`): strings the
 * rule reads as words that are not the interface's copy, so the catalogue is
 * not where they belong (a CSS value, a selector, markup, an HTTP token, a
 * key matched against data or against a browser's own message).
 *
 * One entry per file, naming each exempt string whole, as the source spells
 * it (white space collapsed). Nothing else in the file is waived, and a string
 * the file no longer holds fails `uiStrings.test.ts`. A sentence a reader
 * sees is moved into the catalogue, never listed here.
 */
export type StringExemption = { file: string; strings: readonly string[]; reason: string }

export const EXEMPTIONS: readonly StringExemption[] = [
  {
    file: 'apps/web/src/design/contrast.ts',
    strings: ['in srgb'],
    reason:
      'The colour-space argument of a CSS `color-mix()`, compared against a parsed token: CSS syntax, never drawn.',
  },
  {
    file: 'apps/web/src/design/tokens.ts',
    strings: ['0 14px 28px -14px rgb(40 32 25 / 0.5)'],
    reason: 'The `--shadow-lift` token: a CSS box-shadow value.',
  },
  {
    file: 'apps/web/src/lib/browserObservability.ts',
    strings: [
      'Transition was skipped',
      'Skipping view transition',
      'Transition was aborted because of invalid state',
      'ResizeObserver loop',
      'NonError: Script error.',
    ],
    reason:
      "Substrings of the browsers' own error messages, matched to drop noise from error reports; the app never says them.",
  },
  {
    file: 'apps/web/src/lib/npcs/npcModel.ts',
    strings: ['Salvage Union Workshop Manual'],
    reason:
      "A reference entity's `source` field, typed by the dataset's book names: a data value the card's citation reads, not a label typed here.",
  },
  {
    file: 'apps/web/src/lib/pageRefIndex.ts',
    strings: ['Salvage Union Workshop Manual'],
    reason:
      "The book name compared against each entity's `source` in the dataset to index its pages: a data key, never drawn.",
  },
  {
    file: 'apps/web/src/lib/revealRolled.ts',
    strings: ['(prefers-reduced-motion: reduce)'],
    reason: 'A CSS media query given to `matchMedia`.',
  },
  {
    file: 'apps/web/src/lib/sitemapXml.ts',
    strings: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    ],
    reason: "The sitemap's XML declaration and root tag: markup for crawlers.",
  },
  {
    file: 'apps/web/src/runtime/interaction.ts',
    strings: ['button, [role="button"], [role="tab"], [role="switch"], summary'],
    reason: 'A CSS selector given to `closest`.',
  },
  {
    file: 'apps/web/src/runtime/offlineWarm.client.ts',
    strings: ['(display-mode: standalone)', '(display-mode: minimal-ui)'],
    reason: 'CSS media queries given to `matchMedia`.',
  },
  {
    file: 'apps/web/src/shell/shell.ts',
    strings: ['width=device-width, initial-scale=1.0', '<!doctype html>', '<html lang="en">'],
    reason: "The shell document's viewport value, doctype and root tag: markup.",
  },
  {
    file: 'apps/web/src/worker/linkPreview.ts',
    strings: ['Not found', 'public, max-age=86400'],
    reason:
      "A 404's plain-text body for a machine client (server status text, outside the catalogue by messages.md §3) and a `cache-control` header value.",
  },
  {
    file: 'apps/web/src/worker/miss.ts',
    strings: ['Not found', 'public, max-age=86400'],
    reason:
      'The plain-text 404 body a missing chunk or a failed 404 page answers with (server status text, messages.md §3) and a `cache-control` header value.',
  },
  {
    file: 'apps/web/src/play/PlayFrame.tsx',
    strings: ['solid var(--color-ink)'],
    reason: 'The tail of a CSS `border-top` value in a style object.',
  },
  {
    file: 'apps/web/src/play/games/OwnerSeal.tsx',
    strings: ['transform, translate, scale, rotate'],
    reason: 'A CSS `transition-property` value in a style object.',
  },
  {
    file: 'apps/web/src/play/tables.model.ts',
    strings: ['Core Mechanic', 'Critical Damage', 'Reactor Overload', 'Critical Injury'],
    reason:
      "Roll tables by their names in the reference data (`RollTables.getByName`): the dataset's keys, which a translated word would not find. What is drawn is the table's own name from the data.",
  },
  {
    file: 'apps/web/src/play/mediator/PlayNpcActions.tsx',
    strings: ['NPC Action'],
    reason:
      "The NPC Action roll table by its name in the reference data (`RollTables.getByName`): the dataset's key.",
  },
  {
    file: 'apps/web/src/build/crawler/CrawlerWizard.tsx',
    strings: ['Salvage Union Workshop Manual'],
    reason:
      "The book's title as the reference's source value on a cite: game data from the Source enum, not interface copy.",
  },
  {
    file: 'apps/web/src/build/mech/MechWizard.tsx',
    strings: ['Salvage Union Workshop Manual'],
    reason:
      "The book's title as the reference's source value on a cite: game data from the Source enum, not interface copy.",
  },
  {
    file: 'apps/web/src/build/pilot/PilotWizard.tsx',
    strings: ['Salvage Union Workshop Manual'],
    reason:
      "The book's title as the reference's source value on a cite: game data from the Source enum, not interface copy.",
  },
  {
    file: 'apps/web/src/build/sheet/CrawlerEconomyControl.tsx',
    strings: ['Crawler Deterioration', 'Trading Bay'],
    reason: 'Roll-table names passed to rollFor: lookup keys into the dataset, never drawn.',
  },
  {
    file: 'apps/web/src/build/sheet/crawlerEconomyDialogState.model.ts',
    strings: ['Crawler Deterioration'],
    reason: 'Roll-table name passed to RollTables.getByName: a lookup key into the dataset.',
  },
  {
    file: 'apps/web/src/build/wizard/rollTableHelpers.model.ts',
    strings: [
      'Callsign Table',
      'Pilot Appearance',
      'Mech Appearance',
      'Mech Pattern Names',
      'Crawler Name',
    ],
    reason: 'Roll-table names: lookup keys into the dataset.',
  },
  {
    file: 'apps/web/src/lib/rules/actionPatches.ts',
    strings: ['Core Mechanic', 'EP or AP'],
    reason:
      "A roll-table lookup key, and the dataset's activationCurrency value compared against: machine keys.",
  },
  {
    file: 'apps/web/src/build/sheet/LiveSheet.tsx',
    strings: [
      'var(--su-kind, var(--color-wk-bg))',
      'opacity, visibility, translate',
      'opacity, transform',
    ],
    reason: 'CSS values in a style object.',
  },
  {
    file: 'apps/web/src/build/sheet/UsedPip.tsx',
    strings: ['solid currentColor', 'var(--tone, var(--color-pilot))'],
    reason: 'CSS values in a style object.',
  },
  {
    file: 'apps/web/src/build/wizard/WizShell.tsx',
    strings: [
      '0 0 0 4px var(--tone)',
      'inset 0 0 0 2.5px var(--color-ink)',
      '9px solid transparent',
      '14px solid',
    ],
    reason: 'CSS values in a style object.',
  },
]

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Whether `text`, a string of `file`, is exempt as written. */
export function isExemptString(file: string, text: string): boolean {
  const shown = squash(text)
  return EXEMPTIONS.some((e) => e.file === file && e.strings.includes(shown))
}
