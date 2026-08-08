/**
 * URL -> dist file.
 *
 * The one rule the whole emit rests on: a page written to the wrong path is a
 * 404 in production. These are the unit cases; `ssg/snapshot.ts` catches the
 * same class over the real build as a file-set difference. The table in
 * `ssg/DESIGN.md` is the spec; these are its cases.
 *
 * Three separate seams meet here, which is why they are tested together:
 *
 *   `outputPathFor`    HTML routes    /about   -> about/index.html
 *   `fillPattern`      dynamic params /schema/[schemaId] + {schemaId} -> /schema/chassis
 *   `registerEndpoint` non-HTML       schema/[schemaId].json -> schema/chassis.json (a FILE)
 */

import { describe, expect, it } from 'bun:test'
import type { ResolvedEndpoint } from '../endpoints'
import { endpoints, registerEndpoint } from '../endpoints'
import { outputPathFor } from '../outputPath'
import { fillPattern, withTrailingSlash } from '../render'
import type { EndpointModule } from '../types'

/** The single output an endpoint module was expected to resolve to. */
function onlyOutput(outputs: ResolvedEndpoint[]): ResolvedEndpoint {
  const [output] = outputs
  if (outputs.length !== 1 || !output) {
    throw new Error(`expected exactly 1 endpoint output, got ${outputs.length}`)
  }
  return output
}

describe('outputPathFor', () => {
  it('maps the site root to index.html', () => {
    expect(outputPathFor('/')).toBe('index.html')
  })

  it('maps /404 to 404.html, NOT to a directory', () => {
    // Netlify serves `404.html` for unmatched paths; `404/index.html` would
    // never be reached. Astro special-cases this and so must we.
    expect(outputPathFor('/404')).toBe('404.html')
  })

  it('maps every other route to <route>/index.html', () => {
    expect(outputPathFor('/about')).toBe('about/index.html')
    expect(outputPathFor('/bot/privacy')).toBe('bot/privacy/index.html')
    expect(outputPathFor('/schema/chassis')).toBe('schema/chassis/index.html')
    expect(outputPathFor('/schema/chassis/item/aegis')).toBe('schema/chassis/item/aegis/index.html')
    expect(outputPathFor('/schema/chassis/item/aegis/pattern/scrapper')).toBe(
      'schema/chassis/item/aegis/pattern/scrapper/index.html'
    )
  })

  it('emits a dist-relative path — never leading or doubled slashes', () => {
    // `join(distDir, …)` in build.ts would resolve a leading slash to the
    // filesystem root, so this is load-bearing, not cosmetic.
    expect(outputPathFor('/about/')).toBe('about/index.html')
    expect(outputPathFor('//about//')).toBe('about/index.html')
    for (const route of ['/', '/404', '/about', '/schema/chassis']) {
      expect(outputPathFor(route).startsWith('/')).toBe(false)
    }
  })
})

describe('fillPattern', () => {
  it('substitutes every [param] in the pattern', () => {
    expect(fillPattern('/schema/[schemaId]', { schemaId: 'chassis' })).toBe('/schema/chassis')
    expect(
      fillPattern('/schema/[schemaId]/item/[itemId]', { schemaId: 'chassis', itemId: 'aegis' })
    ).toBe('/schema/chassis/item/aegis')
    expect(
      fillPattern('/schema/[schemaId]/item/[itemId]/pattern/[patternId]', {
        schemaId: 'chassis',
        itemId: 'aegis',
        patternId: 'scrapper',
      })
    ).toBe('/schema/chassis/item/aegis/pattern/scrapper')
  })

  it('leaves a pattern with no params alone', () => {
    expect(fillPattern('/about', {})).toBe('/about')
  })

  it('throws on a missing param rather than emitting a literal [bracket] path', () => {
    expect(() => fillPattern('/schema/[schemaId]', {})).toThrow(
      'Missing parameter "schemaId" for pattern "/schema/[schemaId]"'
    )
  })

  it('composes with outputPathFor to give the dist file for a dynamic route', () => {
    const route = fillPattern('/schema/[schemaId]/item/[itemId]', {
      schemaId: 'chassis',
      itemId: 'aegis',
    })
    expect(outputPathFor(route)).toBe('schema/chassis/item/aegis/index.html')
    // …and the canonical URL for that same route keeps its trailing slash.
    expect(withTrailingSlash(route)).toBe('/schema/chassis/item/aegis/')
  })
})

describe('endpoint output paths are files, not directories', () => {
  it('writes a dotted pattern verbatim', () => {
    const module: EndpointModule<{ schemaId: string }, undefined> = {
      pattern: 'schema/[schemaId].json',
      getStaticPaths: () => [{ params: { schemaId: 'chassis' }, props: undefined }],
      contentType: 'application/json',
      body: () => '{}',
    }

    const resolved = onlyOutput(registerEndpoint(module).resolve())
    expect(resolved.outputPath).toBe('schema/chassis.json')
    // The distinction the whole endpoint registry exists for.
    expect(resolved.outputPath).not.toContain('index.html')
    expect(resolved.outputPath.endsWith('/')).toBe(false)
  })

  it('gives an endpoint a slash-free pathname, so its URL is a file too', () => {
    const module: EndpointModule<Record<string, string>, undefined> = {
      pattern: 'llms.txt',
      contentType: 'text/plain',
      body: (ctx) => ctx.pathname,
    }

    const resolved = onlyOutput(registerEndpoint(module).resolve())
    expect(resolved.outputPath).toBe('llms.txt')
    expect(resolved.body()).toBe('/llms.txt')
  })

  it('the real registry emits only files', () => {
    const paths = endpoints.flatMap((registration) =>
      registration.resolve().map((resolved) => resolved.outputPath)
    )

    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(path).not.toContain('index.html')
      expect(path.startsWith('/')).toBe(false)
      expect(path.endsWith('/')).toBe(false)
      expect(path).toMatch(/\.(json|txt)$/)
    }

    // The four dotted shapes, named so a pattern regression is a readable diff.
    expect(paths).toContain('llms.txt')
    expect(paths).toContain('search-index.json')
    expect(paths).toContain('schema/chassis.json')
    expect(paths).toContain('schema/chassis.schema.json')
    expect(paths.some((path) => /^schema\/chassis\/item\/[^/]+\.json$/.test(path))).toBe(true)
  })
})
