// Only what tools/__tests__/deepmerge.test.ts calls; @types/deepmerge is not installed.
declare function deepmerge<T, S>(target: T, source: S): T & S
declare namespace deepmerge {
  function all(objects: object[]): object
}
export = deepmerge
