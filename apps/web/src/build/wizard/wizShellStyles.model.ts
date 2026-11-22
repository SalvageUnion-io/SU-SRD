import type { CSSProperties } from 'react'
import { capsLabel, tokens } from '../../components/index'

/** `WizShell`'s own style objects: the shell, the step's frame and the action pill. */

/** Its direction, alignment, gap and padding change at sm (`.su-wiz-pill`). */
export const pillStyle = {
  backgroundColor: tokens.color.ink,
  display: 'flex',
  pointerEvents: 'auto',
} satisfies CSSProperties

/** Centred on a phone, start-aligned from sm (`.su-wiz-pill-start`). */
export const pillTrackersStyle = {
  alignItems: 'center',
  display: 'flex',
} satisfies CSSProperties

/** A row on a phone, `display: contents` from sm (`.su-wiz-pill-nav`). */
export const pillNavStyle = {
  alignItems: 'center',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties

/** Full width on a phone, its own width from sm (`.su-wiz-pill-cta`). */
export const ctaStyle = { borderRadius: tokens.radius.card } satisfies CSSProperties

/** Locked: hollow, at full opacity though disabled. */
export const ctaLockedStyle = {
  ...ctaStyle,
  backgroundColor: 'transparent',
  borderColor: tokens.color.paper60,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.pill,
  boxShadow: 'none',
  color: tokens.color.paper60,
  fontWeight: tokens.weight.normal,
  opacity: 1,
} satisfies CSSProperties

/*
 * The shell's own layout (its column, the rail-and-pane row, the pane's
 * column, the step's frame, the action bar's strip) is `wizard.css`'s
 * `.su-wiz-shell`, `.su-wiz-body`, `.su-wiz-main`, `.su-wiz-step-frame` and
 * `.su-wiz-footer`: paper lays the step out as a plain block (`print.css`, r3
 * E1), and a style object's `display` beats every stylesheet rule.
 */

/** The step's head: its number stamp and its title on one line, over the frame. */
export const stepHeadStyle = {
  alignItems: 'baseline',
  display: 'flex',
  gap: tokens.space[8],
  marginBottom: tokens.space[12],
} satisfies CSSProperties

/** The step's number: the ink Stamp (ruleset §5.1), at the title's size. */
export const stepNumberStyle = {
  flex: 'none',
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.extrabold,
  lineHeight: 1.05,
  padding: `${tokens.space[4]} ${tokens.space[8]} ${tokens.space[2]}`,
} satisfies CSSProperties

/** The title, in `.su-entity-compact__title`'s face. */
export const stepTitleStyle = {
  fontWeight: tokens.weight.extrabold,
  lineHeight: 1.05,
  color: tokens.color.ink,
  margin: 0,
  minWidth: 0,
  overflowWrap: 'break-word',
} satisfies CSSProperties
export const stepTitleCaps = capsLabel({ size: 'title', weight: 'inherit' })

/**
 * The step's paper body, a plain block (not the box's flex column): 20px in,
 * 8px on a phone, where a list needs the width (`.su-wiz-step-body`, wizard.css).
 */
export const STEP_BODY = 'su-wiz-step-body'

/** The gate's reason (`footerNote`) under the step's content, ruled off from it. */
export const stepNoteStyle = {
  borderTop: `${tokens.borderWidth.hairline} solid ${tokens.color.ink15}`,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  fontWeight: tokens.weight.semibold,
  margin: `${tokens.space[20]} 0 0`,
  paddingTop: tokens.space[12],
} satisfies CSSProperties

/** The Review step's keep-as-a-file row, ruled off under the build. */
export const keepRowStyle = {
  borderBottom: `${tokens.borderWidth.hairline} solid ${tokens.color.ink15}`,
  margin: `0 0 ${tokens.space[16]}`,
  paddingBottom: tokens.space[12],
} satisfies CSSProperties

/** The line under a step's title (signed out: saving needs a sign-in). */
export const tryNoteStyle = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  margin: `0 0 ${tokens.space[12]}`,
} satisfies CSSProperties

/** The action bar's prompt: one line over the bar, the footer's width. */
export const promptStyle = {
  alignSelf: 'stretch',
  borderBottom: `${tokens.borderWidth.hairline} solid ${tokens.color.ink15}`,
  justifyContent: 'center',
} satisfies CSSProperties
