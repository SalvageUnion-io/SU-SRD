/**
 * Tests for the ci-aggregator guard.
 *
 * The parse is hand-rolled (no YAML dependency in this repo), and a guard whose
 * parse quietly stops seeing jobs reports success while checking nothing —
 * exactly the failure mode it was written to prevent. So the cases below pin
 * the parse itself and the two traps in the diff: the aggregate is never
 * reported as un-gating itself, and a path-filtered job is still required to be
 * in `needs:`.
 *
 * Every case runs against a synthetic workflow. The repo's own ci.yml is what
 * `bun run check:ci-aggregator` asserts.
 */

import { describe, expect, it } from 'bun:test'
import { checkAggregator, jobNeeds, WorkflowShapeError, workflowJobs } from '../check-ci-aggregator'

/** A minimal well-formed workflow: two jobs, both gated. */
const GATED = `name: CI

on:
  pull_request:

jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

  test:
    needs: [changes]
    if: needs.changes.outputs.code == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: bun run test

  quality-checks:
    if: always()
    needs:
      - changes
      - test
    runs-on: ubuntu-latest
    steps:
      - name: Verify no job failed
        run: |
          echo "checking"
`

describe('workflowJobs', () => {
  it('reads every top-level job key, in file order', () => {
    expect(workflowJobs(GATED)).toEqual(['changes', 'test', 'quality-checks'])
  })

  it('does not read block-scalar bodies as YAML', () => {
    // A `run: |` body is arbitrary text, and a `filters: |` body is a nested
    // document — both are full of colon-terminated, dash-prefixed lines that
    // are not jobs.
    const source = `jobs:
  changes:
    steps:
      - name: Filters
        with:
          filters: |
            itun:
              - 'apps/itun/**'
            web:
              - 'apps/srd/**'
      - name: Force-all on merge queue
        run: |
          case "$ref" in
            gh-readonly-queue/*)
              echo "all=true" >> "$GITHUB_OUTPUT"
              ;;
          esac

  quality-checks:
    needs:
      - changes
`
    expect(workflowJobs(source)).toEqual(['changes', 'quality-checks'])
  })

  it('stops at the next top-level key', () => {
    const source = `jobs:
  changes:
    runs-on: ubuntu-latest

defaults:
  run:
    shell: bash
`
    expect(workflowJobs(source)).toEqual(['changes'])
  })

  it('rejects a workflow with no `jobs:` mapping', () => {
    expect(() => workflowJobs('name: CI\non:\n  pull_request:\n')).toThrow(WorkflowShapeError)
  })

  it('rejects a `jobs:` mapping it parsed nothing out of', () => {
    expect(() => workflowJobs('jobs:\n')).toThrow(/parsed zero jobs/)
  })
})

describe('jobNeeds', () => {
  it('reads the block-sequence form', () => {
    expect([...jobNeeds(GATED, 'quality-checks')]).toEqual(['changes', 'test'])
  })

  it('reads the inline flow form', () => {
    expect([...jobNeeds(GATED, 'test')]).toEqual(['changes'])
  })

  it('reads a quoted, multi-entry inline flow form', () => {
    const source = `jobs:
  a:
    runs-on: ubuntu-latest
  b:
    runs-on: ubuntu-latest
  quality-checks:
    needs: ['a', "b"]
    runs-on: ubuntu-latest
`
    expect([...jobNeeds(source, 'quality-checks')]).toEqual(['a', 'b'])
  })

  it('stops at the next job property, not the next job', () => {
    // `runs-on:`/`steps:` end the list; the sequence items under `steps:` must
    // not be swallowed as needs entries.
    expect([...jobNeeds(GATED, 'quality-checks')]).not.toContain('name')
  })

  it('lets a block-scalar introducer terminate the list', () => {
    // Regression: the body of `env: |` is stripped, and stripping its
    // INTRODUCER too left `needs:` still open, so the next six-space sequence
    // item — a `steps:` entry, in the real file — was read as a dependency.
    const source = `jobs:
  a:
    runs-on: ubuntu-latest
  quality-checks:
    needs:
      - a
    env: |
      NOTE=whatever
    steps:
      - uses: actions/checkout@v7
`
    expect([...jobNeeds(source, 'quality-checks')]).toEqual(['a'])
  })

  it('rejects a job that is not in the workflow', () => {
    expect(() => jobNeeds(GATED, 'nope')).toThrow(WorkflowShapeError)
  })
})

describe('checkAggregator', () => {
  it('passes when every job is in `needs:`', () => {
    const report = checkAggregator(GATED)
    expect(report.missing).toEqual([])
    expect(report.stale).toEqual([])
    expect(report.gated).toEqual(['changes', 'test'])
  })

  it('never reports the aggregate as missing from its own `needs:`', () => {
    // A job cannot `needs:` itself, so a naive key-set diff reports the gate
    // ungated forever — the check fails on its own repo on day one and gets
    // deleted.
    expect(checkAggregator(GATED).missing).not.toContain('quality-checks')
    expect(checkAggregator(GATED).gated).not.toContain('quality-checks')
  })

  it('fails on a job that was added without being added to `needs:`', () => {
    const source = GATED.replace(
      '  quality-checks:',
      `  coverage:
    needs: [changes]
    runs-on: ubuntu-latest
    steps:
      - name: Coverage
        run: bun run test:coverage

  quality-checks:`
    )
    expect(checkAggregator(source).missing).toEqual(['coverage'])
  })

  it('requires a path-filtered job to be in `needs:` too', () => {
    // Presence, not reachability: being skipped is a runtime outcome the
    // aggregate handles (it passes on `skipped`), so an `if:` is no excuse for
    // being absent from the list.
    const source = GATED.replace('      - test\n', '')
    expect(checkAggregator(source).missing).toEqual(['test'])
  })

  it('reports a `needs:` entry that is not a job', () => {
    const source = GATED.replace('      - test\n', '      - test\n      - deleted-job\n')
    expect(checkAggregator(source).stale).toEqual(['deleted-job'])
  })

  it('rejects a workflow with no aggregate job', () => {
    expect(() => checkAggregator(GATED, 'ci-success')).toThrow(/no `ci-success` job/)
  })

  it('rejects an aggregate with an unparseable `needs:` list', () => {
    // An empty needs list gates nothing at all, which reads as a clean pass to
    // every other tool in the chain.
    const source = GATED.replace('    needs:\n      - changes\n      - test\n', '')
    expect(() => checkAggregator(source)).toThrow(/gates NOTHING/)
  })

  it('honours an explicit exemption, and flags one that has gone stale', () => {
    const ungated = GATED.replace('      - test\n', '')
    expect(checkAggregator(ungated, 'quality-checks', { test: 'reason' }).missing).toEqual([])
    expect(
      checkAggregator(GATED, 'quality-checks', { test: 'reason' }).redundantExemptions
    ).toEqual(['test'])
  })
})
