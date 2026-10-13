/**
 * `RollTable`'s dice: the library's one dice source (Randsum), through a
 * module of this app's own, so `RollTable.test.tsx` can serve chosen faces
 * without replacing the whole library.
 */
export { dieForTable, rollD20 } from 'component-lib'
