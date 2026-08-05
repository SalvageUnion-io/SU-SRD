/**
 * Crawler capacity rule enforcement (Phase 3, soft-warn).
 *
 * Moved to packages/salvageunion-reference/lib/rules/crawlerCapacity.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export type {
  CrawlerCapacityInput,
  CrawlerCapacityResult,
  CrawlerCapacityViolation,
} from 'salvageunion-reference/rules'
export { computeCrawlerCapacity } from 'salvageunion-reference/rules'
