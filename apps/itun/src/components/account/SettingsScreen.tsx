import { Button, Card, Input, PageHeading, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
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
  const updateProfile = useMutation(api.account.updateProfile)
  const deleteAccount = useMutation(api.account.deleteAccount)

  const [name, setName] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (me === undefined) return <ConvexPending label="your account" />
  if (me === null) return <Text>No account found.</Text>

  const value = name ?? me.displayName ?? ''

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <PageHeading variant="section" as="h2">
            Display name
          </PageHeading>
          <Text variant="hint" className="text-left">
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
              onClick={() => void updateProfile({ displayName: value })}
            >
              Save
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 p-4">
          <PageHeading variant="section" as="h2">
            Your data
          </PageHeading>
          <Text variant="hint" className="text-left">
            Downloads everything you own. Crewmates' characters and the shared crawler are not
            included — you can see them, but they are not yours to take.
          </Text>
          <div>
            <Button
              variant="ghost"
              size="compact"
              disabled={exported === undefined}
              onClick={() => exported && download('itun-account-export.json', exported)}
            >
              Download my data
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 p-4">
          <PageHeading variant="section" as="h2">
            Delete account
          </PageHeading>
          <Text variant="hint" className="text-left">
            Your pilots and mechs are deleted. Games you are in survive — the shared crawler stays,
            and if you organise a game the role passes to the longest-standing member. Download your
            data first; this cannot be undone.
          </Text>
          <div>
            {confirming ? (
              <div className="flex gap-2">
                <Button variant="danger" size="compact" onClick={() => void deleteAccount({})}>
                  Permanently delete
                </Button>
                <Button variant="ghost" size="compact" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="danger" size="compact" onClick={() => setConfirming(true)}>
                Delete my account
              </Button>
            )}
          </div>
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
        <div className="p-4">
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
      <div className="flex flex-col gap-3 p-4">
        <Text>
          You are not signed in. Signed out, In the Union Now is read-only: you can browse the
          Starter Set, but building anything needs an account.
        </Text>
        <Text variant="hint" className="text-left">
          Signing in saves your builds to your account, carries them between devices, and lets you
          join a game with other people.
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <PageHeading className="w-fit">Settings</PageHeading>
      <SettingsBody />
    </main>
  )
}
