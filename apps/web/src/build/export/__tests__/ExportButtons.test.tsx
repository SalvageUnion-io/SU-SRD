/**
 * The backup controls, as a player drives them.
 *
 * The bundle logic itself is covered in `lib/export/__tests__`; what is pinned
 * here is what the controls add: the filename, the callback that must fire only
 * after a download really happened, and the error a failure leaves on screen.
 *
 * No `mock.module`: the download is observed by intercepting the two browser
 * calls `downloadJson` makes, restored after every test.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { FIXTURE_NOW, pilotFixture } from '../../../components/__tests__/fixtures'
import { toast } from '../../../components/index'
import type { ExportBundle } from '../../../lib/schemas/exportBundle'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../replica/units'
import { BackupMenu } from '../BackupMenu'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

type Download = { filename: string; blob: Blob }
let downloads: Download[] = []
let lastBlob: Blob | null = null
let failCreate = false

const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL
const realClick = HTMLAnchorElement.prototype.click

beforeEach(() => {
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

  resetStores()
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

/** The band's menu, with the status line its caller would draw. */
function Backups({ canImport = true }: { canImport?: boolean }) {
  const [result, setResult] = useState<string | null>(null)
  return (
    <>
      <p role="status">{result}</p>
      <BackupMenu canImport={canImport} onResult={setResult} />
    </>
  )
}

async function chooseRow(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Backups: import and export' }))
  fireEvent.click(await screen.findByRole('menuitem', { name }))
}

describe('BackupMenu — Export all', () => {
  test('downloads everything in the store as one dated backup', async () => {
    await useUnits.getState().adopt('pilot', pilotFixture({ id: 'p1', name: 'Rook' }))
    render(<Backups />)

    await chooseRow('Export all')

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0]?.filename).toMatch(/^salvageunion-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect((await downloaded()).entities.pilots.map((p) => p.name)).toEqual(['Rook'])
  })

  test('a failed download says so in its own words, and a retry that lands clears it', async () => {
    failCreate = true
    render(<Backups />)

    await chooseRow('Export all')

    const failure = 'The backup could not be downloaded. Try again.'
    // The line can paint before the transition's pending flag clears, so wait
    // for the menu to settle too, or the retry finds it still disabled.
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(failure)
      expect(
        screen.getByRole('button', { name: 'Backups: import and export' }).hasAttribute('disabled')
      ).toBe(false)
    })
    // What was thrown is a defect's text, not the player's to read.
    expect(screen.queryByText('Disk full')).toBeNull()
    expect(downloads).toHaveLength(0)

    failCreate = false
    await chooseRow('Export all')
    await waitFor(() => expect(downloads).toHaveLength(1))
    // The retry clears the stale error rather than leaving it beside a success.
    expect(screen.getByRole('status').textContent).toBe('')
  })

  test('a session that cannot write is offered the export alone', async () => {
    render(<Backups canImport={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Backups: import and export' }))

    const rows = await screen.findAllByRole('menuitem')
    expect(rows.map((row) => row.textContent)).toEqual(['Export all'])
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })
})

describe('BackupMenu — Import', () => {
  function choose(text: string): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([text], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
  }

  type Line = { title?: unknown; action?: { label: string } }
  const lines = () =>
    toast.getToasts().filter((t) => !('dismiss' in t && t.dismiss)) as unknown as Line[]

  test('a valid backup lands in the store and says what it created, in a toast that opens it (r5 C12)', async () => {
    toast.dismiss()
    const bundle: ExportBundle = {
      schemaVersion: 2,
      exportedAt: FIXTURE_NOW,
      entities: {
        pilots: [pilotFixture({ id: 'from-file', name: 'Imported' })],
        mechs: [],
        crawlers: [],
        npcs: [],
      },
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }
    render(<Backups />)

    choose(JSON.stringify(bundle))

    await waitFor(() =>
      expect(lines().some((t) => t.title === 'Import complete: 1 sheet added.')).toBe(true)
    )
    expect(lines().find((t) => t.action)?.action?.label).toBe('Open Imported')
    // The result is the toast; the line above the title is for a refusal.
    expect(screen.getByRole('status').textContent).toBe('')
    toast.dismiss()
    // A copy earns a new id (see apps/web/src/routes/CLAUDE.md), so match on the name.
    expect(
      useUnits
        .getState()
        .list('pilot')
        .map((p) => p.name)
    ).toEqual(['Imported'])
  })

  test('the menu is named in words, Backups (r4 E20)', () => {
    render(<Backups />)
    expect(screen.getByRole('button', { name: 'Backups: import and export' }).textContent).toBe(
      'Backups'
    )
  })

  test('a backup whose sheets are all here already says so, and adds nothing (r4 E20)', async () => {
    const held = await useUnits.getState().adopt('pilot', pilotFixture({ id: 'p1', name: 'Rook' }))
    const bundle: ExportBundle = {
      schemaVersion: 2,
      exportedAt: FIXTURE_NOW,
      entities: { pilots: [held], mechs: [], crawlers: [], npcs: [] },
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }
    render(<Backups />)

    choose(JSON.stringify(bundle))

    toast.dismiss()
    await waitFor(() =>
      expect(
        lines().some(
          (t) => t.title === 'Nothing to import: every sheet in that backup is already here.'
        )
      ).toBe(true)
    )
    toast.dismiss()
    expect(useUnits.getState().list('pilot')).toHaveLength(1)
  })

  test('a file that is not a backup is refused on screen, and nothing is written', async () => {
    render(<Backups />)

    choose('{not json')

    await waitFor(() => expect(screen.getByText(/not valid JSON/i)).toBeTruthy())
    expect(screen.queryByText(/Imported:/)).toBeNull()
    expect(useUnits.getState().list('pilot')).toEqual([])
  })
})
