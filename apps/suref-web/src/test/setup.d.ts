/**
 * Type declarations for test setup
 * Extends Bun test matchers with jest-dom matchers
 */

import '@testing-library/jest-dom'

declare module 'bun:test' {
  interface Matchers<T> {
    toBeInTheDocument(): T
    toBeDisabled(): T
    toBeEnabled(): T
    toHaveAttribute(attr: string, value?: string): T
    toHaveTextContent(text: string | RegExp): T
    toHaveClass(...classNames: string[]): T
    toHaveValue(value: string | number): T
  }
}
