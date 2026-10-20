import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  Button,
  ChapterBand,
  Cluster,
  ConfirmDialog,
  EmptyState,
  FieldError,
  Input,
  PageShell,
  Pending,
  SlabSection,
  Stack,
  Text,
  tokens,
} from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { SignInControl } from './SignInControl'

/**
 * The settings screen (ADR-030 §6), at `/settings`: profile, export, delete.
 *
 * `/account` redirects here (`routes/account.tsx`), so old links and the
 * Discord bot's still land. Your Games are listed in Play: its hub and its
 * Games menu (`build/entityContainer/GamesMenu.tsx`), each opening a Game's
 * page (ADR-052 §4).
 *
 * It wears the Training Bay's clothes (`build/shelves/Shelves.tsx`): the ink
 * band on the workshop ground, the 75rem column, and each concern a section
 * under a solid Slab stamp, one full-width row each, its action a chip on the
 * stamp's rule as a shelf's "+ New" is.
 *
 * What remains lives on one page deliberately. Holding somebody's Discord
 * identity creates obligations — let me see it, let me correct it, let me take
 * it away, let me erase it — and splitting those across surfaces is how one of
 * them quietly never ships.
 */

const MEASURE = '75rem'

/** A concern's controls and notes, 12px apart under its stamp. */
const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const NOTE = { margin: 0, textAlign: 'left' } satisfies CSSProperties

const GROW = { flex: '1 1 12rem', maxWidth: '24rem', minWidth: 0 } satisfies CSSProperties

/** The Training Bay's action type: uppercase display face at page-action height. */
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

type SectionProps = { id: string; title: string; actions?: ReactNode; children: ReactNode }

/**
 * One concern: its stamp, which also names the region, its action a chip on
 * the stamp's rule, then its controls and notes.
 */
function Section({ id, title, actions, children }: SectionProps) {
  return (
    <SlabSection as="h2" id={id} title={title} actions={actions} bodyStyle={BODY}>
      {children}
    </SlabSection>
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
  // The words a failed deletion was given (`useServerAction`), for the dialog,
  // which holds the failure on itself (ruleset §3.1: destruction behind
  // `ConfirmDialog`).
  const eraseFailure = useRef('')

  if (me === undefined) return <Pending label="your account" />
  if (me === null) return <EmptyState variant="quiet" body="No account is held for this sign-in." />

  const value = name ?? me.displayName ?? ''

  return (
    <Stack gap={32}>
      <Section id="settings-name" title="Display name">
        {/* No `Field` wrapper: the stamp already reads "Display name". A blank
            name falls back to the Discord one, which the placeholder says. */}
        <Cluster gap={8}>
          <Input
            aria-label="Display name"
            placeholder="Your Discord name"
            style={GROW}
            value={value}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="primary"
            size="full"
            className={ACTION}
            disabled={save.pending}
            onClick={() => void save.run({ displayName: value })}
          >
            {save.pending ? 'Saving…' : 'Save'}
          </Button>
        </Cluster>
        <FieldError>{save.error}</FieldError>
      </Section>

      <Section
        id="settings-data"
        title="Your data"
        actions={
          <Button
            size="mini"
            disabled={exported === undefined}
            onClick={() => exported && download('salvageunion-account-export.json', exported)}
          >
            Download my data
          </Button>
        }
      >
        <Text variant="hint" style={NOTE}>
          Everything you own. Crewmates' characters and shared crawlers are theirs.
        </Text>
      </Section>

      <Section
        id="settings-delete"
        title="Delete account"
        actions={
          <Button variant="primary" size="mini" onClick={() => setConfirming(true)}>
            Delete my account
          </Button>
        }
      >
        <Text variant="hint" style={NOTE}>
          Deletes your pilots and mechs. Games you are in survive: their crawler stays, and one you
          organise passes to its longest-standing member. This cannot be undone.
        </Text>
        <ConfirmDialog
          open={confirming}
          onOpenChange={(open) => {
            if (!open) erase.clearError()
            setConfirming(open)
          }}
          title="Delete your account?"
          tone="danger"
          body="Everything you own is deleted for good. The Games you are in carry on without you. This cannot be undone."
          confirmLabel="Permanently delete"
          pendingLabel="Deleting…"
          onConfirm={async () => {
            const result = await erase.run({})
            if (!result.ok) {
              eraseFailure.current = result.error
              throw new Error('The account was not deleted')
            }
          }}
          describeError={() => eraseFailure.current}
        />
      </Section>
    </Stack>
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
      body={`You are not signed in. Signed out, the app is read-only: building anything needs an account.`}
      action={<SignInControl />}
    />
  )
}

export function SettingsScreen() {
  return (
    <PageShell
      measure={MEASURE}
      stack={false}
      band={
        <ChapterBand tone="ink" measure={MEASURE}>
          Settings
        </ChapterBand>
      }
    >
      <SettingsBody />
    </PageShell>
  )
}
