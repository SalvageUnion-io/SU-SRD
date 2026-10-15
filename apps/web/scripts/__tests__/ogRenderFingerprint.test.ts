import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ogRenderFingerprint } from '../ogRenderFingerprint'

const DATA = new Set(['chassis'])

let dist: string

function write(path: string, body: string): void {
  const file = join(dist, path)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, body)
}

/** A built og-card closure shaped like Rolldown's output, with the given hashes. */
function build(
  hashes: { og: string; search: string; chassis: string; font: string; shared: string },
  bodies: { og?: string; search?: string; chassis?: string; css?: string } = {}
): void {
  rmSync(dist, { recursive: true, force: true })
  write(
    'og-card/index.html',
    `<link rel="stylesheet" href="/assets/styles-${hashes.font}.css"><script type="module" src="/assets/islands-${hashes.og}.js"></script>`
  )
  write(
    `assets/styles-${hashes.font}.css`,
    `${bodies.css ?? 'a{}'}@font-face{src:url(/assets/barlow-${hashes.font}.woff2)}`
  )
  write(`assets/barlow-${hashes.font}.woff2`, 'font')
  write(
    `assets/islands-${hashes.og}.js`,
    `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/SearchIsland-${hashes.search}.js","assets/shared-${hashes.shared}.js"])));` +
      `import{n}from"./shared-${hashes.shared}.js";` +
      `({OgCardIsland:()=>import(\`./OgCardIsland-${hashes.og}.js\`),SearchIsland:()=>import(\`./SearchIsland-${hashes.search}.js\`)},__vite__mapDeps([0,1]))`
  )
  write(`assets/shared-${hashes.shared}.js`, 'export const n=1')
  write(
    `assets/OgCardIsland-${hashes.og}.js`,
    `${bodies.og ?? 'card()'};import(\`./chassis-${hashes.chassis}.js\`);fetch("/logos/mark.svg")`
  )
  write('logos/mark.svg', '<svg/>')
  write(`assets/SearchIsland-${hashes.search}.js`, bodies.search ?? 'search()')
  write(
    `assets/chassis-${hashes.chassis}.js`,
    `var e=[{name:\`${bodies.chassis ?? 'Mule'}\`}];export{e as default};`
  )
}

const BASE = {
  og: 'AAAAAAAA',
  search: 'BBBBBBBB',
  chassis: 'CCCCCCCC',
  font: 'DDDDDDDD',
  shared: 'EEEEEEEE',
}

describe('ogRenderFingerprint', () => {
  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'og-fp-'))
  })
  afterEach(() => {
    rmSync(dist, { recursive: true, force: true })
  })

  const fingerprint = () => ogRenderFingerprint(dist, DATA)

  it('ignores another island, the game data and the hashes in file names', () => {
    build(BASE)
    const before = fingerprint()
    build(
      { ...BASE, search: 'ZZZZZZZZ', chassis: 'YYYYYYYY' },
      { search: 'search(2)', chassis: 'Mulee' }
    )
    expect(fingerprint()).toBe(before)
  })

  it('changes with the card island, the stylesheet, a font or a public asset', () => {
    build(BASE)
    const before = fingerprint()
    build(BASE, { og: 'card(2)' })
    expect(fingerprint()).not.toBe(before)
    build(BASE, { css: 'b{}' })
    expect(fingerprint()).not.toBe(before)
    build(BASE)
    write(`assets/barlow-${BASE.font}.woff2`, 'font2')
    expect(fingerprint()).not.toBe(before)
    build(BASE)
    write('logos/mark.svg', '<svg id="2"/>')
    expect(fingerprint()).not.toBe(before)
  })

  it('follows a shared chunk the islands entry imports statically', () => {
    build(BASE)
    const before = fingerprint()
    write(`assets/shared-${BASE.shared}.js`, 'export const n=2')
    expect(fingerprint()).not.toBe(before)
  })

  it('hashes a chunk named like data that carries code', () => {
    build(BASE)
    const before = fingerprint()
    write(
      `assets/chassis-${BASE.chassis}.js`,
      `import{n}from"./shared-${BASE.shared}.js";var e=[n];export{e as default};`
    )
    expect(fingerprint()).not.toBe(before)
  })

  it('throws when the og-card page was not built', () => {
    expect(fingerprint).toThrow()
  })
})
