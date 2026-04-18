import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

/**
 * Responsive masonry layout — round-robin distribution of items into columns.
 * Produces a horizontal reading order (first item top-left, second top of
 * column 2, etc.) rather than vertical-first ordering.
 */

const BREAKPOINTS = [
  { min: 1280, cols: 4 }, // xl
  { min: 1024, cols: 3 }, // lg
  { min: 640, cols: 2 }, // sm
] as const

function useColumnCount(ref: RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry!.contentRect.width
      let next = 1
      for (const bp of BREAKPOINTS) {
        if (w >= bp.min) {
          next = bp.cols
          break
        }
      }
      setCols(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return cols
}

export function MasonryColumns<T extends { key: string }>({
  items,
  gap,
  className,
  renderItem,
}: {
  items: T[]
  gap: string
  className?: string
  renderItem: (item: T) => ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cols = useColumnCount(containerRef)

  const columns = useMemo(() => {
    const buckets: T[][] = Array.from({ length: cols }, () => [])
    for (let i = 0; i < items.length; i++) {
      buckets[i % cols]!.push(items[i]!)
    }
    return buckets
  }, [items, cols])

  return (
    <div ref={containerRef} className={`flex ${gap} ${className ?? ''}`}>
      {columns.map((col, ci) => (
        <div key={ci} className={`flex flex-1 flex-col ${gap}`}>
          {col.map((item) => (
            <div key={item.key}>{renderItem(item)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
