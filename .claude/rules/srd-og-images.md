---
paths:
  - 'apps/web/scripts/og*'
  - 'apps/web/src/lib/ogCard.ts'
  - 'apps/web/src/components/islands/OgCardIsland.tsx'
  - 'apps/web/src/components/compositions/OgCard*'
  - 'apps/web/src/components/compositions/ogCardText.ts'
  - 'apps/web/src/components/atoms/ChapterBand*'
---

# srd social preview images (og:image)

- Each entity page's `og:image` is `OgCard`, built from the page's own parts
  by `ogCardForEntity`; `apps/web/src/lib/ogCard.ts` (`ogCardFor`, `ogMetaFor`,
  `ogImagePath`) is where the island, generator and pages agree.
  `apps/web/scripts/og-screenshots.ts` shoots it at 1200×630 to
  `dist/{schemaId}/{itemId}.og.png`; patterns get their own at
  `/{schemaId}/{itemId}/pattern/{patternId}.og.png`.
- `og:title` is the name, `og:description` the kind and cite (never the body),
  `theme-color` the band's tone.
- Opt-in: `bun --filter web og:generate` (chromium via `og:install-browser`);
  a plain build never renders images. The default image is
  `public/og-image.png` (`BrandCard` at `/og-card?brand`), and a skipped,
  capped or failed render falls back to it, **never failing the build**.
- No version to bump: each PNG is cached on its entity's JSON plus
  `apps/web/scripts/ogRenderFingerprint.ts`'s hash of what draws the card.
