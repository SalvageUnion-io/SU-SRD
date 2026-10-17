/**
 * Tests for SalvageUnionReference.preload() and isLoaded() API
 *
 * These tests exercise the lazy loading contract:
 * - preload('all') loads every schema
 * - preload(['chassis', 'classes']) loads specific schemas
 * - isLoaded(id) reports load status correctly
 * - Accessing an unloaded schema throws a descriptive error
 * - preload() is idempotent (calling twice is safe)
 * - After preload, all ORM methods work synchronously as before
 * - preload(ids, { projection: 'list' }) installs a list projection a full load replaces
 */
export {};
