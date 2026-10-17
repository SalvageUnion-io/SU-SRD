/**
 * How entities nest — the `entity-nesting` rule set of `tools/check-rule-sets.ts`.
 *
 * The incident: the nested-frames audit of 17 Oct 2026
 * (https://claude.ai/artifact/Lu1VzHVBbKJZ7pwkUbLozP). A `TitledBox`, an
 * entity Row and a Card head all draw the same cut-out head, and they stacked
 * up to four deep: eleven titled boxes inside the bay cards of one crawler
 * sheet, a framed card for every action at any depth (inside a Peek too), a
 * head-only Row wherever a card asked for its compact head. The canon now
 * has hard rules for it (ruleset §5, EDL E6; N1–N7), and three of them have a
 * shape in the source this set can see:
 *
 *   - **N2 header-only is a Token** (`head-only-token`) — an entity drawn as
 *     its head alone is a Token; a Row or Card keeps its body. The finding is
 *     a Row form (`<Row>`, `<Entity form="row">`) drawn inside an entity's own
 *     components (`components/referenceEntity/`, `components/entity/`, the
 *     form layer that defines the forms aside), and, while the card adapter
 *     (`ReferenceEntityCard`) can still draw a Row, every `extent="head"`
 *     that does not ask for the Token (`size="mini"`).
 *   - **N5 no titled box inside an entity** (`no-titled-box`) — a `TitledBox`,
 *     `Inset`, `InfoCutout`, `RecoveryPanel` or labelled `Callout` drawn in an
 *     entity's own components, or reaching a card's `expand` /
 *     `afterExtraContent` slot, directly, through a local (`{crew}`), or
 *     through a component that draws one (`NpcInset` → `Inset`).
 *   - **N3 nested actions** (`nested-card-level`) — the nested-group module
 *     (`NestedCards.tsx`: `InlineActions`, `NestedCardList`, `DroneCards`)
 *     draws a nested Card only for a Page's children (level 1); below it, a
 *     Token.
 *
 * ## Level 1 is spelled `onPage`
 *
 * A Page is level 0, so what it draws is level 1, where a compact Card, a Row
 * and a titled section (When Damaged on a bay's own page) are all fine. The
 * rule reads that from the code's own guard: an element under `onPage`
 * (`if (onPage)`, `host.onPage ? … :`, `onPage && …`), past an early
 * `if (nestsTokens(host)) return …`, or on a card with `presentation="page"`
 * is level 1. A dialog is level 0 again: whatever sits in a `*.Portal`, or
 * in a component that portals its children (`ModalShell`), is not inside the
 * entity that opened it.
 *
 * ## What it does not see
 *
 * Values that flow through props across files (a bay's `contents` prop
 * filled by the crawler sheet). And it reads no condition but the page: a
 * component that draws a titled box under any other (`side === 'mech'`)
 * counts as drawing it always, so a level-1 box and a nested block belong in
 * two components, not one switched by a prop. The runtime gate,
 * `apps/web/e2e/nesting-depth.e2e.ts`, measures what renders.
 *
 * Every rule is `zero`. The owner's call (2026-10-17) was strict gates with
 * nothing allowlisted, so `EXEMPTIONS` is empty; an entry needs a reason.
 */
import type { RuleSet } from '../lib/ruleEngine';
/** The card adapter: its head extent is the head-only form. */
export declare const ADAPTER = "apps/web/src/components/referenceEntity/card/ReferenceEntityCard.tsx";
/** The nested-group module: where a card decides how its children draw. */
export declare const NESTED_GROUPS = "apps/web/src/components/referenceEntity/card/NestedCards.tsx";
export declare const entityNesting: RuleSet;
