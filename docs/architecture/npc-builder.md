# NPC Builder

A built **NPC** is ITUN's fourth owned entity, beside pilots, mechs and
crawlers: anyone designs one, keeps it on their shelf, takes it into a Game,
and can crew a crawler's slots with it. The decisions are
[ADR-043](../ARCHITECTURE.md#adr-043); this page is the model and the
surfaces. It began as the plan in issue 1269 and the design in issue 1277
(boards N1 and N2 of [the origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm)).

> **Status.** Built on the `design-refresh` branch. Every decision marked
> **(owner to confirm)** below was made by the design lead and waits on the
> product owner.

Read alongside [ADR-030](../ARCHITECTURE.md#adr-030) (containers and
ownership), [ADR-034](../ARCHITECTURE.md#adr-034) (Convex is the only source
of truth), [ADR-037](../ARCHITECTURE.md#adr-037) (assignments) and
[ADR-007](../ARCHITECTURE.md#adr-007) (the automation boundary).

## 1. The record

`apps/itun/src/lib/schemas/npc.ts`. The data has two NPC shapes and a built
NPC combines them: the stat block takes the standalone `npcs` entity's names
(`hitPoints`, `damageType`, `actions`, `traits`, `bioSalvageValue`), the
identity takes a crawler crew member's (`name`, `position`, `description`,
`keepsake`, `motto`, `facts`). `choiceValues` holds a crew slot's other
choices by name (today only the Augmented A.I.'s "A.I. Personality"; D3).
`templateRef` says where it started; nothing re-derives from it.

- **Refs, never copies.** An action is its slug (Q3: "a stored ref is a slug,
  and only a slug"); a trait is the package's `{ type, amount? }`. A
  template's prose is never copied into `description` (D5).
- **Owned like a pilot.** The Convex `npcs` table has the pilot columns
  (`gameId`, `ownerId`, `appId`, `publicRead`, `body`, `updatedAt`); writes go
  through `entities.upsertByAppId` and `removeByAppId`; `listMine`,
  `listForGame` and the change log carry it; a deleted Game shelves it with
  its owner. It is never an `encounterNpcs` row (Q5).
- **Down** is max HP ≥ 1 and current 0: shown, never acted on. An NPC with
  max 0 (the Augmented A.I.) is never down (D2).

`apps/itun/src/lib/npcs/npcModel.ts` reads it against the reference: the NPC
as an `npcs` entity for `ReferenceEntityCard`, its kicker ("NPC · from
Veteran"), a crawler's crew slots, and who fills them.

## 2. Assignment: `npc-to-crawler`

The slot is on the link, not the NPC, so one record cannot drift from
another **(Q1, owner to confirm)**: `{ kind: 'bay', bayRef }` or
`{ kind: 'type' }`, required on this link type and refused on the other
three. An NPC fills one slot; a slot holds one NPC (`conflictsWith` in
`apps/itun/src/lib/links/linkRules.ts`).

- **Authorised by the crawler** (D7, owner to confirm): its owner on a shelf,
  the table runner in a Game. A player offers an NPC by moving it into the
  Game; the Mediator assigns it.
- **Replace, never overwrite** (Q2, owner to confirm): a linked slot renders
  the NPC read-only in place of the inline crew. Nothing writes
  `crawlerBays[].npc*` or `bayChoices` while it is linked, so unlinking
  restores the inline crew byte for byte.
- Moving the NPC out of the Game prunes the link; deleting it cascades.
  Either way the slot falls back to the book's crew line.
- A crawler listing the same bay twice can crew only the first.

## 3. Surfaces

| Surface | Where | What |
| --- | --- | --- |
| Designer (N1) | `/npcs/new?view=any`, `apps/itun/src/components/npc/AnyNpcDesigner.tsx` | Template → Stats → Actions & traits → Identity → Review, with a live preview |
| Crew board (N2) | `/npcs/new?view=crew&crawler=&slot=`, `apps/itun/src/components/npc/CrewBoard.tsx` | The type's slot and one per bay; design, assign, unassign |
| Sheet | `/sheet/npc/:id`, `apps/itun/src/components/npc/NpcSheet.tsx` | The user-made card, the identity panel, move and delete |
| Roster | My Stuff's fourth column | NPC rows, dashed and stamped User-made |
| Crawler sheet | bay cards and the type card | a linked slot shows its NPC; the Bays section links to the crew board |

- **Template (D4, owner to confirm).** A reference NPC from `npcs.json`, or a
  **Start blank** tile inside the designer — not a separate Blank mode, so a
  blank NPC can still pick its actions. It fills Stats and Actions & traits
  and keeps Identity; changing it asks first only if those were edited.
- **Actions & traits (D6).** Each is a header-only reference card with a
  checkbox, opening its rules in the detail modal; one search adds more. A
  trait's amount comes only from a template. Zero actions is allowed.
- **Gates.** Any NPC: a name and HP ≥ 1. Crew: a name; position and HP are
  the slot's (D2).
- **Roll (D1).** Only where a choice's data has a table (`source.kind:
  'table'`): today the Augmented A.I.'s personality. Bay Keepsake and Motto
  are plain text, so they get no Roll until a rules-checked data change.
- **Bands (D9).** Any NPC on the Denizens navy, crew on the crawler band;
  both solid. The NPC's own page has the hatched user-made band.
- **Where NPCs live (D10, owner to confirm).** A fourth roster column until
  the Shelves redesign replaces it with its NPC shelf.

The designer's draft persists through `apps/itun/src/lib/wizard/wizardDraft.ts`;
its form is `apps/itun/src/lib/wizard/npcFormState.ts` and a crew slot's is
`apps/itun/src/lib/wizard/crewFormState.ts`.

## 4. Storage modes

| Mode | Designer | Crew board and bay cards |
| --- | --- | --- |
| Solo | the sign-in panel | crawler sheets are empty |
| Connected | as designed | as designed |
| Disconnected or Outdated | opens; saving is blocked (`WritesBlockedNotice`) | read-only; no Design, Assign or Unassign |

Another member's NPC in a Game is read live from `listForGame`, never cached;
a link whose NPC cannot be read shows the inline crew with an "Assigned NPC
unavailable" badge.

## 5. Phone and accessibility

Below 48rem the step strip is one line ("3 / 5 · Actions & traits"), Back and
Next stick to the bottom, the preview opens from a Preview button, and a crew
slot opens in a full-height modal. The mode toggle is a tab list; each
checkbox and repeated button names what it acts on ("Carry Green Laser Rifle
(Veteran)", "Unassign Doc Ambrose from Med Bay"); the open slot carries
`aria-current`; a Roll result is announced once, politely.

## 6. Later

The public NPC sheet and link previews; the Shelves NPC shelf; NPCs on a
Game's roster; editing the stat block on the sheet, and conditions; bay and
type templates in Any NPC; editing a linked NPC inside its bay card;
duplicate-bay slots; Roll for bay Keepsake and Motto; a pilot's recruit or
companion (Q4); built NPCs in the Mediator's tray (Q5); the Discord bot and
the Dashboard.

The Gate's end-to-end test is `apps/itun/e2e/npc-crew.e2e.ts`; the server
rules are pinned in `apps/itun/test/convex/npcs.test.ts`.
