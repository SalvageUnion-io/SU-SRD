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
    file: 'apps/web/src/components/entity/peekController.ts',
    strings: ['.su-ledger__table tr', '(hover: none)'],
    reason: 'A CSS selector given to `closest` and a CSS media query given to `matchMedia`.',
  },
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
    file: 'apps/web/src/runtime/installedApp.ts',
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
    file: 'apps/web/src/play/tables.model.ts',
    strings: [
      'Core Mechanic',
      'Critical Damage',
      'Reactor Overload',
      'Critical Injury',
      'Group Initiative',
    ],
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
    file: 'apps/web/src/play/craftTrade.model.ts',
    strings: ['Trading Bay'],
    reason: 'Roll-table name passed to rollFor: a lookup key into the dataset, never drawn.',
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
    file: 'apps/web/src/build/sheet/liveSheetBarStyles.model.ts',
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
  {
    file: 'apps/web/src/components/ClassAbilityTree.tsx',
    strings: [
      'You must have the preceding skill in a Core Ability Tree to train the next Ability.',
      'You must have training in 6 Core Abilities and 3 Abilities in the Core Ability tree linked to your Advanced or Hybrid Class to advance into the Class.',
      'You must have the preceding Ability in the Advanced or Hybrid Ability Tree before you train the next Ability.',
      'You must have 6 Core Abilities and 3 Advanced or Hybrid Class Abilities trained before you train a Legendary Ability. You may only have one Legendary Ability.',
    ],
    reason:
      "The Workshop Manual's rule for each tier, verbatim (p.23): the book's printed words, which stay the book's and are never reworded or translated here.",
  },
  {
    file: 'apps/web/src/components/atoms/KofiButton.tsx',
    strings: ['noopener noreferrer'],
    reason: 'An HTML `rel` token list.',
  },
  {
    file: 'apps/web/src/components/atoms/chipFill.ts',
    strings: ['button, input, select, textarea, [role="radio"], [role="tab"], [role="switch"]'],
    reason: 'A CSS selector given to `querySelector`.',
  },
  {
    file: 'apps/web/src/components/atoms/transition.ts',
    strings: [
      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
    ],
    reason: 'A CSS `transition-property` value in a style object.',
  },
  {
    file: 'apps/web/src/components/atoms/userMadeHatch.ts',
    strings: ['repeating-linear-gradient(135deg, transparent 0 9px, var(--color-ink-20) 9px 11px)'],
    reason: 'A CSS background-image value.',
  },
  {
    file: 'apps/web/src/components/atoms/vitalGaugeSegment.tsx',
    strings: ['transform, translate, scale, rotate'],
    reason: 'A CSS `transition-property` value in a style object.',
  },
  {
    file: 'apps/web/src/components/compositions/EntitySearcherFilters.tsx',
    strings: ['solid currentColor'],
    reason: 'The tail of a CSS `border` value in a style object.',
  },
  {
    file: 'apps/web/src/components/compositions/NavDrawer.tsx',
    strings: ['noopener noreferrer'],
    reason: 'An HTML `rel` token list.',
  },
  {
    file: 'apps/web/src/components/compositions/RollTableInstrument.tsx',
    strings: ['su-roll__stamp su-roll__roll'],
    reason: 'CSS class names, space-separated: selectors the stylesheet matches, never drawn.',
  },
  {
    file: 'apps/web/src/components/compositions/rollTableBands.ts',
    strings: ['color-mix(in srgb,'],
    reason: 'The head of a CSS `color-mix()` value.',
  },
  {
    file: 'apps/web/src/components/containers/HeaderMenu.tsx',
    strings: ['var(--su-union-bar-control, auto)', 'min(320px, var(--available-width))'],
    reason: 'CSS values in a style object.',
  },
  {
    file: 'apps/web/src/components/containers/ModalShell.tsx',
    strings: ['auto auto'],
    reason: 'The tail of a CSS `margin` value in a style object.',
  },
  {
    file: 'apps/web/src/components/containers/SlabSection.tsx',
    strings: ['transform, translate, scale, rotate'],
    reason: 'A CSS `transition-property` value in a style object.',
  },
  {
    file: 'apps/web/src/components/entity/forms/CompactIndex.tsx',
    strings: ['22rem, 50vw'],
    reason: "The tail of an image's `sizes` value: markup for the browser's source choice.",
  },
  {
    file: 'apps/web/src/components/entity/forms/Mini.tsx',
    strings: ['su-entity-mini__name su-entity-mini__link'],
    reason: 'CSS class names, space-separated: selectors the stylesheet matches, never drawn.',
  },
  {
    file: 'apps/web/src/components/entity/modes/selectedRing.ts',
    strings: ['0 0 0 3px var(--color-ink)'],
    reason: 'A CSS `box-shadow` value in a style object.',
  },
  {
    file: 'apps/web/src/components/entity/peekPlate.ts',
    strings: [
      'drop-shadow(4px 4px 0 var(--color-ink))',
      'min(500px, calc(100vw - 16px), calc(var(--available-width, 100vw) - 4px))',
    ],
    reason: 'CSS values in a style object.',
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/GuideSteps.tsx',
    strings: ['su-guide__toc-link su-guide__toc-link--section'],
    reason: 'CSS class names, space-separated: selectors the stylesheet matches, never drawn.',
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/WhenDamaged.tsx',
    strings: ['su-entity-page__section-body su-entity-page__prose'],
    reason: 'CSS class names, space-separated: selectors the stylesheet matches, never drawn.',
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/cardChrome.ts',
    strings: [
      'color-mix(in srgb, var(--color-ink) 30%, var(--color-paper))',
      'color-mix(in srgb, var(--color-ink) 70%, var(--color-paper))',
      'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))',
      'color-mix(in srgb,',
    ],
    reason: 'CSS `color-mix()` values: band colours, never drawn as words.',
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/cardGrain.ts',
    strings: [
      "<filter id='",
      "<feTurbulence type='fractalNoise' baseFrequency='",
      "<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
      "<feComposite in='SourceGraphic' in2='m' operator='in'/>",
      "<rect width='100%' height='100%' fill='",
      "<svg xmlns='http://www.w3.org/2000/svg' aria-hidden='true' width='100%' height='100%'>",
    ],
    reason: "The grain texture's SVG, built as a string for a CSS background: markup.",
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/choiceAnchoring.ts',
    strings: ['per tech level', 'tech level'],
    reason:
      "Keywords matched against the dataset's own content text to place a marker: keys compared with data, never drawn.",
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/legalStartingPattern.ts',
    strings: [
      'This Pattern is a legal Tech 1 build for a starting Mech if you are new to the game.',
    ],
    reason:
      "The book's own words, printed under each of the five such patterns (Salvage Union Core Book pp.101, 103, 105, 107, 109): game text, which stays the book's.",
  },
  {
    file: 'apps/web/src/components/referenceEntity/referenceEntityHelpers.ts',
    strings: ['color-mix(in srgb,'],
    reason: 'The head of a CSS `color-mix()` value.',
  },
  {
    file: 'apps/web/src/components/shared/EntityPhoto.tsx',
    strings: ['dashed currentColor', '16rem, 100vw'],
    reason: "The tail of a CSS `border` value, and the tail of an image's `sizes` value.",
  },
  {
    file: 'apps/web/src/reference/endpoints/llmsTxt.ts',
    strings: ['text/plain; charset=utf-8'],
    reason: 'A `Content-Type` header value.',
  },
  {
    file: 'apps/web/src/reference/endpoints/redirects.ts',
    strings: [
      '# Generated by src/reference/endpoints/redirects.ts — edit there, not in dist.',
      'text/plain; charset=utf-8',
    ],
    reason:
      'The comment line heading the generated `_redirects` file, read by whoever opens the build output, and a `Content-Type` header value: neither is drawn.',
  },
  {
    file: 'apps/web/src/reference/layouts/BaseLayout.tsx',
    strings: [
      'width=device-width, initial-scale=1.0',
      'noindex, nofollow',
      '@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}',
    ],
    reason:
      "The document's viewport and robots `<meta>` values, and the inline view-transition opt-in's CSS: markup.",
  },
  {
    file: 'apps/web/src/reference/pages/[schemaId]/[itemId].page.tsx',
    strings: ['Tech Level', 'Structure Points'],
    reason:
      "Stat labels compared against the dataset's own stat names to pick a band's stats: keys matched against data. What is drawn is the data's label.",
  },
  {
    file: 'apps/web/src/reference/pages/about.page.tsx',
    strings: ['ROACH BOY'],
    reason:
      "A Pilot's callsign in the page's dedication: a proper name, with the five single-word ones beside it.",
  },
  {
    file: 'apps/web/src/reference/pages/api.page.tsx',
    strings: [
      "const response = await fetch('",
      "/chassis.json') const chassis = await response.json() console.log(chassis[0].name) //",
      'Access-Control-Allow-Origin: * Access-Control-Allow-Methods: GET Content-Type: application/json',
      '.json',
      '.schema.json',
    ],
    reason:
      'Code the API page prints as samples: a JavaScript snippet, the response headers, and the `.json` suffixes of the endpoint patterns. Code and HTTP tokens, never translated.',
  },
  {
    file: 'apps/web/src/reference/pages/og-card.page.tsx',
    strings: [
      'html, body { margin: 0; padding: 0; } #og-card { width:',
      'px; height:',
      'px; overflow: hidden; }',
      'noindex, nofollow',
    ],
    reason:
      "The bare OG-card document's inline stylesheet and its robots `<meta>` value: CSS and markup.",
  },
  {
    file: 'apps/web/src/reference/pages/reference.page.tsx',
    strings: ['Core Mechanic', 'Mech Damage', 'Tough Choices'],
    reason:
      "Entities by their names in the reference data (`findIn(…, e.name === name)`): the dataset's keys. Each row's label is the catalogue's.",
  },
  {
    file: 'apps/web/src/components/compositions/searchCopy.ts',
    strings: ['No results found.'],
    reason:
      'The `copy/banned-variant` rule holds this file as the one place these words are spelled (`SEARCH_COPY`, chrome K8) and refuses them anywhere else, the catalogue included. They stay here until that rule names a catalogue key instead.',
  },
  {
    file: 'apps/web/src/components/islands/SearchIsland.tsx',
    strings: ['min(33rem, calc(100dvh - 7rem))'],
    reason: 'A CSS `max-height` value in a style object.',
  },
  {
    file: 'apps/web/src/lib/listingPending.ts',
    strings: [
      'var d=document.documentElement,q=new URLSearchParams(location.search),v=null;',
      '.some(function(k){return q.has(k)})&&v===null)return;',
      'var lift=function(){d.removeAttribute(',
    ],
    reason: "Lines of a listing page's inline script: code a browser runs, never drawn.",
  },
  {
    file: 'apps/web/src/lib/searchIndexBuild.ts',
    strings: ['Crawler Downtime', 'Train your Pilot'],
    reason:
      "A guide and its step by their names in the reference data (`Guides.getByName`): the dataset's keys.",
  },
]

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Whether `text`, a string of `file`, is exempt as written. */
export function isExemptString(file: string, text: string): boolean {
  const shown = squash(text)
  return EXEMPTIONS.some((e) => e.file === file && e.strings.includes(shown))
}
