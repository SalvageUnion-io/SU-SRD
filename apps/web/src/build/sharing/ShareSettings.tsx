/**
 * ShareSettings — who can see one player thing, set where it stands: the
 * "Who can see it" answers (`WhoCanSee`), and, while it is Public, the link, a
 * copy button and a QR of it inside that answer's frame.
 *
 * One control for the five kinds a player can share (`lib/sharing/visibility.ts`).
 * Each answer writes as it is picked, server first:
 *
 *  - **A sheet** (pilot, mech, crawler, built NPC) switches `publicRead` with
 *    `publicSheet.setPublic` (ADR-032): "Public" sets it, the
 *    answer its container gives clears it. Whether it is public is read back
 *    from `publicSheet.get`, the query its public page reads, so the control
 *    and the page cannot disagree.
 *  - **A pattern** takes all three through `shelf.setPatternVisibility`, read
 *    back from `shelf.patternSharing`. Shared by link, it may also be shared
 *    with everyone on the Reference as Homebrew (`homebrew.setShared`, ADR-058).
 *
 * Either way the link is `/p/:kind/<name>-<short id>` (`shareSegment`): one
 * derived URL, so going back to a narrower answer revokes it everywhere at once.
 *
 * Connected-only, and the gate lives in the PARENT (`ShareStatusDialog`): these
 * components call `useQuery`/`useMutation`, which cannot be called
 * conditionally (Rules of Hooks), so returning null from inside would still run
 * them.
 */

import { useMutation, useQuery } from 'convex/react'
import { publicPath } from 'game-domain/entityKinds'
import { Copy } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  Button,
  CopiedIcon,
  CopiedStatus,
  Field,
  FieldError,
  Select,
  Stack,
  Switch,
  tokens,
  useCopied,
} from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import type { ShareKind, Visibility } from '../../lib/sharing/visibility'
import { patternChoices, sheetChoices, sheetVisibility } from '../../lib/sharing/visibility'
import { appUrl } from '../../lib/site'
import { buildSharingCopy } from '../../messages/build-sharing'
import { LinkQr } from './LinkQr'
import { WhoCanSee } from './WhoCanSee'

type ShareSettingsProps = {
  kind: ShareKind
  /** The app-level id: what the public route is addressed by. */
  appId: string
  /** Its name, the readable half of its short link (`shareSegment`). */
  name?: string
  /** A sheet's container: the Game it is in, or null on the shelf. Unused for a pattern. */
  gameId?: string | null
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

/** The answers' own hint (`Radio`'s description): every line under Public reads as one. */
const MUTED_CAPTION = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
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

/** The QR on the left, what goes with it on the right; the link along the bottom. */
const QR_ROW = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space[12],
} satisfies CSSProperties

const QR_SIDE = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

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
  name,
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
  // The answer the reader just pressed: the radio shows it while its write is
  // in flight, so a press is never a radio that does not move. The link below
  // still waits for the server's answer.
  const [asked, setAsked] = useState<Visibility | null>(null)

  const inGame = typeof gameId === 'string'
  const gameName = games?.find((g) => g._id === gameId)?.name ?? null
  // `undefined` is still loading; `null` is a real "not published".
  const value =
    published === undefined ? null : sheetVisibility({ isPublic: published !== null, inGame })

  return (
    <Stack gap={12}>
      <WhoCanSee
        name={`share-${kind}-${appId}`}
        choices={sheetChoices({ inGame, gameName })}
        value={busy && asked !== null ? asked : value}
        onChange={(next) => {
          setAsked(next)
          void share.run(next)
        }}
        disabled={busy}
        details={{
          link: (
            <ShareLink
              url={appUrl(publicPath(kind, appId, name))}
              clipboardWriter={clipboardWriter}
            />
          ),
        }}
      />
      {error !== null && <FieldError spaceAbove={8}>{error}</FieldError>}
    </Stack>
  )
}

/** A pattern: all three answers are its own, the crew one with a Game to name. */
function PatternShareSettings({ appId, name, clipboardWriter }: ShareSettingsProps) {
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
    <Stack gap={12}>
      <WhoCanSee
        name={`share-pattern-${appId}`}
        choices={patternChoices({ gameName: gameChoices.length > 0 ? gameName : null })}
        value={value}
        onChange={(next) => choose(next)}
        disabled={busy}
        details={{
          link: (
            <ShareLink
              url={appUrl(publicPath('pattern', appId, name))}
              clipboardWriter={clipboardWriter}
              aside={<ShareOnReference appId={appId} shared={mine?.homebrew === true} />}
            />
          ),
        }}
      >
        {value === 'game' && gameChoices.length > 1 && (
          <Field label={buildSharingCopy('whichGame')} htmlFor={`share-game-${appId}`}>
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
      {error !== null && <FieldError spaceAbove={8}>{error}</FieldError>}
    </Stack>
  )
}

/** A link-shared pattern's second opt-in: Homebrew on the Reference (ADR-058). */
function ShareOnReference({ appId, shared }: { appId: string; shared: boolean }) {
  const setShared = useMutation(api.homebrew.setShared)
  const write = useServerAction(
    (next: boolean) => setShared({ patternId: appId, shared: next }),
    SHARE_FAILURE
  )
  return (
    <Stack gap={4}>
      <div>
        <Switch checked={shared} disabled={write.pending} onClick={() => void write.run(!shared)}>
          {buildSharingCopy('shareOnReference')}
        </Switch>
      </div>
      <p style={QR_NOTE}>{buildSharingCopy('shareOnReferenceHint')}</p>
      {write.error !== null && <FieldError spaceAbove={8}>{write.error}</FieldError>}
    </Stack>
  )
}

/**
 * The public link while there is one: a QR of it on the left; on the right,
 * `aside` (a pattern's SRD switch) and the scan note, then the URL and its copy
 * button at the foot.
 */
function ShareLink({
  url,
  aside,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: {
  url: string
  aside?: ReactNode
  clipboardWriter?: (text: string) => Promise<void>
}) {
  const { copied, flash } = useCopied()
  const [error, setError] = useState<string | null>(null)

  async function copy(): Promise<void> {
    try {
      await clipboardWriter(url)
      setError(null)
      flash()
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <Stack gap={8}>
      {/*
        Passing a phone across a table is the actual use, so the QR needs no
        heading and no placeholder — it is simply there while there is a
        public link to encode.
      */}
      <div style={QR_ROW}>
        <LinkQr url={url} />
        <div style={QR_SIDE}>
          <Stack gap={8}>
            {aside}
            <p style={QR_NOTE}>{buildSharingCopy('scanToOpenOnAnother')}</p>
          </Stack>
          <div style={ROW}>
            <code style={URL_TEXT}>{url}</code>
            <Button
              size="compact"
              onClick={() => void copy()}
              aria-label={buildSharingCopy('copyPublicLink')}
              style={NO_SHRINK}
            >
              <CopiedIcon
                copied={copied}
                size="compact"
                icon={<Copy aria-hidden="true" size={tokens.iconSize.compact} />}
              />
            </Button>
            <CopiedStatus copied={copied} />
          </div>
        </div>
      </div>
      {error !== null && <FieldError spaceAbove={8}>{error}</FieldError>}
    </Stack>
  )
}
