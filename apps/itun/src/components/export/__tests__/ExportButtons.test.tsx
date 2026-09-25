/**
 * The three backup controls, as a player drives them.
 *
 * Export is load-bearing under ADR-034: for somebody who will not make an
 * account it is the ONLY way to keep what they built, so these run on the
 * default anonymous (in-memory) backend — the one those players are on. The
 * bundle logic itself is covered in `lib/export/__tests__`; what is pinned here
 * is what the buttons add: the filename, the callback that must fire only after
 * a download really happened, and the error a failure leaves on screen.
 *
 * No `mock.module`: the download is observed by intercepting the two browser
 * calls `downloadJson` makes, restored after every test.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import type { ExportBundle } from '../../../lib/schemas/exportBundle'
import { useEntityStore } from '../../../stores/entityStore'
import { FIXTURE_NOW, pilotFixture } from '../../__tests__/fixtures'
import { ExportAllButton } from '../ExportAllButton'
import { ExportEntityButton } from '../ExportEntityButton'
import { ImportButton } from '../ImportButton'

type Download = { filename: string; blob: Blob }
let downloads: Download[] = []
let lastBlob: Blob | null = null
let failCreate = false

const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL
const realClick = HTMLAnchorElement.prototype.click

beforeEach(async () => {
  downloads = []
  lastBlob = null
  failCreate = false
  URL.createObjectURL = (blob: Blob) => {
    if (failCreate) throw new Error('Disk full')
    lastBlob = blob
    return 'blob:test'
  }
  URL.revokeObjectURL = () => {}
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    if (lastBlob !== null) downloads.push({ filename: this.download, blob: lastBlob })
  }

  _resetDbSingleton()
  await _clearAllStores()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
})

afterEach(() => {
  URL.createObjectURL = realCreate
  URL.revokeObjectURL = realRevoke
  HTMLAnchorElement.prototype.click = realClick
})

async function downloaded(index = 0): Promise<ExportBundle> {
  const d = downloads[index]
  if (d === undefined) throw new Error('nothing was downloaded')
  return JSON.parse(await d.blob.text()) as ExportBundle
}

describe('ExportAllButton', () => {
  test('downloads everything in the store as one dated backup', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'p1', name: 'Rook' }))
    render(<ExportAllButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Download all' }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0]?.filename).toMatch(/^itun-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect((await downloaded()).entities.pilots.map((p) => p.name)).toEqual(['Rook'])
  })

  test('onExported fires after a real download, and never after a failed one', async () => {
    let exported = 0
    failCreate = true
    render(<ExportAllButton onExported={() => exported++} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download all' }))

    // "We offered" is not "they have a copy": a failure must not count.
    await waitFor(() => expect(screen.getByText('Disk full')).toBeTruthy())
    expect(exported).toBe(0)

    failCreate = false
    fireEvent.click(screen.getByRole('button', { name: 'Download all' }))
    await waitFor(() => expect(exported).toBe(1))
    // The retry clears the stale error rather than leaving it beside a success.
    expect(screen.queryByText('Disk full')).toBeNull()
  })
})

describe('ExportEntityButton', () => {
  test('exports only the one entity, under a filename safe for any OS', async () => {
    const store = useEntityStore.getState()
    await store.adopt('pilot', pilotFixture({ id: 'p1', name: 'Rook "The Kid" O’Hara' }))
    await store.adopt('pilot', pilotFixture({ id: 'p2', name: 'Someone else' }))
    render(<ExportEntityButton type="pilot" id="p1" name='Rook "The Kid" O’Hara' />)

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0]?.filename).toBe('itun-pilot-rook-the-kid-o-hara.json')
    expect((await downloaded()).entities.pilots.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('ImportButton', () => {
  function choose(text: string): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([text], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
  }

  test('a valid backup lands in the store and says what it created', async () => {
    const bundle: ExportBundle = {
      schemaVersion: 2,
      exportedAt: FIXTURE_NOW,
      entities: {
        pilots: [pilotFixture({ id: 'from-file', name: 'Imported' })],
        mechs: [],
        crawlers: [],
      },
      workspaces: [],
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }
    render(<ImportButton />)

    choose(JSON.stringify(bundle))

    await waitFor(() => expect(screen.getByText(/Imported: 1 pilot\(s\)/)).toBeTruthy())
    // A copy earns a new id (see apps/itun/CLAUDE.md), so match on the name.
    expect(
      useEntityStore
        .getState()
        .list('pilot')
        .map((p) => p.name)
    ).toEqual(['Imported'])
  })

  test('a file that is not a backup is refused on screen, and nothing is written', async () => {
    render(<ImportButton />)

    choose('{not json')

    await waitFor(() => expect(screen.getByText(/not valid JSON/i)).toBeTruthy())
    expect(screen.queryByText(/Imported:/)).toBeNull()
    expect(useEntityStore.getState().list('pilot')).toEqual([])
  })
})
