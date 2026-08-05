import { mock } from 'bun:test'

type Indexed = { id?: string; name?: string; slug?: string }

/**
 * Replace a `SalvageUnionReference` model's rows for the duration of a test,
 * across EVERY accessor — not just `all()`.
 *
 * The tests that needed this each patched `Model.all` alone, which worked only
 * for as long as production code reached rows by scanning `all()`. It no longer
 * does: lookups go through `getById`/`getByName`/`getBySlug`, which read
 * `BaseModel`'s lazily-built index rather than calling `all()`. A half-patched
 * model therefore returns the fixture to one code path and the real dataset to
 * another — the component renders real bays while the test asserts on fake
 * ones, and the failure reads as a component bug rather than a mocking gap.
 *
 * So the seam is "this model contains exactly these rows", not "this one method
 * returns this array". Returns a restore function; call it in `afterEach`.
 */
export function patchModelRows<T extends Indexed>(
  model: {
    all: () => unknown
    getById: (id: string) => unknown
    getByName: (name: string) => unknown
    getBySlug: (slug: string) => unknown
  },
  rows: T[]
): () => void {
  const original = {
    all: model.all.bind(model),
    getById: model.getById.bind(model),
    getByName: model.getByName.bind(model),
    getBySlug: model.getBySlug.bind(model),
  }

  model.all = mock(() => rows)
  model.getById = mock((id: string) => rows.find((r) => r.id === id))
  model.getByName = mock((name: string) => rows.find((r) => r.name === name))
  // Matches `BaseModel.getBySlug`, which falls back to slugifying the name when
  // a row carries no explicit slug — most fixture rows do not.
  model.getBySlug = mock((slug: string) =>
    rows.find((r) => r.slug === slug || slugify(r.name) === slug)
  )

  return () => {
    model.all = original.all
    model.getById = original.getById
    model.getByName = original.getByName
    model.getBySlug = original.getBySlug
  }
}

function slugify(name: string | undefined): string | undefined {
  return name
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
