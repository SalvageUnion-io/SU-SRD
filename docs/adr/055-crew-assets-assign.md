# ADR-055: Crew Assets Are Assigned, Never Claimed

Decided and built for 4.1.0, answering #1064.

- **Amends** [ADR-030](030-accounts-games-server-of-record.md) §2, §4, §5 and §6, in place.

### 1. Assign is the word and the grant

Inside a Game, a pilot's or mech's `ownerId` names the member it is
**assigned** to. The assigned member edits it; the rest of the crew reads it
(ADR-030 §5); nobody else writes it but by proposal (ADR-030 §4). On a shelf
`ownerId` is still plain ownership. "Claim", "pick up" and "offer to the crew"
are retired: the verbs are **Assign to me**, **Assign to** a member and
**Unassign**.

### 2. Who may assign

- **Any member** may assign a free (unassigned) pilot or mech to themselves:
  the roster's UNASSIGNED seal, and Play's **Assign and board** for a spare mech.
- **The table runner** (the Mediator, or the Organiser while nobody mediates)
  may assign any pilot or mech in the Game to any member, reassigning what
  somebody holds.
- **Its holder or the table runner** may unassign it.
- A player never takes what a crewmate holds.

Both are `convex/ownership.ts` (`assign`, `unassign`); every act lands in the
Change Log. Reassigning changes who edits, not what is on the sheet, so it needs
no proposal. The crawler stays communal (ADR-030 §5): it is never assigned.

### 3. A Game changing under an open page is not an error

A Game read a page keeps subscribed answers empty, never an error, to a caller
who is no longer a member, and a Mediator-only read to one who no longer
mediates (`membershipOrNull`, `mediatorOrNull` in `convex/model/permissions.ts`).
Leaving, removal, deletion and handing over reach an open page as an empty
read, not as a Workers Issue. Writes still refuse.

### Consequences

Renaming `ownership.claim` and `ownership.release` broke open tabs, so the
build floor was raised (ADR-042).
