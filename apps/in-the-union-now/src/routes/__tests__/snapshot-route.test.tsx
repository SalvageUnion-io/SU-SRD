/**
 * Tests for /s/$id snapshot route — exercises SnapshotPageInner directly
 * (no router provider needed) and SnapshotSheet for payload rendering.
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument()
 *   - No mock.module()
 *   - Dep-injection via SnapshotPageInner props
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { SnapshotPageInner } from '../s/$id'
import { SnapshotSheet } from '../../components/sheet/SnapshotSheet'
import type { SnapshotPayload } from '../../lib/snapshot/client'

// Preload chassis data so MechSheet can resolve chassis without throwing
beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const pilotSnapshot: SnapshotPayload = {
  kind: 'pilot',
  entity: {
    id: 'pilot-1',
    schemaVersion: 1,
    name: 'Zara Heln',
    callsign: 'Flash',
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    motto: 'Keep moving.',
    keepsake: 'Old photo.',
    appearance: 'Short.',
    background: '',
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

const mechSnapshot: SnapshotPayload = {
  kind: 'mech',
  entity: {
    id: 'mech-1',
    schemaVersion: 1,
    name: 'Iron Jaw',
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

// ---------------------------------------------------------------------------
// SnapshotPageInner — 404 path
// ---------------------------------------------------------------------------

describe('SnapshotPageInner — not found', () => {
  test('renders not-found heading when notFound is true', () => {
    render(<SnapshotPageInner snapshot={null} notFound={true} error={null} />)
    expect(screen.getByRole('heading', { name: /snapshot not found/i })).toBeTruthy()
  })

  test('renders back to Roster link on not-found', () => {
    render(<SnapshotPageInner snapshot={null} notFound={true} error={null} />)
    const link = screen.getByRole('link', { name: /back to roster/i })
    expect(link).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SnapshotPageInner — error path
// ---------------------------------------------------------------------------

describe('SnapshotPageInner — error state', () => {
  test('renders error heading when error is set', () => {
    render(<SnapshotPageInner snapshot={null} notFound={false} error="network timeout" />)
    expect(screen.getByRole('heading', { name: /failed to load snapshot/i })).toBeTruthy()
  })

  test('shows the error message', () => {
    render(<SnapshotPageInner snapshot={null} notFound={false} error="network timeout" />)
    expect(screen.getByText(/network timeout/i)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SnapshotPageInner — success path delegates to SnapshotSheet
// ---------------------------------------------------------------------------

describe('SnapshotPageInner — success path', () => {
  test('renders SnapshotSheet content for a pilot snapshot', () => {
    render(<SnapshotPageInner snapshot={pilotSnapshot} notFound={false} error={null} />)
    // SnapshotSheet shows the entity name via the LiveSheet hero
    expect(screen.getAllByText(/Zara Heln/).length).toBeGreaterThan(0)
  })

  test('shows read-only banner for a snapshot', () => {
    render(<SnapshotPageInner snapshot={pilotSnapshot} notFound={false} error={null} />)
    expect(screen.getByRole('note', { name: /read-only snapshot/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SnapshotSheet — rendering different entity kinds
// ---------------------------------------------------------------------------

describe('SnapshotSheet — pilot payload', () => {
  test('renders pilot name from snapshot', () => {
    render(<SnapshotSheet snapshot={pilotSnapshot as Record<string, unknown>} />)
    expect(screen.getAllByText(/Zara Heln/).length).toBeGreaterThan(0)
  })

  test('renders the pilot variant shell, read-only (no Edit / no Share)', () => {
    const { container } = render(
      <SnapshotSheet snapshot={pilotSnapshot as Record<string, unknown>} />
    )
    expect(container.querySelector('.sheet--pilot')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /edit this pilot/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull()
  })
})

describe('SnapshotSheet — mech payload', () => {
  test('renders mech name from snapshot', () => {
    render(<SnapshotSheet snapshot={mechSnapshot as Record<string, unknown>} />)
    expect(screen.getAllByText(/Iron Jaw/).length).toBeGreaterThan(0)
  })

  test('renders the mech variant shell', () => {
    const { container } = render(
      <SnapshotSheet snapshot={mechSnapshot as Record<string, unknown>} />
    )
    expect(container.querySelector('.sheet--mech')).toBeTruthy()
  })

  test('renders a pre-rename snapshot carrying legacy cargo: string[]', () => {
    const legacyEntity: Record<string, unknown> = {
      ...(mechSnapshot.entity as Record<string, unknown>),
      cargo: ['Salvaged plating'],
    }
    delete legacyEntity.cargoLots
    const legacySnapshot = { kind: 'mech', entity: legacyEntity }
    render(<SnapshotSheet snapshot={legacySnapshot as Record<string, unknown>} />)
    expect(screen.getAllByText(/Iron Jaw/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Salvaged plating/)).toBeTruthy()
  })
})

describe('SnapshotSheet — invalid payload', () => {
  test('renders graceful error for unknown kind', () => {
    const badSnapshot = { kind: 'dragon', entity: {} }
    render(<SnapshotSheet snapshot={badSnapshot as Record<string, unknown>} />)
    expect(screen.getByText(/could not render snapshot/i)).toBeTruthy()
  })

  test('renders graceful error when entity is missing', () => {
    const badSnapshot = { kind: 'pilot', entity: null }
    render(<SnapshotSheet snapshot={badSnapshot as Record<string, unknown>} />)
    expect(screen.getByText(/could not render snapshot/i)).toBeTruthy()
  })

  test('renders a STYLED error (heading + reason + escape hatch) on schema mismatch', () => {
    // A recognized kind whose entity fails Zod validation (plan 5.2)
    const badSnapshot = { kind: 'pilot', entity: { id: 42, name: null } }
    render(<SnapshotSheet snapshot={badSnapshot as Record<string, unknown>} />)
    expect(screen.getByRole('heading', { name: /could not render snapshot/i })).toBeTruthy()
    expect(screen.getByText(/invalid pilot data/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to roster/i })).toBeTruthy()
  })
})
