# ADR-068: Play Is One Moment

Decided 2026-11-24 by Jrvs ("Build Play as a Discord Activity", the f3 "One
Moment" concept), for Play's one surface with two entry points, the web and
the Discord Activity. The screen answers one question: what are you doing
now?

- **Amends** [ADR-051](051-play-mode.md) §6: an action no longer resolves
  inline in its Mini. It lifts out of the Actions list onto the Moment.

### 1. The Moment

The Act pane's head is the Main display. It holds one beat at a time
(`moment.model.ts`'s ladder): the Stop Sign over everything, nothing lost
under it; then the beat you are in; then what the rules say you owe (a Heat
Check at the Heat Capacity); then Ready, the whole Actions list. Only your own
tap and the Stop Sign replace a beat. What is owed while you are in one waits.

A beat is a titled card in the colour of who acts (pilot, mech, a
companion's, heat red for what Heat owes), its step track across the top
(Activate, Roll, Push, Apply: done inked, the current one underlined), its
content, and its verbs docked at its foot in the same place at every step.

### 2. Nothing is locked

Below `lg` the Moment stands in the list's place and the list is one tap
behind it ("‹ List"), the beat keeping its step. From `lg` the list runs under
it, and beside it where the Act pane has room for two phone-wide columns.
An owed beat offers Not now, which parks it until it falls due again.
Destructive results stay the player's act (ADR-007).

### 3. The table's beats

With no beat of your own, the Table's Moment heads the Ready list: another
seat's beat from its Activate until its Apply, read-only, from what its seat
shares (`tableBeat`). It never replaces the list. Again heads the list with
the action you last finished, one tap, lifted out of its type's group.

The table's strip is the Next strip (as f3 has it, K15): what waits on you
(the Heat Check, a proposal, your turn) stays there, each with its button.

### 4. Put on the table

From the Play bar's ⋯ the Mediator puts one thing on the table: a tray NPC,
which the room keeps as its name and kind alone (never its numbers or
actions), or a roll table, whole and read-only. Every seat with no beat of its
own sees it on the Moment (`PlaySpotlight`), over the Table's Moment, until
the Mediator clears it. Hold is a word on every seat's strip; it blocks
nothing, and a beat in hand finishes.

The same sheet asks one seat for a roll: a seat holds one ask, served to it
and the Mediator alone. It is a ticket on that seat's strip whose one press
rolls the table from its Rolls and answers the ask (`useAskNotices`).

### 5. The Docket

The Mediator's Docket heads the Opposition: what the table waits on, as
tickets taken in any order (`docketOf`). Morale due and To act open that NPC;
Awaiting answer is a proposal not yet answered; a seat at its Heat Capacity
owes a Heat Check; Asked has Withdraw. With nothing waiting it takes no room.
It is read off what the Mediator's screen already holds, which the room
serves to no one else.

### 6. Opening it from Discord

`/su play` answers with Discord's own launch (LAUNCH_ACTIVITY), so the bot
sends no message. The app's Entry Point command (`entryPoint.ts`, `launch`)
is Discord's Activity button; Discord launches it, so it never reaches the
Worker, and `deploy-commands.ts` registers it beside `/su`. Both need
Activities turned on for the app in the Developer Portal.

A Game's `/su bind` also keeps its channel's category and server
(`channelBindings.ts`, migration 0012); a category holds one Game. The Activity
opens the Game bound in its launch channel's category, else the one bound to
the channel, else the server's only bound Game (`launchBinding`); the Worker
reads the category through the bot (`/relay/channel`). With none, the home
offers its Mediator or Organiser "Run it here", which binds that channel as
`/su bind` would, once Discord confirms the caller's Activity instance runs
there with them in it. The Activity cannot read Discord permissions, so that
tap rests on the Game role and that presence.
