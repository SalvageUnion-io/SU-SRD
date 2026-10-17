#!/usr/bin/env tsx
/**
 * Unified validation runner.
 *
 * One shared data-load pass over the ~1.3MB `data/*.json` corpus, fed to all
 * 11 checks:
 *
 *   - ids              (checkUniqueIdsLogic.ts)
 *   - duplicate-keys   (validateDuplicateKeysLogic.ts — reads the raw text)
 *   - self-citations   (validateDuplicateKeysLogic.ts)
 *   - slugs            (validateSlugsLogic.ts)
 *   - references       (validateReferencesLogic.ts)
 *   - actions          (validateActionReferencesLogic.ts)
 *   - action-backrefs  (validateActionBackrefsLogic.ts)
 *   - orphans          (validateOrphansLogic.ts)
 *   - content-dupes    (validateContentDupesLogic.ts)
 *   - traits           (validateTraitsLogic.ts)
 *   - parity           (validateParityLogic.ts)
 *
 * Every check's detection logic lives in its own `*Logic.ts` module, which is
 * where its tests live too. This file is the ONLY command-line entry: it loads
 * the corpus once and prints one report format; `--only` picks checks.
 *
 * Usage:
 *   bun tools/validate.ts                      # run all checks, structured report
 *   bun tools/validate.ts --only=ids,slugs     # run just these checks
 *
 * It reports and never writes: `tools/edit-data.ts` is the one writer of
 * `data/*.json`, and `edit-data add` mints a missing `id`.
 */
export {};
