import { useRef, useState, useLayoutEffect, useEffect, useContext } from 'react'
import { StickyOffsetContext } from './StickyHeaderContext'

type StickyCardResult = {
  wrapperRef: React.RefObject<HTMLDivElement | null>
  headerRef: React.RefObject<HTMLDivElement | null> | undefined
  stickyTopStyle: string | undefined
  childStickyOffset: number
  isSticky: boolean
}

export function useStickyCard(enabled: boolean): StickyCardResult {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const parentStickyOffset = useContext(StickyOffsetContext)

  const [measuredNavH, setMeasuredNavH] = useState(0)
  const [measuredHeaderH, setMeasuredHeaderH] = useState(0)

  useLayoutEffect(() => {
    if (!enabled || !headerRef.current || !wrapperRef.current) return
    const header = headerRef.current
    const wrapper = wrapperRef.current
    const measure = () => {
      const navH = parseFloat(getComputedStyle(wrapper).getPropertyValue('--app-nav-h')) || 0
      setMeasuredNavH((prev) => (prev !== navH ? navH : prev))
      setMeasuredHeaderH((prev) => {
        const h = header.offsetHeight
        return prev !== h ? h : prev
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [enabled])

  // Nested sticky: stack below parent's sticky header, or use nav height for top-level
  const stickyTop = enabled ? (parentStickyOffset > 0 ? parentStickyOffset : measuredNavH) : 0
  const childStickyOffset = enabled ? stickyTop + measuredHeaderH : 0

  // Set --sticky-header-h CSS variable for SectionSeparator offsets
  useEffect(() => {
    if (!enabled || !wrapperRef.current) return
    wrapperRef.current.style.setProperty('--sticky-header-h', `${stickyTop + measuredHeaderH}px`)
  }, [enabled, stickyTop, measuredHeaderH])

  // Use CSS variable as fallback for first render (before measurement)
  const stickyTopStyle = enabled
    ? stickyTop > 0
      ? `${stickyTop}px`
      : 'var(--app-nav-h, 0px)'
    : undefined

  return {
    wrapperRef,
    headerRef: enabled ? headerRef : undefined,
    stickyTopStyle,
    childStickyOffset,
    isSticky: enabled,
  }
}
