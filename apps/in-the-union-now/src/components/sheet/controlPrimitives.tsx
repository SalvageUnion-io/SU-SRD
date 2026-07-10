/**
 * controlPrimitives — the shared scaffolding every sheet control repeated by
 * hand (audit item 24): the focus-ring input classes, the warn advisory box
 * (13 copies), and the freshest-record read.
 *
 * These are layout/state primitives only — no rules math lives here (that
 * stays in lib/rules per ADR-006) and nothing mutates the store.
 */

import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import type { EntityForType, EntityType } from '../../stores/types'

/**
 * The freshest record for a control action: rapid actions (or another tab's
 * write landing between renders) must not stomp each other, so handlers
 * re-read from the store and fall back to the render prop.
 */
type FreshEntityLookup = {
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null
}

// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function freshEntity<T extends EntityType>(
  storeState: FreshEntityLookup,
  type: T,
  fallback: EntityForType<T>
): EntityForType<T> {
  return storeState.get(type, fallback.id) ?? fallback
}

type AdvisoryBoxProps = {
  /** Margin/layout tweaks per call site (e.g. 'mt-2'). */
  className?: string
  children: ReactNode
}

/**
 * The standard warn advisory: role="alert", warn border, paper box. Rich
 * content (buttons, multiple paragraphs) goes in as children; single-message
 * sites use <AdvisoryText> for the standard rust body copy.
 */
export function AdvisoryBox({ className, children }: AdvisoryBoxProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2', className)}
    >
      {children}
    </div>
  )
}

/** Single-message advisory — the box with the standard rust body text. */
export function AdvisoryText({ className, children }: AdvisoryBoxProps) {
  return (
    <AdvisoryBox className={className}>
      <p className="m-0 font-body text-sm text-rust">{children}</p>
    </AdvisoryBox>
  )
}
