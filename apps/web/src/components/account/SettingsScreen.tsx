import { PRODUCT } from 'cantina-domain/product'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { Button, ChapterBand, EmptyState, FieldError, Input, Slab, Text, tokens } from '../index'
import { ConvexPending } from '../shared/ConvexPending'
import { SignInControl } from './SignInControl'

/**
 * The settings screen (ADR-030 §6), at `/settings`: profile, export, delete.
 *
 * `/account` redirects here (`routes/account.tsx`), so old links and the
 * Discord bot's still land. Your Games are listed in the masthead's Games menu
 * (`components/entityContainer/GamesMenu.tsx`), which is where a player picks what
 * the Roster shows.
 *
 * It wears the Hangar's clothes (`components/shelves/Shelves.tsx`): the ink
 * band on the workshop ground, the 75rem column, and each concern a section
 * under a solid Slab stamp, one full-width row each.
 *
 * What remains lives on one page deliberately. Holding somebody's Discord
 * identity creates obligations — let me see it, let me correct it, let me take
 * it away, let me erase it — and splitting those across surfaces is how one of
 * them quietly never ships.
 */

const MEASURE = '75rem'

const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100%',
  paddingBottom: tokens.space[48],
} satisfies CSSProperties

// Its side padding and centring are `.su-page-column`'s, as on the Hangar.
const BODY = {
  maxWidth: MEASURE,
  paddingTop: tokens.space[20],
} satisfies CSSProperties

/** One row per concern, full width (owner's call, 2026-10-15). */
const ROWS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
} satisfies CSSProperties

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

// The slab's own foot margin would double the section's gap.
const SLAB = { marginBottom: tokens.space[4] } satisfies CSSProperties

const NOTE = { margin: 0, textAlign: 'left' } satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

const GROW = { flex: '1 1 12rem', maxWidth: '24rem', minWidth: 0 } satisfies CSSProperties

/** The Hangar's action type: uppercase display face at page-action height. */
const ACTION = 'su-shelves-action'

function download(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type SectionProps = { id: string; title: string; children: ReactNode }

/** One concern: its stamp, which also names the region, then its controls. */
function Section({ id, title, children }: SectionProps) {
  return (
    <section aria-labelledby={id} style={SECTION}>
      <Slab variant="solid" as="h2" id={id} label={title} style={SLAB} />
      {children}
    </section>
  )
}

function SignedInAccount() {
  const me = useQuery(api.account.me, {})
  const exported = useQuery(api.account.exportMine, {})
  const save = useServerAction(useMutation(api.account.updateProfile), {
    failure: 'Your display name could not be saved. Try again.',
  })
  const erase = useServerAction(useMutation(api.account.deleteAccount), {
    failure: 'Your account could not be deleted. Try again.',
  })

  const [name, setName] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (me === undefined) return <ConvexPending label="your account" />
  if (me === null) return <Text>No account found.</Text>

  const value = name ?? me.displayName ?? ''

  return (
    <div style={ROWS}>
      <Section id="settings-name" title="Display name">
        {/* No `Field` wrapper: the stamp already reads "Display name". A blank
            name falls back to the Discord one, which the placeholder says. */}
        <div style={ROW}>
          <Input
            aria-label="Display name"
            placeholder="Your Discord name"
            style={GROW}
            value={value}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="primary"
            className={ACTION}
            disabled={save.pending}
            onClick={() => void save.run({ displayName: value })}
          >
            {save.pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <FieldError>{save.error}</FieldError>
      </Section>

      <Section id="settings-data" title="Your data">
        <Text variant="hint" style={NOTE}>
          Everything you own. Crewmates' characters and shared crawlers are theirs.
        </Text>
        <div style={ROW}>
          <Button
            className={ACTION}
            disabled={exported === undefined}
            onClick={() => exported && download('cantina-account-export.json', exported)}
          >
            Download my data
          </Button>
        </div>
      </Section>

      <Section id="settings-delete" title="Delete account">
        <Text variant="hint" style={NOTE}>
          Deletes your pilots and mechs. Games you are in survive: their crawler stays, and one you
          organise passes to its longest-standing member. This cannot be undone.
        </Text>
        <div style={ROW}>
          {confirming ? (
            <>
              <Button
                variant="danger"
                className={ACTION}
                disabled={erase.pending}
                onClick={() => void erase.run({})}
              >
                {erase.pending ? 'Deleting…' : 'Permanently delete'}
              </Button>
              <Button
                variant="ghost"
                className={ACTION}
                disabled={erase.pending}
                onClick={() => {
                  erase.clearError()
                  setConfirming(false)
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" className={ACTION} onClick={() => setConfirming(true)}>
              Delete my account
            </Button>
          )}
        </div>
        <FieldError>{erase.error}</FieldError>
      </Section>
    </div>
  )
}

function SettingsBody() {
  const { mode } = useConnection()

  if (mode === 'connected') return <SignedInAccount />

  if (mode === 'disconnected') {
    return (
      <EmptyState
        variant="quiet"
        body="Your account is unreachable right now. Reconnect to change your settings."
      />
    )
  }

  return (
    <EmptyState
      variant="quiet"
      body={`You are not signed in. Signed out, ${PRODUCT.name} is read-only: building anything needs an account.`}
      action={<SignInControl />}
    />
  )
}

export function SettingsScreen() {
  return (
    <main style={PAGE}>
      <ChapterBand tone="ink" measure={MEASURE}>
        Settings
      </ChapterBand>
      <div className="su-page-column" style={BODY}>
        <SettingsBody />
      </div>
    </main>
  )
}
