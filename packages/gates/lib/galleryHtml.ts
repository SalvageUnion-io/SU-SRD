/**
 * The PR gallery's page (`tools/gallery.ts` writes it beside the shots): one
 * section per `GALLERY_SECTIONS` entry, each page a desktop shot with its
 * phone shot inset, then every page's link preview (og:image, og:title,
 * og:description) the way a chat client lays it out. Pure, so it is tested
 * without a browser.
 */

import type { GallerySection } from './galleryPages'
import { pageSlug } from './galleryPages'

export type OgMeta = { title?: string; description?: string; image?: boolean }

export type GalleryRun = {
  sha: string
  pr?: number
  /** The base URL each site was shot from, for the "open" links. */
  bases: { srd: string; itun?: string }
  /** Whether a site's pages link out (a CI build on localhost does not). */
  linkable: boolean
  capturedAt: string
}

export type GalleryResult = {
  sections: readonly GallerySection[]
  /** Page slugs that have both shots. */
  shot: ReadonlySet<string>
  og: ReadonlyMap<string, OgMeta>
  failures: readonly string[]
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
:root { --paper: #fbfaf7; --ground: #efebe4; --ink: #282019; --ink-2: #5b5044; --rust: #a85222; --bad: #b0432b; --pilot: #ef894f; --mech: #7a978a; --crawler: #b84a86; --denizen: #2f4a66; --rules: #8fc2d8; --band-ink: #282019;
  --f-display: 'Barlow Semi Condensed', 'Arial Narrow', system-ui, sans-serif; --f-body: 'Barlow', system-ui, -apple-system, sans-serif; }
@media (prefers-color-scheme: dark) { :root { --paper: #241d17; --ground: #1b1712; --ink: #f1ece3; --ink-2: #c4b9aa; --rust: #e07b43; --band-ink: #0f0c09; color-scheme: dark; } }
* { box-sizing: border-box; }
body { background: var(--ground); color: var(--ink); font-family: var(--f-body); line-height: 1.5; margin: 0; padding: 0 16px 3rem; }
.mast { background: var(--band-ink); margin-inline: -16px; padding: 1.75rem 16px 0; }
.mast__in { max-width: 80rem; margin-inline: auto; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem 2rem; }
.mast h1 { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--f-display); font-weight: 800; text-transform: uppercase; font-size: clamp(1.75rem, 5vw, 3rem); line-height: 1; padding: 0.75rem 1.2rem 0.5rem; }
.mast__meta { color: #f1ece3; font-size: 0.9375rem; padding-bottom: 0.8rem; margin: 0; max-width: 34rem; }
.mast__meta a { color: #f1ece3; }
main { max-width: 80rem; margin-inline: auto; display: flex; flex-direction: column; gap: 2.25rem; padding-top: 1.5rem; }
.jump { display: flex; flex-wrap: wrap; gap: 0.5rem; list-style: none; margin: 0; padding: 0; }
.jump a { display: inline-flex; align-items: center; min-height: 36px; padding: 0.2rem 0.7rem; border: 1.5px solid var(--ink); border-radius: 2px; background: var(--paper); color: var(--ink); text-decoration: none; font-family: var(--f-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.875rem; }
section { display: flex; flex-direction: column; scroll-margin-top: 1rem; }
.band { height: 8px; border: 1.5px solid var(--ink); border-bottom: 0; }
h2 { margin: 0; border-top: 1.5px solid var(--ink); padding: 0.35rem 0 0.2rem; font-family: var(--f-display); font-weight: 800; text-transform: uppercase; font-size: 1.625rem; display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
h2 small { font-family: var(--f-body); font-weight: 500; font-size: 0.875rem; color: var(--ink-2); text-transform: none; }
section > p { margin: 0 0 0.9rem; color: var(--ink-2); max-width: 48rem; }
.shots, .ogs { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr)); }
.shot, .og { background: var(--paper); border: 1.5px solid var(--ink); border-radius: 3px; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.shot__frames { position: relative; display: block; background: var(--ink); aspect-ratio: 1440 / 900; overflow: hidden; }
.shot__desk { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.shot__phone { position: absolute; right: 0.6rem; bottom: 0.6rem; width: 22%; aspect-ratio: 390 / 844; height: auto; object-fit: cover; object-position: top; border: 2px solid var(--ink); border-radius: 6px; box-shadow: 0 0 0 2px var(--paper); background: var(--paper); }
.shot__text, .og__text { padding: 0.6rem 0.8rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.shot__name { font-family: var(--f-display); font-weight: 800; font-size: 1.2rem; text-transform: uppercase; color: var(--ink); text-decoration: none; line-height: 1.1; }
.shot__path, .og__site { font-size: 0.8125rem; color: var(--ink-2); overflow-wrap: anywhere; }
.shot p { margin: 0; font-size: 0.9375rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip { font-family: var(--f-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.75rem; line-height: 1; padding: 0.22rem 0.4rem; background: var(--ink); color: var(--paper); border-radius: 2px; }
.og { border-left: 4px solid var(--ink-2); }
.og__img { display: block; aspect-ratio: 1200 / 630; background: var(--ground); }
.og__img img { display: block; width: 100%; height: 100%; object-fit: cover; }
.og__none { display: grid; place-items: center; height: 100%; color: var(--ink-2); font-size: 0.875rem; }
.fail { border: 1.5px solid var(--bad); background: var(--paper); padding: 0.75rem 1rem; }
.foot { color: var(--ink-2); font-size: 0.875rem; border-top: 1.5px solid var(--ink); padding-top: 0.75rem; }
.foot a { color: var(--ink); }
`

function card(page: GallerySection['pages'][number], run: GalleryRun): string {
  const s = pageSlug(page)
  const base = page.site === 'srd' ? run.bases.srd : run.bases.itun
  const href = run.linkable && base && !page.signedIn ? `${base}${page.path}` : undefined
  const frames = `<img class="shot__desk" src="shots/${s}-desk.jpg" alt="${escapeHtml(page.name)} at desktop width" loading="lazy" width="1440" height="900">
    <img class="shot__phone" src="shots/${s}-phone.jpg" alt="${escapeHtml(page.name)} at phone width" loading="lazy" width="390" height="844">`
  const chips = [...(page.chips ?? []), ...(page.signedIn ? ['Signed in'] : [])]
  return `<li class="shot">
  ${href ? `<a class="shot__frames" href="${escapeHtml(href)}">${frames}</a>` : `<div class="shot__frames">${frames}</div>`}
  <div class="shot__text">
    <span class="shot__name">${escapeHtml(page.name)}</span>
    <span class="shot__path">${escapeHtml(page.site === 'itun' ? `ITUN ${page.path}` : page.path)}</span>
    <p>${escapeHtml(page.note)}</p>
    <span class="chips">${chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</span>
  </div>
</li>`
}

function ogCard(page: GallerySection['pages'][number], og: OgMeta | undefined): string {
  const s = pageSlug(page)
  return `<li class="og">
  <span class="og__img">${
    og?.image
      ? `<img src="shots/${s}-og.png" alt="Link preview for ${escapeHtml(page.name)}" loading="lazy" width="1200" height="630">`
      : '<span class="og__none">No og:image</span>'
  }</span>
  <div class="og__text">
    <span class="og__site">${page.site === 'srd' ? 'salvageunion.io' : 'salvageunion.io/build'}${escapeHtml(page.path)}</span>
    <strong>${escapeHtml(og?.title ?? page.name)}</strong>
    <span>${escapeHtml(og?.description ?? '')}</span>
  </div>
</li>`
}

/** The gallery page for one run. */
export function renderGallery(result: GalleryResult, run: GalleryRun): string {
  const sections = result.sections
    .map((section) => ({
      ...section,
      pages: section.pages.filter((p) => result.shot.has(pageSlug(p))),
    }))
    .filter((section) => section.pages.length > 0)
  const total = sections.reduce((n, s) => n + s.pages.length, 0)
  const ogPages = sections.flatMap((s) => s.pages).filter((p) => !p.signedIn)
  const title = run.pr ? `PR #${run.pr} gallery` : 'Gallery'
  const failures = result.failures.length
    ? `<section class="fail" aria-label="Not captured"><strong>${result.failures.length} not captured</strong><ul>${result.failures
        .map((f) => `<li>${escapeHtml(f)}</li>`)
        .join('')}</ul></section>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&display=swap">
<style>${CSS}</style>
</head>
<body>
<header class="mast"><div class="mast__in">
  <h1>${escapeHtml(title)}</h1>
  <p class="mast__meta">Captured ${escapeHtml(run.capturedAt)} from ${escapeHtml(run.sha.slice(0, 7))}${
    run.pr
      ? ` · <a href="https://github.com/SalvageUnion-io/SU-SRD/pull/${run.pr}">PR #${run.pr}</a>`
      : ''
  }. Desktop 1440×900 with the phone (390×844) inset.</p>
</div></header>
<main>
  ${failures}
  <ul class="jump" aria-label="Sections">${sections
    .map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`)
    .join('')}<li><a href="#og">Link previews</a></li></ul>
  ${sections
    .map(
      (s) => `<section id="${s.id}" aria-labelledby="h-${s.id}">
    <div class="band" style="background:${s.tone}"></div>
    <h2 id="h-${s.id}">${escapeHtml(s.title)} <small>${s.pages.length} ${s.pages.length === 1 ? 'page' : 'pages'}</small></h2>
    <p>${escapeHtml(s.intro)}</p>
    <ul class="shots">${s.pages.map((p) => card(p, run)).join('\n')}</ul>
  </section>`
    )
    .join('\n')}
  <section id="og" aria-labelledby="h-og">
    <div class="band" style="background:var(--ink)"></div>
    <h2 id="h-og">Link previews <small>${ogPages.length} pages</small></h2>
    <p>What each page unfurls as in a chat client: its og:image (1200 × 630), og:title and og:description.</p>
    <ul class="ogs">${ogPages.map((p) => ogCard(p, result.og.get(pageSlug(p)))).join('\n')}</ul>
  </section>
  <p class="foot">${total} pages. Salvage Union is copyrighted by Leyline Press; Workshop Manual images are used with special permission from Leyline Press.</p>
</main>
</body>
</html>
`
}
