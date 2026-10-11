import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useConnection } from '../../lib/connection/connectionContext'
import { AppLink } from './AppLink'

/**
 * SiteFooter — About and Changelog for a signed-out desktop.
 *
 * Those two live at the drawer's foot (issue 1255) and, signed in, in the
 * account menu. From `lg` up the drawer is gone, and signed out there is no
 * account menu, so without this a desktop visitor could reach neither. The
 * bar never carries them (board 09), so they sit at the page's foot instead.
 * Phones have the drawer, and a signed-in desktop the account menu, so this
 * renders nothing there.
 */

const FOOT = {
  borderTop: `${tokens.borderWidth.hairline} solid ${tokens.color.ink}`,
  display: 'flex',
  gap: tokens.space[20],
  justifyContent: 'center',
  marginTop: tokens.space[48],
  padding: `${tokens.space[16]} ${tokens.space[24]}`,
} satisfies CSSProperties

const LINK = {
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

export function SiteFooter() {
  const { mode } = useConnection()
  const desktop = useIsDesktop()
  // The account menu carries both while signed in (online or not).
  if (!desktop || mode === 'connected' || mode === 'disconnected') return null
  return (
    <footer style={FOOT}>
      <AppLink href="/about" style={LINK}>
        About
      </AppLink>
      <AppLink href="/changelog" style={LINK}>
        Changelog
      </AppLink>
    </footer>
  )
}
