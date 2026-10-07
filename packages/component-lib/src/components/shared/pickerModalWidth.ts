/**
 * The width of a multi-select `EntitySearcher` picker, for `ModalShell`'s
 * `maxWidth`: 64rem, widening at 80rem — the breakpoint where the searcher's
 * selection rail becomes a column beside the pool — so the pool keeps its two
 * masonry columns at a readable width. `SheetPickerModal` uses it for every
 * `floating` picker; pass it yourself only to a hand-rolled bare `ModalShell`
 * that wraps a searcher. A single-select searcher keeps its rail as a band at
 * every width, so it needs no extra room.
 *
 * A `.su-*` class name (`src/styles/index.css`), not a Tailwind string: the
 * width is responsive, and `maxWidth` is a class-string prop. Its own module
 * because a component file may export only components (Fast Refresh).
 */
export const PICKER_MODAL_WIDTH = 'su-picker-modal'
