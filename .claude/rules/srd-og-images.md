---
paths:
  - 'apps/srd/scripts/og*'
  - 'apps/srd/src/lib/ogCard.ts'
  - 'apps/srd/src/components/islands/OgCardIsland.tsx'
  - 'packages/component-lib/src/components/compositions/OgCard*'
  - 'packages/component-lib/src/components/compositions/ogCardText.ts'
  - 'packages/component-lib/src/components/atoms/ChapterBand*'
---

# srd social preview images (og:image)

Each entity page's `og:image` is its **link preview card**, `OgCard` from
component-lib: the chapter band with speckle, the notched title,
the stat boxes and the Union bar's foot, the same parts the pages are built
from, so the preview cannot drift from the page. A reference thing (chassis,
system, equipment) takes its tone, stats and page cite; a thing you do (ability,
action) the ink band, tier numeral, cost pennant and rules. `ogCardForEntity`
builds the card from the entity, and `apps/srd/src/lib/ogCard.ts` (`ogCardFor`,
`ogMetaFor`, `ogImagePath`) is the one place the island, the generator and the
pages agree on it. `apps/srd/scripts/og-screenshots.ts` screenshots it at
1200×630 into `dist/schema/{schemaId}/item/{itemId}.og.png`.

- The page's other preview tags come from the same card: `og:title` is the
  name, `og:description` the kicker and cite (never the body), and
  `theme-color` the band's tone (`DocumentMeta.ogTitle` / `ogDescription` /
  `themeColor`); `<title>` and the meta description still serve search.
- Run it with `bun --filter srd og:generate` (chromium via `og:install-browser`).
  It is **opt-in** — a plain `bun run build` never renders images, so CI stays fast.
- The build always emits the _default_ og:image; the script then rewrites the meta
  only for pages whose PNG actually landed. Generation being skipped, capped by
  `OG_SCREENSHOTS_BUDGET_MS`, or failing outright therefore degrades to the
  default banner and **never fails the build**.
- There is no version to bump. Each cached PNG is keyed on its entity's JSON
  and the render key: `apps/srd/scripts/ogRenderFingerprint.ts` hashes the built
  bytes that draw the card (the og-card page, its CSS and fonts, the
  `OgCardIsland` chunk graph; never the data chunks or other islands), plus the
  script and the Playwright and sharp versions. A rendering change re-renders
  every card; an unrelated commit restores them all. The deploy's `og-srd` job
  (`.github/actions/srd-og`) persists the cache under the same key
  (`og-screenshots.ts --fingerprint`).
- **Patterns** (a chassis's, a Bio-Titan's) get their own card at
  `…/item/{itemId}/pattern/{patternId}.og.png` rather than inheriting the
  host's image.
