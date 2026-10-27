/**
 * The crawler-economy dialogs' shared styles (`CrawlerEconomyControl`,
 * `ExoticTrade`): their body copy, pickers and action row.
 */

import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

/** Body copy: the `sm` size rung, with its line height. */
export const TEXT = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.25 / 0.875,
  color: tokens.color.ink,
} satisfies CSSProperties

export const TEXT_TIGHT = { ...TEXT, margin: 0 } satisfies CSSProperties

export const TEXT_AFTER = { ...TEXT, marginTop: tokens.space[8] } satisfies CSSProperties

export const PICKERS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: tokens.space[12],
} satisfies CSSProperties

export const PICKER_LABEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
} satisfies CSSProperties

/** A compact select: tighter than the `Select` skin's own padding. */
export const PICKER = { padding: `${tokens.space[6]} ${tokens.space[8]}` } satisfies CSSProperties

export const QTY = {
  display: 'inline-flex',
  paddingBottom: tokens.space[4],
} satisfies CSSProperties

export const ACTION_ROW = {
  marginTop: tokens.space[8],
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[12],
} satisfies CSSProperties
