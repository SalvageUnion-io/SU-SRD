/**
 * `/p/$kind/$appId`: what the page shows before, and instead of, a public sheet.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { PublicSheetView } from '../../build/sheet/PublicSheetView'
import { npcFixture } from '../../components/__tests__/fixtures'
import { answerRoutes, routeAsks, withWorkerRoutes } from '../../lib/sharing/__tests__/workerRoutes'
import { sharedPaths } from '../../lib/sharing/paths'

withWorkerRoutes()

describe('the public sheet route', () => {
  test('a sheet that is not public says so', () => {
    answerRoutes({ [sharedPaths.sheet('pilot', 'anything')]: null })
    render(<PublicSheetView kind="pilot" appId="anything" />)
    // `getByText` throws when absent, so this asserts presence twice over.
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
  })

  test('a built NPC shared by link is its own read-only page, credited to its maker', () => {
    answerRoutes({
      [sharedPaths.sheet('npc', 'npc-1')]: {
        kind: 'npc',
        appId: 'npc-1',
        body: npcFixture({ id: 'npc-1', name: 'Old Mags' }),
        madeBy: 'Rosa',
        links: [],
        linked: [],
        withheld: [],
      },
    })
    render(<PublicSheetView kind="npc" appId="npc-1" />)
    expect(screen.getAllByText('Old Mags').length).toBeGreaterThan(0)
    expect(screen.getByText('Rosa')).toBeTruthy() // MADE BY | Rosa, on the band
    expect(screen.getByText(/a shared NPC, read-only/i)).toBeTruthy()
    // Read-only: no Share, no Delete.
    expect(screen.queryByRole('button', { name: /share old mags/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete old mags/i })).toBeNull()
  })

  test('a private NPC is not available, as any private thing is', () => {
    answerRoutes({ [sharedPaths.sheet('npc', 'npc-1')]: null })
    render(<PublicSheetView kind="npc" appId="npc-1" />)
    expect(screen.getByText(/this NPC isn['’]t available/i)).toBeTruthy()
  })

  test('an unknown kind gets the same page, not a server round trip', () => {
    answerRoutes({})
    render(<PublicSheetView kind="dropship" appId="anything" />)
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
    expect(routeAsks).toEqual([])
  })

  test('an old full-id link settles on the name-and-short-id address', () => {
    const id = '0a1b2c3d-4e5f-4789-abcd-ef0123456789'
    answerRoutes({
      [sharedPaths.sheet('npc', id)]: {
        kind: 'npc',
        appId: id,
        body: npcFixture({ id, name: 'Old Mags' }),
        madeBy: 'Rosa',
        links: [],
        linked: [],
        withheld: [],
      },
    })
    const settled: string[] = []
    render(<PublicSheetView kind="npc" appId={id} onAddress={(s) => settled.push(s)} />)
    expect(settled).toEqual(['old-mags-0a1b2c3d4e5f'])
  })

  test('a link already at its address is left alone', () => {
    const id = '0a1b2c3d-4e5f-4789-abcd-ef0123456789'
    answerRoutes({
      [sharedPaths.sheet('npc', 'old-mags-0a1b2c3d4e5f')]: {
        kind: 'npc',
        appId: id,
        body: npcFixture({ id, name: 'Old Mags' }),
        madeBy: 'Rosa',
        links: [],
        linked: [],
        withheld: [],
      },
    })
    const settled: string[] = []
    render(
      <PublicSheetView
        kind="npc"
        appId="old-mags-0a1b2c3d4e5f"
        onAddress={(s) => settled.push(s)}
      />
    )
    expect(settled).toEqual([])
  })
})
