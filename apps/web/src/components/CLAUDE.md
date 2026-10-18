# components — the component library

Every React component the app renders: the static pages, their islands and the
Cantina's routes draw on this one folder.

## Key Facts

- **One barrel** - `index.ts` exports the public surface, named exports only ([ADR-011](../../../../docs/ARCHITECTURE.md#decisions))
- **Data-source agnostic** - atoms, containers, compositions, `entity/` and `referenceEntity/` import no stores or Convex; consumers inject behaviour via slot props ([ADR-010](../../../../docs/ARCHITECTURE.md#decisions)). Only product folders (`sheet/`, `games/`, …) wire data
- **Never rely on an import running code**: bundlers drop any module whose exports go unused ([dependencies](../../../../docs/ARCHITECTURE.md#dependencies))
- **Design intent:** [the origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) is the source of truth, its boards indexed in [sources.md](../../../../docs/design-system/sources.md); [`ruleset.md`](../../../../docs/design-system/ruleset.md) codifies it and yields where they disagree

## Styling

Rules: [`.claude/rules/styling.md`](../../../../.claude/rules/styling.md) (loads with any stylesheet or `design/` file).

## Contents

No roster here: the barrel, [`index.ts`](index.ts), is the public API and the only
list of exports — read it. The rules for that surface (what may be exported, what consumers may
import): [the UI library](../../../../docs/ARCHITECTURE.md#ui-library).

## Entity Display System

Forms per the [entity display language](../../../../docs/design-system/entity-display-language.md): Row, Tile, Token, Mention and Peek in `entity/`; Card and Page are `ReferenceEntityCard`.

Callers inject their renderers through **generic slot props** (`afterExtraContent`, `titleOverride`, …), so the display layer knows nothing about where it is drawn. The caller computes schema-specific overrides and passes them as generic slot props.

## Groups

**Folder = group:** a component lives in `components/<group>/` (`markdownSection/` counts as a Container; `referenceEntity/` aside). The groups are membership tests, not rosters:

- **Atoms** — a single presentational job and **no Salvage Union domain knowledge**. An atom may compose a lower atom (`Stat` composes `Text` + `Tooltip`); domain knowledge, not composition, makes a Composition (`StatusBadge` owns the condition vocabulary).
- **Containers** — content-agnostic wrappers / state shells that would make sense with entirely different content inside.
- **Compositions** — know about Salvage Union entities, or assemble atoms into a product surface.

Folders outside the three groups hold one product surface each (`sheet/`, `play/`, `wizard/`, …).

- **Name components for what they are** — no `-Display` / `-View` / `-Renderer` suffixes or redundant `Reference*` prefixes (`Stat`, never `StatDisplay`). **`ReferenceEntityCard` is a sanctioned exception — do not re-flag it:** `Reference*` marks the card over a `RefEntity`, distinct from the content-agnostic `Card` (see [`.claude/rules/display-system.md`](../../../../.claude/rules/display-system.md)). An exception's prefix must carry information the bare name loses; record any new one here.
- **Nothing lives only in a test.** A module whose only importers are tests ships in no app: delete it.

## Testing

`bun --filter web test src/components`; the app's one floor in `tools/run-coverage.ts` covers it.
