import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { activateOnKey, FOCUS_RING } from '../../components/chrome/interaction'
import type { EntityLinkAttrs, EntityMode } from '../types'
import type { LinkTarget } from './linkTarget'

type LinkMode = Extract<EntityMode, { kind: 'link' }>

/** LINK's head affordance: the chevron (›) that says the surface opens. */
export function LinkChevron() {
  return <ChevronRight aria-hidden="true" size={20} strokeWidth={3} style={{ flex: 'none' }} />
}

/**
 * LINK's surface: the whole form is the target — a real `<a href>` for a
 * route, a button for an opener. `attrs` lets a host list own the semantics
 * (a combobox option).
 */
export function LinkSurface({
  target,
  label,
  attrs,
  className,
  style,
  children,
}: {
  target: LinkTarget
  label: string
  attrs?: LinkMode['attrs']
  className: string
  style?: CSSProperties
  children: ReactNode
}) {
  const cls = `${className} ${FOCUS_RING}`
  if (target.href) {
    return (
      <a href={target.href} aria-label={label} className={cls} style={style} {...attrs}>
        {children}
      </a>
    )
  }
  const open = target.onOpen
  const interaction: EntityLinkAttrs = open
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': label,
        onClick: open,
        onKeyDown: activateOnKey(open),
      }
    : {}
  return (
    <div
      className={open ? cls : className}
      style={{ ...style, ...(open ? { cursor: 'pointer' } : {}) }}
      {...interaction}
      {...attrs}
    >
      {children}
    </div>
  )
}
