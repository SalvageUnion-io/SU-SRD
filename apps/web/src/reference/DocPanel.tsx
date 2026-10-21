import type { ReactNode } from 'react'
import { TitledBox } from '../components/index'
import { PROSE, PROSE_12 } from '../lib/docPageStyles'

/**
 * DocPanel — a document page's titled block (`/api`'s endpoints, `/discord`'s
 * commands): the house `TitledBox`, its name on the cut-out, its stamps beside
 * it on the band (an endpoint's GET), its prose and samples in the paper body
 * (R42). `flush` lays a table edge to edge under the head.
 */
export function DocPanel({
  title,
  tone,
  chips,
  flush = false,
  children,
}: {
  title: string
  /** The band's tone token (`--color-<tone>`); ink by default. */
  tone?: string
  chips?: ReactNode
  flush?: boolean
  children: ReactNode
}) {
  return (
    <TitledBox
      as="section"
      title={title}
      titleAs="h3"
      {...(tone ? { tone } : {})}
      {...(chips ? { chips } : {})}
      body={flush ? 'flush' : 'padded'}
      bodyStyle={flush ? PROSE : PROSE_12}
    >
      {children}
    </TitledBox>
  )
}
