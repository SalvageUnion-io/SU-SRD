# Chrome

The law for what frames the content: grounds, the breakpoint ladder, motion, lift, notices, loading, dialogs, empty and error states, focus, tabs and icons. It is [ruleset.md](ruleset.md) §8, extending §4; each law's gate is in [hard-rules.md](hard-rules.md).
Status: agreed (2026-10-18).

## Foundations

- **K1 One ground signal** — a surface declares its ground once (`data-ground="paper" | "ink"` on its frame, as `data-grain` declares texture); components read it in CSS, never through a prop. Paper on ink is `--color-paper-NN` alone.
- **K2 The breakpoint ladder** — 40, 48, 64 and 80rem (`breakpoint` in `tokens.ts`), written `(width >= …)`, for media and container queries and the JS that mirrors them. Named exceptions, each a component fit: Play's phone floor, the canvas's 1280 × 800 design size on either axis (ADR-045 decision 1), the stat column's cell count and a Compact's art by room (EDL E10).
- **K3 Motion** — `--dur-fast` (120ms) for a state change, `--dur-base` (150ms) for a move, one easing, `--ease`. A loop is only a loading mark, its period `--dur-loop` (2s), and only under `prefers-reduced-motion: no-preference`.
- **K4 Lift and layers** — one lift, `--shadow-lift` in warm ink, for what floats (popup, Peek plate, toast, dialog); the focus ring is the other shadow. Popups are 3px (ruleset §4.4). Above the page z-index comes from `layer` (`--z-*`); 0–3 is local stacking.

## Roles

One component per job, chosen by the job (R16).

- **K5 Notices** — a toast reports an act just done, from the one `Toaster` per document; a `Banner` holds a lasting condition (offline is one notice, one wording); a `Message` states a consequence where it applies.
  Copied is the copy control's own `Check` swap and a polite live region, never a toast. No notice wears a roll-tier colour (ruleset §3.4).
- **K6 Loading** — `Pending` inside a screen, `Skeleton` for a shape known ahead, `RoutePending` for a route; one voice, "Loading <thing>…".
- **K7 Dialog widths** — `ModalShell` is narrow (28rem: confirms, short pickers), default (48rem) or page (72rem: the detail Page, the searcher); no per-dialog width.
- **K8 Empty and error states** — `EmptyState`: the stamp on a Page or sheet section, quiet in app chrome, inline in a framed list; "No <things> yet."
  A crash is `RecoveryPanel`, a missing record `NotFoundPanel`, a failed act `toast.error`; the one retry verb is "Try again".
- **K9 One focus ring** — every focusable thing shows `--focus-ring-shadow` on `:focus-visible`, in ink (ruleset §3.1), Play included; no outline, underline, dashed or colour-only variant.
- **K10 Tabs, Segmented, Toggle** — `Tabs` switch what a region shows, `Segmented` sets a value, `Toggle` is one on/off; a tab or segment label never ellipsizes (EDL E18).
- **K11 Icons** — the line's Size: Mini 12px, Compact 14px, Full 18px (`iconSize`), stroke 2. ⋯ is `Ellipsis`, close is `X`, back is `ChevronLeft` and the place's name ("Training Bay"), never an arrow character.
