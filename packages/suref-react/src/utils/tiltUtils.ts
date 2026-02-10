import { roll } from '@randsum/roller'

export function getTiltRotation(): number {
  const result = roll('1d7')
  return result.total - 4
}
