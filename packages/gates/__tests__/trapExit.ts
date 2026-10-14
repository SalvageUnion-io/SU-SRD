import { afterEach, beforeEach, spyOn } from 'bun:test'

/** What a trapped `process.exit` throws, carrying the code the CLI would exit with. */
export class Exited extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${code})`)
  }
}

/**
 * Gate preconditions call `process.exit(1)` on failure. Registers hooks that
 * turn `exit` into a thrown `Exited` (so the runner survives and the function
 * stops where the CLI would) and capture `console.error`, restored after each
 * test. Returns the captured lines, cleared before each test.
 */
export function trapExit(): { errors: string[] } {
  const captured = { errors: [] as string[] }
  let restore: (() => void)[] = []
  beforeEach(() => {
    captured.errors.length = 0
    const exit = spyOn(process, 'exit').mockImplementation((code) => {
      throw new Exited(code)
    })
    const error = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      captured.errors.push(args.join(' '))
    })
    restore = [() => exit.mockRestore(), () => error.mockRestore()]
  })
  afterEach(() => {
    for (const r of restore) r()
  })
  return captured
}
