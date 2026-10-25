/**
 * The files the build emits from `astro/pages/**.ts`, read the way Astro reads
 * them: each route's `getStaticPaths`, then its `GET`. A test that needs an
 * endpoint's output reads it here, not from a build.
 */

import { join } from 'node:path'
import type { APIContext } from 'astro'
import { fillPattern } from '../routePath'

type EndpointRoute = {
  getStaticPaths?: () => { params: Record<string, string>; props?: unknown }[]
  GET: (context: APIContext) => Response | Promise<Response>
}

const PAGES = join(import.meta.dir, '../../pages')

async function read(): Promise<Map<string, string>> {
  const outputs = new Map<string, string>()
  for (const file of new Bun.Glob('**/*.ts').scanSync(PAGES)) {
    const route = (await import(join(PAGES, file))) as EndpointRoute
    for (const { params, props } of route.getStaticPaths?.() ?? [{ params: {} }]) {
      const response = await route.GET({ params, props } as unknown as APIContext)
      outputs.set(fillPattern(file.replace(/\.ts$/, ''), params), await response.text())
    }
  }
  return outputs
}

/** Every endpoint output, by its path under `dist`: `schema/chassis.json`. */
export const outputs = await read()

export function emitted(outputPath: string): string {
  const body = outputs.get(outputPath)
  if (body === undefined) throw new Error(`the build emits no ${outputPath}`)
  return body
}
