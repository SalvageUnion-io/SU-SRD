# ADR-039: Addressed Invites — by Discord Account

## Status

**Accepted.** Extends the invite amendment of
[ADR-030](ADR-030-accounts-games-server-of-record.md) — an invite already
carries a seat, a hand-out and an optional approval door; it may now also carry
an **address**: one Discord account. Bearer codes are unchanged and remain the
default.

Built in two layers, each its own PR: the model and the invitee's side
(`convex/model/invites.ts`, `invites.redeem` / `decline` / `forMe`, the hub's
Invitations card), then `/su invite @user`, verified by Discord's own
signature.

## Context

Every invite was a code. The Organizer minted one, then delivered it by hand —
read aloud, pasted into a DM, posted in a channel — and anyone who held it
could spend it. That is the right tool for a table that is already sitting
together, and the wrong one for "I want Sam in this game": the Organizer has to
leave the app to deliver it, nothing records who it was for, a leaked code
seats whoever finds it, and Sam has no way to say no.

The product wants a formal invite: pick a person, the app delivers it, the
person accepts or declines. The audience already lives in Discord, and Discord
is the only way to sign in, so a person is picked by their Discord account.

## Decision

### 1. An address is a column on an invite, not a second invite system

`invites.target` is `{ kind: 'discord', discordId, name? }`; absent is a bearer
code. Everything else — the preview, `redeem`, `seat()`, grants, revoke, the
redemption log — is the same code path whichever door was used, for the reason
ADR-030's amendment gave for `seat()`: one implementation rather than two that
drift.

Both doors mint through `model/invites.ts#mintInvite`. They differ only in how
they prove the Organizer (a Convex token; a Discord-signed interaction), never
in what an invite is.

An addressed invite is:

- **Single use, always.** It is for one person; a second use would be somebody
  else. The Organizer cannot override this.
- **Good for a week** by default (a bearer code: a fortnight). It was delivered
  to the person directly and needs no fortnight of slack.
- **Declinable** — by its addressee, and only for an addressed invite: a bearer
  code may be meant for a whole table, and one person's no must not close it
  for the rest. Declining is terminal; revoked outranks declined.

### 2. Who may redeem

Only the account signed in with that snowflake, read from `authAccounts`
exactly as `model/bot.ts#userByDiscordId` reads it the other way. The refusal
names nobody. **Approval is never required**: Discord has proven who will
redeem it, and the Organizer chose that person.

### 3. `/su invite @user`, attested by Discord, not asserted by the bot

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

**At most one DM per invite per day.** Re-running `/su invite` on somebody who
already holds a live invite re-offers its link to the Organizer, but the bot
does not DM them again until a day after the last one was delivered — so the
command cannot be used to make the bot message a person on repeat.

**The DM is not the only way the invite arrives.** Because it is addressed to
an account, the hub shows it to the addressee in an **Invitations** card
(`invites.forMe`) the next time they open the app. A failed DM costs nothing.

### 4. Privacy

- **What the invitee sees before accepting** is what a link holder always saw:
  the Game's name, who invited them, the seat, how many characters are waiting,
  the expiry. Never the crew, the members, or entity names — ADR-030 §5
  visibility begins at membership.
- **No address-book harvesting.** An invitee is picked with Discord's own
  `@user` option. No contact import, no guild member listing, no autocomplete
  across accounts. Their handle is shown to the Organizer who picked them and
  to nobody else; the preview says only *that* an invite is addressed.

### 5. Secrets

None new. The bot already holds `DISCORD_TOKEN`, which sends the DM, and
`DISCORD_PUBLIC_KEY` — set on the Convex deployment for the signature check —
is the application's public key.

## Not adopted: email invites

Inviting by email address (Resend, from a Convex action; the link redeemed by
whoever holds it) was designed, built and dropped by the product owner in
favour of Discord only. It would have made the app the holder of addresses
belonging to people who never signed up, and given Convex its first outbound
email dependency, for an audience that is already on Discord. The design is in
the closed PR #1047; if it returns, `target` is where a second kind goes.

## Consequences

- **Convex gains its first Ed25519 verification**, in the default runtime; it
  needs no Node.
- **The bot's write surface grows by one operation**, and that operation is the
  one the bearer credential cannot reach on its own.
- An invitee who declines must ask for a new invite to change their mind. That
  is deliberate: a decline the Organizer can see is worth more than a decline
  that might quietly reverse.
