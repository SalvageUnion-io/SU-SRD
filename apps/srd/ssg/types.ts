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

/** What a page returns: its head metadata and its body tree. */
export type PageResult = { meta: DocumentMeta; children: ReactNode }

export type RouteContext<Params, Props> = {
  params: Params
  props: Props
  /** Full URL of the page being rendered, e.g. https://salvageunion.io/about/ */
  url: URL
  /** Pathname with a trailing slash, e.g. /schema/chassis/item/aegis/ */
  pathname: string
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
