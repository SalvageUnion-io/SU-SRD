import { useState } from 'react'
import { Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { ConvexPending } from '../shared/ConvexPending'
import { ClaimLocalData } from './ClaimLocalData'
import { SignInControl } from './SignInControl'

/**
 * The account screen (D33): profile, your Games, export, delete.
 *
 * All four live on one page deliberately. Holding somebody's Discord identity
 * creates obligations — let me see it, let me correct it, let me take it away,
 * let me erase it — and splitting those across surfaces is how one of them
 * quietly never ships.
 *
 * As everywhere in this app, the Convex hooks are isolated behind a
 * build-time branch so a Solo build (no `VITE_CONVEX_URL`) renders without a
 * provider present.
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
  const games = useQuery(api.games.listMine, {})
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
      {/* First thing on the account page: an existing player's local roster is
          the most urgent thing to resolve after signing in. */}
      <ClaimLocalData />
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <Text as="label" className="font-cond text-xs font-bold tracking-widest uppercase">
            Display name
          </Text>
          <Text variant="hint" className="text-left">
            Shown on every entity you own. Defaults to your Discord name; clearing this falls back
            to it rather than to blank.
          </Text>
          <input
            aria-label="Display name"
            className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1"
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
        <div className="flex flex-col gap-2 p-4">
          <Text as="label" className="font-cond text-xs font-bold tracking-widest uppercase">
            Your games
          </Text>
          {games === undefined && <ConvexPending className="text-left" />}
          {games?.length === 0 && (
            <Text variant="hint" className="text-left">
              You are not in any games yet.
            </Text>
          )}
          {games?.map((g) => (
            <div key={g._id} className="flex items-baseline justify-between gap-3">
              <Text>{g.name}</Text>
              <Text variant="hint" className="text-left">
                {g.organizer ? 'Organizer · ' : ''}
                {g.mediator ? 'Mediator' : 'Player'} · {g.memberCount} member
                {g.memberCount === 1 ? '' : 's'}
              </Text>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 p-4">
          <Text as="label" className="font-cond text-xs font-bold tracking-widest uppercase">
            Your data
          </Text>
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
          <Text as="label" className="font-cond text-xs font-bold tracking-widest uppercase">
            Delete account
          </Text>
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

function AccountBody() {
  const { mode } = useConnection()

  if (mode === 'connected') return <SignedInAccount />

  if (mode === 'disconnected') {
    return (
      <Card>
        <div className="p-4">
          <Text>
            Your account is unreachable right now. Reconnect to change your profile or manage your
            games.
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text>
          You are playing solo. Everything you build is saved on this device and needs no account.
        </Text>
        <Text variant="hint" className="text-left">
          Signing in lets you join a game with other people and carry your builds between devices.
        </Text>
        <div>
          <SignInControl />
        </div>
      </div>
    </Card>
  )
}

export function AccountScreen() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <Text as="h1" className="font-cond text-2xl font-bold tracking-wide uppercase">
        Account
      </Text>
      {isConvexConfigured ? (
        <AccountBody />
      ) : (
        <Card>
          <div className="p-4">
            <Text>
              This build has no account service configured, so everything is saved on this device.
            </Text>
          </div>
        </Card>
      )}
    </main>
  )
}
