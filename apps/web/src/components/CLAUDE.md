# components — the component library

Every React component the app renders. The barrel, [`index.ts`](index.ts), is
the public API and the only list of exports; its rules:
[the UI library](../../../../docs/ARCHITECTURE.md#ui-library).

- **Data-source agnostic:** atoms, containers, compositions, `entity/` and
  `referenceEntity/` import no stores or Convex; consumers inject behaviour
  through generic slot props (`afterExtraContent`, `titleOverride`, …). Only
  the areas and `shared/` wire data.
- **Never rely on an import running code:** bundlers drop a module whose
  exports go unused.
- **Design intent:** [the origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm)
  (boards: [sources.md](../../../../docs/design-system/sources.md)), codified by
  [`ruleset.md`](../../../../docs/design-system/ruleset.md); entity forms (Compact,
  index Compact, Mini, Mention, Peek in `entity/`; contentful forms and Page
  are `ReferenceEntityCard`) by the [EDL](../../../../docs/design-system/entity-display-language.md).

## Groups

Folder = group, and the groups are membership tests:

- **Atoms** — one presentational job, **no Salvage Union knowledge** (an atom may
  compose a lower atom; domain knowledge makes a Composition).
- **Containers** — content-agnostic wrappers and state shells.
- **Compositions** — know Salvage Union entities, or assemble a product surface.
- Other folders hold one shared surface each (`shared/`, …); an
  area's own surfaces live in it, and the library never imports an area.

Name components for what they are: no `-Display` / `-View` / `-Renderer`
suffixes or `Reference*` prefixes. **`ReferenceEntityCard` is the sanctioned
exception, do not re-flag it**; record any new one here. A module only tests
import ships nowhere: delete it.

Test: `bun --filter web test src/components`.
