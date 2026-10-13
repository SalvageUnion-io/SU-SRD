/**
 * ShareSettings — who can see one player thing, set where it stands: the
 * "Who can see it" answers (`WhoCanSee`), and, while anyone with the link may
 * read it, the link, a copy button and a QR of it.
 *
 * One control for the five kinds a player can share (`lib/sharing/visibility.ts`).
 * Each answer writes as it is picked, server first:
 *
 *  - **A sheet** (pilot, mech, crawler, built NPC) switches `publicRead` with
 *    `publicSheet.setPublic` (ADR-032): "Anyone with the link" sets it, the
 *    answer its container gives clears it. Whether it is public is read back
 *    from `publicSheet.get`, the query its public page reads, so the control
 *    and the page cannot disagree.
 *  - **A pattern** takes all three through `shelf.setPatternVisibility`, read
 *    back from `shelf.patternSharing`.
 *
 * Either way the link is `/p/:kind/:appId`: one derived URL, so going back to a
 * narrower answer revokes it everywhere at once.
 *
 * Connected-only, and the gate lives in the PARENT (`ShareStatusDialog`): these
 * components call `useQuery`/`useMutation`, which cannot be called
 * conditionally (Rules of Hooks), so returning null from inside would still run
 * them.
 */

import { Button, Field, FieldError, Select, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { appUrl } from '../../lib/appUrl'
import { useServerAction } from '../../lib/connection/useServerAction'
import type { ShareKind, Visibility } from '../../lib/sharing/visibility'
import {
  patternChoices,
  sharePath,
  sheetChoices,
  sheetVisibility,
} from '../../lib/sharing/visibility'
import { LinkQr } from './LinkQr'
import { WhoCanSee } from './WhoCanSee'

type ShareSettingsProps = {
  kind: ShareKind
  /** The app-level id: what the public route is addressed by. */
  appId: string
  /** A sheet's container: the Game it is in, or null on the shelf. Unused for a pattern. */
  gameId?: string | null
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const MUTED_CAPTION = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

const LINK_BLOCK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const ROW = { display: 'flex', alignItems: 'center', gap: tokens.space[8] } satisfies CSSProperties

const URL_TEXT = {
  ...MUTED_CAPTION,
  minWidth: 0,
  flex: '1 1 0%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const NO_SHRINK = { flexShrink: 0 } satisfies CSSProperties

const QR_ROW = { ...ROW, gap: tokens.space[12] } satisfies CSSProperties

const QR_NOTE = { ...MUTED_CAPTION, margin: 0 } satisfies CSSProperties

/** What a defect says; a refusal says the server's own words. */
const SHARE_FAILURE = { failure: 'That could not be saved. Try again.' }

export function ShareSettings(props: ShareSettingsProps) {
  return props.kind === 'pattern' ? (
    <PatternShareSettings {...props} />
  ) : (
    <SheetShareSettings {...props} kind={props.kind} />
  )
}

/** A pilot, mech, crawler or NPC: the container answers for the crew; the link is the switch. */
function SheetShareSettings({
  kind,
  appId,
  gameId = null,
  clipboardWriter,
}: ShareSettingsProps & { kind: Exclude<ShareKind, 'pattern'> }) {
  const setPublic = useMutation(api.publicSheet.setPublic)
  const published = useQuery(api.publicSheet.get, { kind, appId })
  const games = useQuery(api.games.listMine, gameId === null ? 'skip' : {})
  const share = useServerAction(
    (next: Visibility) => setPublic({ kind, appId, isPublic: next === 'link' }),
    SHARE_FAILURE
  )
  const { pending: busy, error } = share

  const inGame = typeof gameId === 'string'
  const gameName = games?.find((g) => g._id === gameId)?.name ?? null
  // `undefined` is still loading; `null` is a real "not published".
  const value =
    published === undefined ? null : sheetVisibility({ isPublic: published !== null, inGame })

  return (
    <div style={STACK}>
      <WhoCanSee
        name={`share-${kind}-${appId}`}
        choices={sheetChoices({ inGame, gameName })}
        value={value}
        onChange={(next) => void share.run(next)}
        disabled={busy}
      />
      {value === 'link' && (
        <ShareLink url={appUrl(sharePath(kind, appId))} clipboardWriter={clipboardWriter} />
      )}
      {error !== null && <FieldError className="su-sheet-share-error">{error}</FieldError>}
    </div>
  )
}

/** A pattern: all three answers are its own, the crew one with a Game to name. */
function PatternShareSettings({ appId, clipboardWriter }: ShareSettingsProps) {
  const setVisibility = useMutation(api.shelf.setPatternVisibility)
  const sharing = useQuery(api.shelf.patternSharing, {})
  const games = useQuery(api.games.listMine, {})
  const [pickedGame, setPickedGame] = useState<string | null>(null)
  const share = useServerAction(
    (next: Visibility, nextGame: string | null) =>
      setVisibility({
        patternId: appId,
        visibility: next,
        ...(next === 'game' && nextGame ? { gameId: nextGame as Id<'games'> } : {}),
      }),
    SHARE_FAILURE
  )
  const { pending: busy, error } = share

  const mine = sharing?.find((s) => s.appId === appId)
  const value = sharing === undefined ? null : (mine?.visibility ?? 'private')
  const gameChoices = games ?? []
  // The Game it is shared with first, then the one picked, then the first.
  const gameId = pickedGame ?? mine?.gameId ?? gameChoices[0]?._id ?? null
  const gameName = gameChoices.find((g) => g._id === gameId)?.name ?? mine?.gameName ?? null

  const choose = (next: Visibility, nextGame: string | null = gameId) =>
    void share.run(next, nextGame)

  return (
    <div style={STACK}>
      <WhoCanSee
        name={`share-pattern-${appId}`}
        choices={patternChoices({ gameName: gameChoices.length > 0 ? gameName : null })}
        value={value}
        onChange={(next) => choose(next)}
        disabled={busy}
      >
        {value === 'game' && gameChoices.length > 1 && (
          <Field label="Which Game" htmlFor={`share-game-${appId}`}>
            <Select
              id={`share-game-${appId}`}
              value={gameId ?? ''}
              onChange={(e) => {
                setPickedGame(e.target.value)
                choose('game', e.target.value)
              }}
            >
              {gameChoices.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </WhoCanSee>
      {value === 'link' && (
        <ShareLink url={appUrl(sharePath('pattern', appId))} clipboardWriter={clipboardWriter} />
      )}
      {error !== null && <FieldError className="su-sheet-share-error">{error}</FieldError>}
    </div>
  )
}

/** The public link while there is one: the URL, a copy button and a QR of it. */
function ShareLink({
  url,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: {
  url: string
  clipboardWriter?: (text: string) => Promise<void>
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy(): Promise<void> {
    try {
      await clipboardWriter(url)
      setError(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <div style={LINK_BLOCK}>
      <div style={ROW}>
        <code style={URL_TEXT}>{url}</code>
        <Button
          size="compact"
          onClick={() => void copy()}
          aria-label="Copy public link"
          style={NO_SHRINK}
        >
          {copied ? '✓' : '⧉'}
        </Button>
      </div>
      {/*
        Passing a phone across a table is the actual use, so the QR needs no
        heading and no placeholder — it is simply there while there is a public
        link to encode.
      */}
      <div style={QR_ROW}>
        <LinkQr url={url} />
        <p style={QR_NOTE}>Scan to open on another device.</p>
      </div>
      {error !== null && <FieldError className="su-sheet-share-error">{error}</FieldError>}
    </div>
  )
}
