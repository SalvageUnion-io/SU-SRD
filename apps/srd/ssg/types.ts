import type { ReactNode } from 'react'

/** A JSON-LD object. */
export type StructuredData = Record<string, unknown>

export type BreadcrumbItem = { name: string; url: string }

/** Everything BaseLayout needs to build <head>. Mirrors BaseLayout.astro's Props. */
export type DocumentMeta = {
  title?: string
  description?: string
  canonical?: string
  ogType?: string
  ogImage?: string
  ogImageAlt?: string
  structuredData?: StructuredData
  additionalStructuredData?: StructuredData[]
  noindex?: boolean
  preloadImage?: string
  breadcrumbs?: BreadcrumbItem[]
  breadcrumbDescription?: string
}

/**
 * Which document shell wraps a page's `children`.
 *
 * - `'base'` (the default): `children` is the `<main>` content and `BaseLayout`
 *   builds `<html>`, `<head>` and the site chrome around it from `meta`.
 * - `'bare'`: `children` **is** the whole `<html>` document and `meta` is
 *   ignored — the page owns its own `<head>`. `og-card` is written this way and
 *   must stay that way: routing it through `BaseLayout` would add a `<main>`, a
 *   canonical link and the whole og/twitter block that this page must not emit.
 *   `ssg/snapshot.ts` catches every one of those (the canonical and `<main>`
 *   digest would flip from `null`), as does `ssg/__tests__/render.test.tsx`.
 *
 * A bare page is still a full member of the island system: the built asset tags
 * and the island-props script are injected into the rendered string either way,
 * and the island-collection window is open around the render. That is the whole
 * difference from `registerDocument` in `ssg/render.tsx`, which renders a
 * standalone document with NO assets and NO island support — right for a page
 * that ships neither (greembeem), wrong for one whose entire purpose is to mount
 * an island against the site stylesheet (og-card).
 */
export type DocumentShell = 'base' | 'bare'

/** What a page returns: its head metadata and its body tree. */
export type PageResult = { meta: DocumentMeta; children: ReactNode; shell?: DocumentShell }

/**
 * Content-hashed URLs of the static assets Vite emitted, keyed by each asset's
 * source path relative to the Vite root (`src/assets/eldridge-coast-map.webp` ->
 * `/assets/eldridge-coast-map-Bx1.webp`).
 *
 * This is the replacement for `astro:assets`. Astro's `<Image>` both emitted a
 * file and handed the page its URL; here those halves are split, because the SSR
 * pass runs under Bun and never goes through Vite. `src/runtime/assets.entry.ts`
 * (a client-bundle entry) imports the asset so Vite emits it; `ssg/build.ts`
 * reads the emitted URL out of `dist/.vite/manifest.json` and passes it down
 * here. Look one up with `builtAssetUrl()` from `src/lib/builtAssets.ts` rather
 * than indexing the record, so a missing asset throws instead of rendering an
 * empty `src`.
 *
 * Empty for surfaces that get no build assets at all — endpoints, and the
 * standalone `registerDocument` pages.
 */
export type BuiltAssets = Readonly<Record<string, string>>

export type RouteContext<Params, Props> = {
  params: Params
  props: Props
  /** Full URL of the page being rendered, e.g. https://salvageunion.io/about/ */
  url: URL
  /** Pathname with a trailing slash, e.g. /schema/chassis/item/aegis/ */
  pathname: string
  /** Emitted URLs of assets from `src/assets/`. See `BuiltAssets`. */
  builtAssets: BuiltAssets
}

export type StaticPath<Params, Props> = { params: Params; props: Props }

export type PageModule<Params = Record<string, string>, Props = unknown> = {
  /** Astro-style pattern, e.g. '/schema/[schemaId]/item/[itemId]' */
  pattern: string
  /** Omit for a single fixed route. */
  getStaticPaths?: () => StaticPath<Params, Props>[]
  page: (ctx: RouteContext<Params, Props>) => PageResult
}

/**
 * A non-HTML build output.
 *
 * @public — part of the SSG contract in `ssg/DESIGN.md`. Its consumer,
 * `ssg/endpoints.ts` (llms.txt, search-index.json, schema/[schemaId].json),
 * lands in a later phase of the migration; the type ships with the contract,
 * not with the first implementation of it.
 */
export type EndpointModule<Params = Record<string, string>, Props = unknown> = {
  /** Concrete output path relative to dist, may contain [params]. */
  pattern: string
  getStaticPaths?: () => StaticPath<Params, Props>[]
  contentType: string
  body: (ctx: RouteContext<Params, Props>) => string
}
