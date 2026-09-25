import { SchemaNotLoadedError } from 'salvageunion-reference'
import { captureException } from './observability'

type Report = (error: unknown, context: { source: string }) => void

/**
 * Build a reference reader around a reporter. Exported for tests, which pass a
 * recording reporter instead of mocking `./observability` process-wide.
 */
export function makeReferenceReader(report: Report) {
  /**
   * Sources that have already reported a fault. A reader runs on every render,
   * so an unconditional report would send one event per frame.
   */
  const reported = new Set<string>()

  return function read<T>(source: string, readFn: () => T, fallback: T): T {
    try {
      return readFn()
    } catch (err) {
      if (!(err instanceof SchemaNotLoadedError) && !reported.has(source)) {
        reported.add(source)
        report(err, { source })
      }
      return fallback
    }
  }
}

/**
 * Read reference data, falling back when it cannot be read.
 *
 * Two failures used to look identical here, because every caller wrapped the
 * read in a bare `catch {}` (audit AP-15):
 *
 * - **The schema is not preloaded.** Expected: read-only snapshot renders never
 *   preload, and neither do most unit tests. The fallback is the right answer,
 *   and it stays silent.
 * - **Anything else.** A real fault in the dataset or a resolver. The fallback
 *   still keeps the screen up — a label degrading to its raw ref beats an
 *   error boundary — but it is reported to Sentry, once per `source` per page
 *   load, instead of vanishing.
 *
 * `source` names the call site, so an event says which reader broke.
 */
export const readReference = makeReferenceReader((error, context) =>
  captureException(error, context)
)
