import type { IDBPTransaction, StoreNames } from 'idb'

/**
 * The untyped versionchange transaction handed to the idb upgrade callback.
 *
 * This type lives in a LEAF module rather than in `./index`, which imports every
 * migration. Each migration needs the type, so importing it from `./index` made
 * an 11-node import cycle — harmless at runtime (every edge is `import type`, so
 * all of it erases), but a cycle to every tool that reads the module graph, and
 * the kind of thing that stops being type-only the first time someone needs a
 * value from the barrel.
 */
export type UpgradeTransaction = IDBPTransaction<
  unknown,
  ArrayLike<StoreNames<unknown>>,
  'versionchange'
>
