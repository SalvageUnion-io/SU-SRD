/**
 * Performance monitoring utility using web-vitals
 * Tracks Core Web Vitals and other performance metrics
 */

import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals'
import { logger } from './logger'

const isDev = import.meta.env.DEV

/**
 * Send metric to analytics service (placeholder for future implementation)
 */
function sendToAnalytics(metric: Metric): void {
  // TODO: Integrate with analytics service (e.g., Google Analytics, Sentry)
  // For now, just log in development
  if (isDev) {
    logger.log(`[Performance] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    })
  }
}

/**
 * Initialize performance monitoring
 * Registers handlers for all Core Web Vitals and other important metrics
 */
export function initPerformanceMonitoring(): void {
  // Core Web Vitals
  onCLS(sendToAnalytics) // Cumulative Layout Shift
  onFCP(sendToAnalytics) // First Contentful Paint
  onLCP(sendToAnalytics) // Largest Contentful Paint
  onTTFB(sendToAnalytics) // Time to First Byte
  onINP(sendToAnalytics) // Interaction to Next Paint (replaces FID)

  if (isDev) {
    logger.log('[Performance] Monitoring initialized')
  }
}

/**
 * Get performance metrics summary
 * Useful for debugging and development
 */
export function getPerformanceSummary(): {
  metrics: Record<string, { value: number; rating: string }>
} {
  // This would need to be implemented with a metrics store
  // For now, return empty object
  return { metrics: {} }
}
