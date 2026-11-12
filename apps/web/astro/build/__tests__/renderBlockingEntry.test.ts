import { describe, expect, it } from 'bun:test'
import { blockRenderOnEntry, entryOf, fitsBeforePaint, staticImports } from '../renderBlockingEntry'

const ENTRY = '/assets/Page.astro_astro_type_script_index_0_lang-CYMtF3nq.js'
const TAG = `<script type="module" src="${ENTRY}"></script>`
const BAND =
  '<div class="su-chapter-band" data-chip-overflow-owner="" data-layout="bleed" data-aside="controls">'

describe('renderBlockingEntry', () => {
  it('reads the static imports of a built chunk, once each', () => {
    const chunk =
      'import{i as e,t}from"./chipFit-Bf8SPeVh.js";import{n}from"./accountHint-CQx6MMZk.js";' +
      'import"./side-1.js";import{t as l}from"./chipFit-Bf8SPeVh.js";' +
      'void import("./guideContents-CbKxzAHu.js")'
    expect(staticImports(chunk)).toEqual([
      './chipFit-Bf8SPeVh.js',
      './accountHint-CQx6MMZk.js',
      './side-1.js',
    ])
  })

  it('finds the page script only in the head', () => {
    expect(entryOf(`<html><head>${TAG}</head><body></body></html>`)).toBe(ENTRY)
    expect(entryOf(`<html><head></head><body>${TAG}</body></html>`)).toBeUndefined()
  })

  it('marks the head entry render-blocking, its imports preloaded before it', () => {
    const html = `<html><head><title>x</title>${TAG}</head><body>${BAND}</div>${TAG}</body></html>`
    expect(blockRenderOnEntry(html, ['/assets/a.js', '/assets/b.js'])).toBe(
      '<html><head><title>x</title>' +
        '<link rel="modulepreload" href="/assets/a.js"><link rel="modulepreload" href="/assets/b.js">' +
        `<script type="module" blocking="render" src="${ENTRY}"></script>` +
        `</head><body>${BAND}</div>${TAG}</body></html>`
    )
  })

  it('leaves a page with no head entry as it is', () => {
    const html = `<html><head></head><body>${BAND}</div></body></html>`
    expect(blockRenderOnEntry(html, ['/assets/a.js'])).toBe(html)
  })

  it('leaves a page with no controls band painting at once', () => {
    const entity = `<html><head>${TAG}</head><body><div class="su-chapter-band" data-chip-overflow-owner="" data-layout="bleed"></div></body></html>`
    expect(fitsBeforePaint(entity)).toBe(false)
    expect(blockRenderOnEntry(entity, ['/assets/a.js'])).toBe(entity)
  })
})
