/**
 * Crawler capacity rule enforcement (Phase 3, soft-warn).
 *
 * Moved to packages/salvageunion-reference/lib/rules/crawlerCapacity.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export { computeCrawlerCapacity } from 'salvageunion-reference/rules'
export type {
  CrawlerCapacityInput,
  CrawlerCapacityViolation,
  CrawlerCapacityResult,
} from 'salvageunion-reference/rules'
