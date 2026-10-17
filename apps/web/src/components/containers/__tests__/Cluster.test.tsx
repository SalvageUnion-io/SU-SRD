import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Cluster } from '../Cluster'

describe('Cluster', () => {
  test('is a div wearing the cluster class, its gap a space step', () => {
    const { container } = render(
      <Cluster gap={8} role="group" aria-label="Actions">
        <button type="button">One</button>
      </Cluster>
    )
    const cluster = container.firstElementChild as HTMLElement
    expect(cluster.tagName).toBe('DIV')
    expect(cluster.className).toBe('su-cluster')
    expect(cluster.dataset.gap).toBe('8')
    expect(cluster.getAttribute('role')).toBe('group')
  })
})
