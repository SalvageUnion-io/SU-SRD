import { Button, Card, ChapterBand, FieldError, Input, PageHeading, Text } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { ConvexPending } from '../shared/ConvexPending'
import { SignInControl } from './SignInControl'

/**
 * The settings screen (ADR-030 §6), at `/settings`: profile, export, delete.
 *
 * `/account` redirects here (`routes/account.tsx`), so old links and the
 * Discord bot's still land. Your Games are listed in the masthead's Games menu
 * (`components/container/GamesMenu.tsx`), which is where a player picks what
 * the Roster shows.
 *
 * What remains lives on one page deliberately. Holding somebody's Discord
 * identity creates obligations — let me see it, let me correct it, let me take
 * it away, let me erase it — and splitting those across surfaces is how one of
 * them quietly never ships.
 */

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

const CARD_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: space[16],
} satisfies CSSProperties

const CARD_PAD = { padding: space[16] } satisfies CSSProperties

const ACTIONS = { display: 'flex', gap: space[8] } satisfies CSSProperties

// The hint variant centres; these asides read as body copy under a heading.
const HINT = { textAlign: 'left' } satisfies CSSProperties

const PAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  marginInline: 'auto',
  maxWidth: '42rem',
  padding: space[16],
} satisfies CSSProperties

function download(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
    <div style={STACK}>
      <Card>
        <div style={CARD_BODY}>
          <PageHeading variant="section" as="h2">
            Display name
          </PageHeading>
          <Text variant="hint" style={HINT}>
            Shown on every entity you own. Defaults to your Discord name; clearing this falls back
            to it rather than to blank.
          </Text>
          {/* No `Field` wrapper: the card's own h2 already reads "Display
              name", and a stamp repeating it on the input's seam would state
              the same label twice a line apart. */}
          <Input
            aria-label="Display name"
            value={value}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <Button
              variant="primary"
              size="compact"
              disabled={save.pending}
              onClick={() => void save.run({ displayName: value })}
            >
              {save.pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <FieldError>{save.error}</FieldError>
        </div>
      </Card>

      <Card>
        <div style={CARD_BODY}>
          <PageHeading variant="section" as="h2">
            Your data
          </PageHeading>
          <Text variant="hint" style={HINT}>
            Downloads everything you own. Crewmates' characters and the shared crawler are not
            included — you can see them, but they are not yours to take.
          </Text>
          <div>
            <Button
              variant="ghost"
              size="compact"
              disabled={exported === undefined}
              onClick={() => exported && download('cantina-account-export.json', exported)}
            >
              Download my data
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={CARD_BODY}>
          <PageHeading variant="section" as="h2">
            Delete account
          </PageHeading>
          <Text variant="hint" style={HINT}>
            Your pilots and mechs are deleted. Games you are in survive — the shared crawler stays,
            and if you organise a Game the role passes to the longest-standing member. Download your
            data first; this cannot be undone.
          </Text>
          <div>
            {confirming ? (
              <div style={ACTIONS}>
                <Button
                  variant="danger"
                  size="compact"
                  disabled={erase.pending}
                  onClick={() => void erase.run({})}
                >
                  {erase.pending ? 'Deleting…' : 'Permanently delete'}
                </Button>
                <Button
                  variant="ghost"
                  size="compact"
                  disabled={erase.pending}
                  onClick={() => {
                    erase.clearError()
                    setConfirming(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="danger" size="compact" onClick={() => setConfirming(true)}>
                Delete my account
              </Button>
            )}
          </div>
          <FieldError>{erase.error}</FieldError>
        </div>
      </Card>
    </div>
  )
}

function SettingsBody() {
  const { mode } = useConnection()

  if (mode === 'connected') return <SignedInAccount />

  if (mode === 'disconnected') {
    return (
      <Card>
        <div style={CARD_PAD}>
          <Text>
            Your account is unreachable right now. Reconnect to change your profile or download your
            data.
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div style={CARD_BODY}>
        <Text>
          You are not signed in. Signed out, {PRODUCT.name} is read-only: you can browse the Starter
          Set, but building anything needs an account.
        </Text>
        <Text variant="hint" style={HINT}>
          Signing in saves your builds to your account, carries them between devices, and lets you
          join a Game with other people.
        </Text>
        <div>
          <SignInControl />
        </div>
      </div>
    </Card>
  )
}

export function SettingsScreen() {
  return (
    <main style={PAGE}>
      <ChapterBand tone="cantina">Settings</ChapterBand>
      <SettingsBody />
    </main>
  )
}
