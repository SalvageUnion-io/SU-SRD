#!/usr/bin/env tsx
/**
 * Unified validation runner.
 *
 * Replaces chaining 8 separate `bun run validate:*` process invocations
 * (each re-reading and re-parsing the ~1.3MB `data/*.json` corpus on its
 * own) with a single shared data-load pass, fed to all 8 checks:
 *
 *   - ids              (checkUniqueIdsLogic.ts)
 *   - slugs            (validateSlugsLogic.ts)
 *   - references       (validateReferencesLogic.ts)
 *   - actions          (validateActionReferencesLogic.ts)
 *   - action-backrefs  (validateActionBackrefsLogic.ts)
 *   - orphans          (validateOrphansLogic.ts)
 *   - traits           (validateTraitsLogic.ts)
 *   - schemas          (validateSchemasLogic.ts)
 *   - parity           (validateParityLogic.ts)
 *
 * Every check's detection logic lives in its own `*Logic.ts` module, and the
 * standalone `bun run validate:*` CLIs (still supported individually) import
 * the exact same functions this runner does — so the two can never diverge.
 *
 * Usage:
 *   bun tools/validate.ts            # run all checks, structured report
 *   bun tools/validate.ts --fix      # apply mechanical fixes first (see below), then run all checks
 *
 * `--fix` is a *mechanical-only* tier: it currently does exactly what
 * `bun run fix:ids` already does (generateMissingIds.ts — fill in missing
 * IDs, replace invalid ones, and deduplicate collisions). It does NOT attempt
 * to fix anything requiring judgment (broken cross-references, orphaned
 * entities, trait issues, etc.) — those always remain diagnostics-only. Note
 * that generateMissingIds.ts rewrites whole files via
 * `JSON.stringify(data, null, 2)`, which reformats them — see its header
 * comment; that tradeoff is unchanged by this runner.
 */

import { loadAllDataFiles, type DataBag } from './loadData.js'
import { zodSchemaMap } from '../lib/ModelFactory.js'
import { groupByCheck, type Diagnostic } from './validationTypes.js'
import { checkAllFiles } from './checkUniqueIdsLogic.js'
import { findSlugCollisions } from './validateSlugsLogic.js'
import { findReferenceErrors } from './validateReferencesLogic.js'
import { findActionReferenceErrors } from './validateActionReferencesLogic.js'
import { runActionBackrefCheck } from './validateActionBackrefsLogic.js'
import { runOrphanCheck } from './validateOrphansLogic.js'
import { findTraitIssues } from './validateTraitsLogic.js'
import { KNOWN_UNRESOLVED, auditParity, unresolvedFindings } from './validateParityLogic.js'
import { validateAllFilesAgainstSchemas } from './validateSchemasLogic.js'
import { fixMissingIds } from './generateMissingIds.js'

// ─── per-check adapters: native result shape -> Diagnostic[] ───────────────

function idsCheck(data: DataBag): Diagnostic[] {
  const result = checkAllFiles(data)
  const diagnostics: Diagnostic[] = []

  for (const fileResult of result.files) {
    for (const { id, index, context } of fileResult.invalidUUIDs) {
      diagnostics.push({
        check: 'ids',
        file: fileResult.file,
        path: `${context}[${index}]`,
        message: `Invalid UUID "${id}" (must be UUIDv4)`,
      })
    }
    for (const { id, indices } of fileResult.duplicatesInFile) {
      diagnostics.push({
        check: 'ids',
        file: fileResult.file,
        path: `[${indices.join(', ')}]`,
        message: `Duplicate ID "${id}" reused at indices ${indices.join(', ')} within this file`,
      })
    }
  }

  for (const { id, files } of result.globalDuplicates) {
    for (const { file, indices } of files) {
      diagnostics.push({
        check: 'ids',
        file,
        path: `[${indices.join(', ')}]`,
        message: `ID "${id}" is duplicated across files: ${files.map((f) => f.file).join(', ')}`,
      })
    }
  }

  return diagnostics
}

function slugsCheck(data: DataBag): Diagnostic[] {
  return findSlugCollisions(data).map(({ file, slug, entities }) => ({
    check: 'slugs',
    file,
    path: `slug:"${slug}"`,
    message: `Shared by ${entities.length} entities: ${entities
      .map((e) => {
        const where = e.source ? ` (${e.source}${e.page ? ` p.${e.page}` : ''})` : ''
        return `"${e.name}"${where}`
      })
      .join(', ')} — disambiguate the names so every entity keeps a reachable URL`,
  }))
}

function referencesCheck(data: DataBag): Diagnostic[] {
  return findReferenceErrors(data).map((e) => ({
    check: 'references',
    file: e.file,
    path: `"${e.entityName}".${e.field}`,
    message: `${e.message} (referenced "${e.referencedName}")`,
  }))
}

function actionReferencesCheck(data: DataBag): Diagnostic[] {
  return findActionReferenceErrors(data).map((e) => ({
    check: 'actions',
    file: e.file,
    path: `"${e.entityName}".${e.field}`,
    message: e.suggestion ? `${e.message} — ${e.suggestion}` : e.message,
  }))
}

function actionBackrefsCheck(data: DataBag): Diagnostic[] {
  return runActionBackrefCheck(data).map((v) => ({
    check: 'action-backrefs',
    file: `${v.source}.json`,
    path: `"${v.actionName}"`,
    message: `Namesake action${v.actionType ? ` (${v.actionType})` : ''} exists in ${v.source}.json but is not referenced by that entity's actions[] — add "${v.actionName}" to it (or rename if coincidental)`,
  }))
}

