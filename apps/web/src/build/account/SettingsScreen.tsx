import type { CSSProperties, ReactNode } from 'react'
import { useRef, useState } from 'react'
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
import { useAccountExport, useMe, useUpdateProfile } from '../../lib/account/accountApi'
import { deleteAccount } from '../../lib/auth/session'
import { useServerAction } from '../../lib/connection/useServerAction'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { buildAccountCopy } from '../../messages/build-account'
import { useSync } from '../../replica/syncContext'
import { SignInControl } from './SignInControl'
import { useSignOut } from './useSignOut'

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
 * under a solid Slab stamp, one full-width row each: what it does, then the
 * button that does it, under the words, so you read before you press.
 *
 * What remains lives on one page deliberately. Holding somebody's Discord
 * identity creates obligations — let me see it, let me correct it, let me take
 * it away, let me erase it — and splitting those across surfaces is how one of
 * them quietly never ships.
 */

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

type SectionProps = { id: string; title: string; children: ReactNode }

/** One concern: its stamp, which also names the region, then its notes and controls. */
function Section({ id, title, children }: SectionProps) {
  return (
    <SlabSection as="h2" id={id} title={title} bodyStyle={BODY}>
      {children}
    </SlabSection>
  )
}

function SignedInAccount() {
  const me = useMe()
  const exported = useAccountExport()
  const save = useServerAction(useUpdateProfile(), {
    failure: 'Your display name could not be saved. Try again.',
  })
  const erase = useServerAction(deleteAccount, {
    failure: 'Your account could not be deleted. Try again.',
  })

  const [name, setName] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  // The words a failed deletion was given (`useServerAction`), for the dialog,
  // which holds the failure on itself (ruleset §3.1: destruction behind
  // `ConfirmDialog`).
  const eraseFailure = useRef('')
  const signOut = useSignOut()

  if (me === undefined) return <Pending label={buildAccountCopy('yourAccount')} />
  if (me === null)
    return <EmptyState variant="quiet" body={buildAccountCopy('noAccountIsHeldFor')} />

  const value = name ?? me.displayName ?? ''

  return (
    <Stack gap={32}>
      <Section id="settings-name" title={buildAccountCopy('displayName')}>
        {/* No `Field` wrapper: the stamp already reads "Display name". A blank
            name falls back to the Discord one, which the placeholder says. */}
        <Cluster gap={8}>
          <Input
            aria-label={buildAccountCopy('displayName')}
            placeholder={buildAccountCopy('yourDiscordName')}
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
            {save.pending ? buildAccountCopy('saving') : buildAccountCopy('save')}
          </Button>
        </Cluster>
        <FieldError>{save.error}</FieldError>
      </Section>

      <Section id="settings-data" title={buildAccountCopy('yourData')}>
        <Text variant="hint" style={NOTE}>
          {buildAccountCopy('everythingYouOwnCrewmatesCharacters')}
        </Text>
        <Cluster gap={8}>
          <Button
            className={ACTION}
            disabled={exported === undefined}
            onClick={() => exported && download('salvageunion-account-export.json', exported)}
          >
            {buildAccountCopy('downloadMyData')}
          </Button>
        </Cluster>
      </Section>

      <Section id="settings-delete" title={buildAccountCopy('deleteAccount')}>
        <Text variant="hint" style={NOTE}>
          {buildAccountCopy('deletesYourPilotsAndMechs')}
        </Text>
        <Cluster gap={8}>
          <Button variant="primary" className={ACTION} onClick={() => setConfirming(true)}>
            {buildAccountCopy('deleteMyAccount')}
          </Button>
        </Cluster>
        <ConfirmDialog
          open={confirming}
          onOpenChange={(open) => {
            if (!open) erase.clearError()
            setConfirming(open)
          }}
          title={buildAccountCopy('deleteYourAccount')}
          tone="danger"
          body={buildAccountCopy('everythingYouOwnIsDeleted')}
          confirmLabel={buildAccountCopy('permanentlyDelete')}
          pendingLabel={buildAccountCopy('deleting')}
          onConfirm={async () => {
            const result = await erase.run()
            if (!result.ok) {
              eraseFailure.current = result.error
              throw new Error('The account was not deleted')
            }
            // The Worker ended every session with the account; this clears the
            // device's hint as any sign-out does.
            await signOut()
          }}
          describeError={() => eraseFailure.current}
        />
      </Section>
    </Stack>
  )
}

function SettingsBody() {
  const { status } = useSync()

  if (status === 'live') return <SignedInAccount />

  if (status === 'offline') {
    return <EmptyState variant="quiet" body={buildAccountCopy('yourAccountIsUnreachableRight')} />
  }

  return (
    <EmptyState
      variant="quiet"
      body={buildAccountCopy('youAreNotSignedIn')}
      action={<SignInControl />}
    />
  )
}

export function SettingsScreen() {
  return (
    <PageShell
      measure={PAGE_MEASURE}
      stack={false}
      band={
        <ChapterBand tone="ink" measure={PAGE_MEASURE}>
          {buildAccountCopy('settings')}
        </ChapterBand>
      }
    >
      <SettingsBody />
    </PageShell>
  )
}
