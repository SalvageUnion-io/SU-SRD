# ADR-038: Addressed Invites — by Discord Account and by Email

## Status

**Accepted.** Extends the invite amendment of
[ADR-030](ADR-030-accounts-games-server-of-record.md) — an invite already
carries a seat, a hand-out and an optional approval door; it may now also carry
an **address**. Bearer codes are unchanged and remain the default.

Built in three layers, each its own PR: the model and the invitee's side
(`convex/model/invites.ts`, `invites.redeem` / `decline` / `forMe`, the hub's
Invitations card); Discord (`/su invite @user`, verified by Discord's own
signature); email (Resend, from a Convex action).

## Context

Every invite was a code. The Organizer minted one, then delivered it by hand —
read aloud, pasted into a DM, posted in a channel — and anyone who held it
could spend it. That is the right tool for a table that is already sitting
together, and the wrong one for "I want Sam in this game": the Organizer has to
leave the app to deliver it, nothing records who it was for, a leaked code
seats whoever finds it, and Sam has no way to say no.

The product wants a formal invite: pick a person, the app delivers it, the
person accepts or declines.

## Decision

### 1. An address is a column on an invite, not a second invite system

`invites.target` is either `{ kind: 'discord', discordId, name? }` or
`{ kind: 'email', address?, masked }`. Absent is a bearer code. Everything else
— the preview, `redeem`, `seat()`, grants, approval, revoke, the redemption
log — is the same code path whichever door was used, for the reason ADR-030's
amendment gave for `seat()`: one implementation rather than two that drift.

Every door that mints goes through `model/invites.ts#mintInvite`. The doors
differ only in how they prove the Organizer (a Convex token; a Discord-signed
interaction), never in what an invite is.

An addressed invite is:

- **Single use, always.** It is for one person; a second use would be somebody
  else. The Organizer cannot override this.
- **Good for a week** by default (a bearer code: a fortnight). It has been
  delivered to the person directly, and a shorter life narrows the window a
  forwarded email stays good.
- **Declinable** — by its addressee, and only for an addressed invite: a bearer
  code may be meant for a whole table, and one person's no must not close it
  for the rest. Declining is terminal; revoked outranks declined.

### 2. Who may redeem

- **Discord** — only the account signed in with that snowflake, read from
  `authAccounts` exactly as `model/bot.ts#userByDiscordId` reads it the other
  way. The refusal names nobody. **Approval is never required**: Discord has
  proven who will redeem it, and the Organizer chose that person.
- **Email** — **whoever holds the link** (possession), not an address match. A
  player's Discord email is often not the address their friends know, or is
  not verified at all, and an address match would fail exactly the people the
  feature is for. Because a link can be forwarded, the Organizer keeps the
  approval toggle (off by default), and single use plus a week bounds the rest.

### 3. Discord: `/su invite @user`, attested by Discord, not asserted by the bot

The bot's bearer credential (`ITUN_BOT_SECRET`) **asserts** a Discord id; the
[bot-client doc](../architecture/discord-bot-game-client.md) §3 is explicit that
its holder can claim to be any linked player, and bounds the damage by what the
bot may do: read, record rolls, bind channels — and **never invent a
membership**. An invite command that trusted the asserted id would break that
bound: a leaked secret could pose as any Organizer and invite itself in.

So `/su invite` does not trust the bot. The bot forwards Discord's **signed
interaction** — the raw body, `X-Signature-Ed25519` and
`X-Signature-Timestamp` — and Convex verifies the signature against the
application's public key before it reads anything from the body. The
Organizer's id and the invitee's id are then **attested by Discord**. Convex
also rejects a stale timestamp and records the interaction id on the invite, so
a replayed or retried interaction finds its invite instead of minting another.
This is the bot-client doc's Option B, taken for the one operation that needs
it; the rest of `/bot/*` is unchanged.

The bot then DMs the invitee a link. A DM is **best effort** — Discord refuses
one when the bot and the invitee share no server, or the invitee has closed
their DMs — so failure is recorded on the invite (`delivery`), the Organizer is
told privately and given the link to pass on, and nothing is posted in the
channel on anyone's behalf.

**The DM is not the only way the invite arrives.** Because it is addressed to
an account, the hub shows it to the addressee in an **Invitations** card
(`invites.forMe`) the next time they open the app. A failed DM costs nothing.

### 4. Email: Resend, from a Convex action

The mutation that creates an email invite schedules an internal action that
calls Resend's REST API with plain `fetch` — no new dependency — and an
`Idempotency-Key` of the invite id, then writes the outcome back to
`delivery`. The invite row and the send are committed together: there is no
state where an email went out for an invite that does not exist.

Rejected:

- **Cloudflare Email Service** on the ITUN Worker. It needs no API key, but in
  October 2026 it is still beta, needs Workers Paid, and Convex would have to
  call the Worker over a new authenticated endpoint — a new shared secret
  anyway, and a send no longer scheduled atomically with the invite.
- **Postmark.** Same shape as Resend; nothing here needed its stricter
  transactional positioning.
- **The `@convex-dev/resend` component.** Queueing and batching solve a volume
  this feature will not have, at the cost of a dependency and component tables.

### 5. Privacy

- **What the invitee sees before accepting** is what a link holder always saw:
  the Game's name, who invited them, the seat, how many characters are waiting,
  the expiry. Never the crew, the members, or entity names — ADR-030 §5
  visibility begins at membership.
- **No address-book harvesting.** An Organizer types one email address at a
  time; a Discord invitee is picked with Discord's own `@user` option. No
  contact import, no guild member listing, no autocomplete across accounts.
- **An address is kept only while the invite is live.** It is cleared to its
  masked form (`s•••@example.com`) on redeem, decline, revoke and expiry, and
  is never shown unmasked, not even to the Organizer who typed it.
- **No tracking** — Resend's open and click tracking stay off.
- **A rate limit** on email invites per Organizer per day, so the app cannot be
  used as a relay to mail strangers.

### 6. Secrets

The Resend key lives **only** on the Convex deployment, as `RESEND_API_KEY`. It
is set through `op run` with a committed env file (`apps/itun/.env.op`) that
holds an `op://` reference and nothing else, piped to `convex env set` on stdin so it never
appears in `argv`, a transcript or shell history. The runbook is in
[accounts-and-games.md](../architecture/accounts-and-games.md). Discord needs no
new secret: the bot already holds `DISCORD_TOKEN`, and the application's public
key is public.

## Consequences

- **The app now holds third-party PII**: the address of somebody who has not
  signed up. Minimal retention (§5) is the answer, not a footnote.
- **Convex grows its first outbound call** (the email action) and its first
  Ed25519 verification. Both run in the default runtime; neither needs Node.
- **The bot's write surface grows by one operation**, and that operation is the
  one the bearer credential cannot reach on its own.
- An invitee who declines must ask for a new invite to change their mind. That
  is deliberate: a decline the Organizer can see is worth more than a decline
  that might quietly reverse.