function orphansCheck(data: DataBag): Diagnostic[] {
  const { staleRootFiles, unexpected, staleAllowlist } = runOrphanCheck(data)
  const diagnostics: Diagnostic[] = []

  for (const file of staleRootFiles) {
    diagnostics.push({
      check: 'orphans',
      file,
      path: '(ROOT_FILES)',
      message: `Stale ROOT_FILES entry in validateOrphansLogic.ts — file no longer exists in data/`,
    })
  }

  for (const orphan of unexpected) {
    diagnostics.push({
      check: 'orphans',
      file: orphan.file,
      path: `"${orphan.name}"`,
      message:
        'Orphaned entity — not referenced by any other entity. Wire it into a pattern/loadout, ' +
        'or add it to INTENTIONAL_ORPHANS in validateOrphansLogic.ts with a documented reason.',
    })
  }

  for (const entry of staleAllowlist) {
    diagnostics.push({
      check: 'orphans',
      file: entry.file,
      path: `"${entry.name}"`,
      message:
        'Stale INTENTIONAL_ORPHANS entry in validateOrphansLogic.ts — no longer orphaned ' +
        '(referenced, renamed, or removed). Remove it so it cannot mask a future orphan of the same name.',
    })
  }

  return diagnostics
}

function traitsCheck(data: DataBag): Diagnostic[] {
  return findTraitIssues(data).map((issue) => ({
    check: 'traits',
    file: issue.file,
    path: `"${issue.entity}" [${issue.kind}]`,
    message: issue.detail,
  }))
}

/**
 * Rules parity (ADR-029 §5): every stated mechanical change is encoded or
 * reasoned. Known-unresolved records are tolerated so the gate can land while
 * the backlog burns down; a NEW one fails, and a stale known entry fails too.
 */
function parityCheck(data: DataBag): Diagnostic[] {
  const unresolved = unresolvedFindings(auditParity(data as never))
  const diagnostics: Diagnostic[] = unresolved
    .filter((f) => !KNOWN_UNRESOLVED.includes(f.record))
    .map((f) => ({
      check: 'parity',
      file: f.schema,
      path: `"${f.record}" [${f.klass}]`,
      message: `states a mechanical change that is neither encoded nor exempt: "${f.sentence}"`,
    }))
  for (const name of KNOWN_UNRESOLVED) {
    if (!unresolved.some((f) => f.record === name)) {
      diagnostics.push({
        check: 'parity',
        file: 'tools/validateParityLogic.ts',
        path: `KNOWN_UNRESOLVED "${name}"`,
        message: 'stale entry — now encoded or gone; remove it so the list keeps burning down',
      })
    }
  }
  return diagnostics
}

function schemasCheck(data: DataBag): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const report of validateAllFilesAgainstSchemas(data, zodSchemaMap)) {
    if (report.status !== 'fail') continue
    for (const { index, name, errors } of report.failures) {
      diagnostics.push({
        check: 'schemas',
        file: report.file,
        path: `[${index}] "${name}"`,
        message: errors.join('; '),
      })
    }
  }
  return diagnostics
}

// ─── runner ──────────────────────────────────────────────────────────────

type CheckDefinition = {
  id: string
  label: string
  run: (data: DataBag) => Diagnostic[]
}

const CHECKS: CheckDefinition[] = [
  { id: 'ids', label: 'Unique IDs', run: idsCheck },
  { id: 'slugs', label: 'Slug uniqueness', run: slugsCheck },
  { id: 'references', label: 'Cross-references', run: referencesCheck },
  { id: 'actions', label: 'Action references', run: actionReferencesCheck },
  { id: 'action-backrefs', label: 'Namesake action back-references', run: actionBackrefsCheck },
  { id: 'orphans', label: 'Orphan detection', run: orphansCheck },
  { id: 'traits', label: 'Trait data', run: traitsCheck },
  { id: 'parity', label: 'Rules parity', run: parityCheck },
  { id: 'schemas', label: 'Zod schema validation', run: schemasCheck },
]

function printReport(diagnostics: Diagnostic[]): void {
  console.log(`\n${'='.repeat(80)}`)

  if (diagnostics.length === 0) {
    console.log('✅ All validations passed!')
    return
  }

  const grouped = groupByCheck(diagnostics)
  console.log(`❌ Found ${diagnostics.length} issue(s) across ${grouped.size} check(s):`)

  for (const [checkId, diags] of grouped) {
    console.log(`\n[${checkId}] ${diags.length} issue(s):`)
    for (const d of diags) {
      console.log(`  ${d.file} :: ${d.path}`)
      console.log(`    ${d.message}`)
    }
  }

  console.log(`\nTotal: ${diagnostics.length} issue(s) across ${grouped.size} check(s)`)
}

function main(): void {
  const fix = process.argv.slice(2).includes('--fix')

  if (fix) {
    console.log('🔧 --fix: applying mechanical fixes (missing/invalid/duplicate IDs)...\n')
    const summary = fixMissingIds()
    console.log(
      summary.totalChanges === 0
        ? '\nNo mechanical fixes were needed.\n'
        : `\nApplied ${summary.totalChanges} mechanical fix(es) across ${summary.filesModified} file(s).\n`
    )
  }

  // Single shared load: every check below reads from this one in-memory bag
  // instead of independently re-reading data/*.json.
  const data = loadAllDataFiles()

  const allDiagnostics: Diagnostic[] = []
  for (const check of CHECKS) {
    const diagnostics = check.run(data)
    allDiagnostics.push(...diagnostics)
    const status = diagnostics.length === 0 ? '✅' : '❌'
    console.log(
      `${status} ${check.label} (${check.id}): ${
        diagnostics.length === 0 ? 'passed' : `${diagnostics.length} issue(s)`
      }`
    )
  }

  printReport(allDiagnostics)

  process.exit(allDiagnostics.length === 0 ? 0 : 1)
}

if (import.meta.main) {
  main()
}
