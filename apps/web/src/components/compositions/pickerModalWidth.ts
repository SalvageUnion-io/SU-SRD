/**
 * The width of an `EntitySearcher` picker, for `ModalShell`'s `maxWidth`:
 * 78rem, room for the Token list and the chosen sidebar either side of a
 * readable medium Card. `SheetPickerModal` uses it for every `floating`
 * picker; pass it yourself only to a hand-rolled bare `ModalShell` that wraps
 * a searcher.
 *
 * A `.su-*` class name (`styles/partials/controls.css`), not a style object:
 * `maxWidth` is a class-string prop. Its own module
 * because a component file may export only components (Fast Refresh).
 */
export const PICKER_MODAL_WIDTH = 'su-picker-modal'
