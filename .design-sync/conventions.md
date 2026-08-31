# Building with the Salvage Union component library

Warm paper, black ink, rust for action. Everything is a printed workshop
document — cards have hard borders and stamped labels, never soft shadows.

## 1. Wrap in the data provider, or entity components render blank

Almost every component here reads the Salvage Union reference dataset, which
loads asynchronously. Before it resolves, every data method throws and the
component renders **nothing at all** — silently blank, not an error.

```jsx
const { SalvageUnionDataProvider, ReferenceEntityCard, SalvageUnionReference } = window.SalvageUnion

function Page() {
  return (
    <SalvageUnionDataProvider>
      <Catalog />
    </SalvageUnionDataProvider>
  )
}

// Read the ORM inside a component body — never at module top level, which runs
// before the provider has resolved.
function Catalog() {
  const chassis = SalvageUnionReference.Chassis.all()
  return chassis.map((c) => <ReferenceEntityCard key={c.id} data={c} size="medium" extent="catalog" />)
}
```

`SalvageUnionDataProvider` renders nothing until the data is ready (pass
`fallback` for a loading state). It adds no layout, background or font — the page
owns those.

`SalvageUnionReference` is on the global too. Its models: `Chassis`, `Systems`,
`Modules`, `Equipment`, `Abilities`, `Classes`, `Crawlers`, `CrawlerBays`,
`Actions`, `NPCs`, `Creatures`, `BioTitans`, `Drones`, `Vehicles`, `Squads`,
`Traits`, `Keywords`, `RollTables`, `Guides`, `Factions`, `Meld`, `Distances`,
`Sources`, `TechLevels`, `CatalogCategories`, `CrawlerTechLevels`,
`AbilityTreeRequirements`. Each has `.all()` and `.find()`.

## 2. Two card shells — pick the right one

- **`ReferenceEntityCard`** renders SRD game data. Give it `data={entity}` and it
  derives everything — tone, stat bar, nested entities, citation. Do not
  hand-build entity markup.
  `size`: `large | medium | small`. `extent`: `full | head | catalog`.
  `size="small" extent="head"` is the one-line token; `extent="catalog"` is the
  index tile; `extent="head"` is the listing row.
- **`Card`** is the generic four-band shell for everything else: `headerContent`
  (required), optional `subHeader`/`stats`, body children, optional
  `footMeta`/`footerContent`.

They are deliberately not merged.

## 3. Styling idiom — Tailwind utilities, from a fixed palette

Style with utility classes. The stylesheet ships a **closed** set built from this
system's tokens; a Tailwind class outside it will not resolve, so use these
families rather than inventing values.

| Family | Real values |
|---|---|
| Ground | `bg-paper` `bg-ink` `bg-ink-deep` `bg-band-cream` `bg-wk-bg` `bg-wk-bg-2` `bg-ink-2` |
| Ontology tone | `bg-mech` `bg-pilot` `bg-crawler` `bg-adversary` `bg-pilot-light` (+ `text-`/`border-`) |
| Action / status | `bg-rust` `bg-status-ok` `bg-status-warn` `bg-status-bad` `bg-caution` |
| Text | `text-ink` `text-paper` `text-wk-muted` `text-rust` `text-ink-50` `text-ink-75` `text-paper-60` |
| Borders | `border-chrome` `border-entity` `border-rail` `border-ink` `border-ink-20` `border-ink-30` `border-rust` (+ `border-t-/b-/l-chrome`) |
| Radius | `rounded-card` `rounded-panel` |
| Face | `font-body` (Barlow) `font-cond` (Barlow Semi Condensed) |
| Type scale | `text-nano` `text-micro` `text-label` `text-note` `text-caption` `text-badge` `text-lede` `text-display` `text-hero` |
| Caps tracking | `tracking-caps` `tracking-caps-tight` `tracking-caps-snug` `tracking-caps-wide` |
| Tech level | `--color-tl-1` … `--color-tl-6` (via `var()`) |

**Rust is the action colour — use it for exactly one action per surface.** Ontology
hue encodes what a thing IS (mech green / pilot orange / crawler pink), never
identity or importance.

Condensed uppercase (`font-cond` + `uppercase` + `tracking-caps`) is the label
voice; `font-body` is prose. A square stamped label is
`<Badge shape="stamp">`, never styled text.

## 4. Scoped surfaces

Three scopes re-tone their subtree. Set them on a wrapper, then children read
`--tone` automatically:

- `sheet--pilot` / `sheet--mech` / `sheet--crawler` — the live-sheet surfaces.
- `pc-root` with `data-mount="mech|pilot|crawler"` — the dashboard HUD scope.
  **Every `pc-*` instrument requires it**; outside it they are unstyled.

Dashboard rule worth knowing: it is **warm-paper instruments on a dark ground**.
`bg-ink-deep` goes *behind* things; the instrument chassis is `bg-band-cream`,
and `surface="instrument"` controls are ink-on-cream — putting them straight on
the dark ground renders them invisible.

## 5. Where the truth is

- `_ds/<folder>/styles.css` and its imports — the complete class and token set.
  Read it before inventing a class.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage.
- `components/<group>/<Name>/<Name>.d.ts` — the exact props.

## 6. A worked example

```jsx
const { SalvageUnionDataProvider, SalvageUnionReference, ReferenceEntityCard,
        Badge, Button, Slab } = window.SalvageUnion

function Loadout() {
  const systems = SalvageUnionReference.Systems.all().slice(0, 4)
  return (
    <div className="bg-paper p-4">
      <Slab
        label="Systems"
        count={`${systems.length}/6 slots`}
        actions={<Button size="mini">+ Add</Button>}
      />
      <div className="mt-3 flex flex-col gap-2">
        {systems.map((s) => (
          <ReferenceEntityCard key={s.id} data={s} size="medium" extent="head" />
        ))}
      </div>
      <p className="mt-4 font-cond text-label uppercase tracking-caps text-wk-muted">
        Salvage <Badge surface="outline">TL 2</Badge>
      </p>
    </div>
  )
}

export default () => (
  <SalvageUnionDataProvider>
    <Loadout />
  </SalvageUnionDataProvider>
)
```
