import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { join } from 'path'

const routesDir = join(import.meta.dir, '..')

/**
 * These tests verify the file structure of lazy route splitting.
 * For each split route, we assert:
 * 1. The original route file exists (config-only, no component)
 * 2. The matching .lazy.tsx file exists (component-only)
 */

describe('lazy route file structure', () => {
  const lazyPairs: Array<{ config: string; lazy: string; label: string }> = [
    {
      config: '_authenticated/games/$gameId/index.tsx',
      lazy: '_authenticated/games/$gameId/index.lazy.tsx',
      label: 'game detail route',
    },
    {
      config: '_authenticated/games/$gameId/create-crawler.tsx',
      lazy: '_authenticated/games/$gameId/create-crawler.lazy.tsx',
      label: 'create crawler route',
    },
    {
      config: '_authenticated/pilots/$pilotId/create-mech.tsx',
      lazy: '_authenticated/pilots/$pilotId/create-mech.lazy.tsx',
      label: 'create mech route',
    },
  ]

  for (const { config, lazy, label } of lazyPairs) {
    test(`${label}: config file exists`, () => {
      expect(existsSync(join(routesDir, config))).toBe(true)
    })

    test(`${label}: lazy file exists`, () => {
      expect(existsSync(join(routesDir, lazy))).toBe(true)
    })
  }
})

describe('lazy route file contents', () => {
  test('game detail config uses createFileRoute (not createLazyFileRoute)', async () => {
    const content = await Bun.file(join(routesDir, '_authenticated/games/$gameId/index.tsx')).text()
    expect(content).toContain('createFileRoute')
    expect(content).not.toContain('createLazyFileRoute')
  })

  test('game detail config does not define the page component inline', async () => {
    const content = await Bun.file(join(routesDir, '_authenticated/games/$gameId/index.tsx')).text()
    // Component should have moved to the .lazy file
    expect(content).not.toContain('function GameShowPage')
  })

  test('game detail config includes pendingComponent', async () => {
    const content = await Bun.file(join(routesDir, '_authenticated/games/$gameId/index.tsx')).text()
    expect(content).toContain('pendingComponent')
  })

  test('game detail lazy file uses createLazyFileRoute', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/games/$gameId/index.lazy.tsx')
    ).text()
    expect(content).toContain('createLazyFileRoute')
    expect(content).not.toContain('createFileRoute(')
  })

  test('game detail lazy file defines GameShowPage component', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/games/$gameId/index.lazy.tsx')
    ).text()
    expect(content).toContain('GameShowPage')
  })

  test('create-crawler config uses createFileRoute (not createLazyFileRoute)', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/games/$gameId/create-crawler.tsx')
    ).text()
    expect(content).toContain('createFileRoute')
    expect(content).not.toContain('createLazyFileRoute')
  })

  test('create-crawler config does not define CreateCrawlerPage inline', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/games/$gameId/create-crawler.tsx')
    ).text()
    expect(content).not.toContain('function CreateCrawlerPage')
  })

  test('create-crawler config includes pendingComponent', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/games/$gameId/create-crawler.tsx')
    ).text()
    expect(content).toContain('pendingComponent')
  })

  test('create-crawler lazy file uses createLazyFileRoute', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/games/$gameId/create-crawler.lazy.tsx')
    ).text()
    expect(content).toContain('createLazyFileRoute')
    expect(content).not.toContain('createFileRoute(')
  })

  test('create-mech config uses createFileRoute (not createLazyFileRoute)', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/pilots/$pilotId/create-mech.tsx')
    ).text()
    expect(content).toContain('createFileRoute')
    expect(content).not.toContain('createLazyFileRoute')
  })

  test('create-mech config does not define CreateMechPage inline', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/pilots/$pilotId/create-mech.tsx')
    ).text()
    expect(content).not.toContain('function CreateMechPage')
  })

  test('create-mech config includes pendingComponent', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/pilots/$pilotId/create-mech.tsx')
    ).text()
    expect(content).toContain('pendingComponent')
  })

  test('create-mech lazy file uses createLazyFileRoute', async () => {
    const content = await Bun.file(
      join(routesDir, '_authenticated/pilots/$pilotId/create-mech.lazy.tsx')
    ).text()
    expect(content).toContain('createLazyFileRoute')
    expect(content).not.toContain('createFileRoute(')
  })
})
