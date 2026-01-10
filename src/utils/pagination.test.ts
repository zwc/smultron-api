import { describe, test, expect } from 'bun:test'
import { buildPaginationEnvelope } from './pagination'

describe('buildPaginationEnvelope', () => {
  const mockBuildUrl = (offset: number) =>
    `https://api.example.com/items?limit=20&offset=${offset}`

  test('builds envelope for first page', () => {
    const envelope = buildPaginationEnvelope(
      100,
      { limit: 20, offset: 0, sort: 'title' },
      mockBuildUrl,
      { status: 'active' },
    )

    expect(envelope.meta).toEqual({
      total: 100,
      limit: 20,
      offset: 0,
      sort: 'title',
      filters: { status: 'active' },
    })

    expect(envelope.links.self).toBe(
      'https://api.example.com/items?limit=20&offset=0',
    )
    expect(envelope.links.next).toBe(
      'https://api.example.com/items?limit=20&offset=20',
    )
    expect(envelope.links.prev).toBeNull()
  })

  test('builds envelope for middle page', () => {
    const envelope = buildPaginationEnvelope(
      100,
      { limit: 20, offset: 40, sort: '-createdAt' },
      mockBuildUrl,
      { status: 'active', q: 'test' },
    )

    expect(envelope.meta).toEqual({
      total: 100,
      limit: 20,
      offset: 40,
      sort: '-createdAt',
      filters: { status: 'active', q: 'test' },
    })

    expect(envelope.links.self).toBe(
      'https://api.example.com/items?limit=20&offset=40',
    )
    expect(envelope.links.next).toBe(
      'https://api.example.com/items?limit=20&offset=60',
    )
    expect(envelope.links.prev).toBe(
      'https://api.example.com/items?limit=20&offset=20',
    )
  })

  test('builds envelope for last page', () => {
    const envelope = buildPaginationEnvelope(
      50,
      { limit: 20, offset: 40, sort: 'title' },
      mockBuildUrl,
      {},
    )

    expect(envelope.meta).toEqual({
      total: 50,
      limit: 20,
      offset: 40,
      sort: 'title',
      filters: {},
    })

    expect(envelope.links.self).toBe(
      'https://api.example.com/items?limit=20&offset=40',
    )
    expect(envelope.links.next).toBeNull()
    expect(envelope.links.prev).toBe(
      'https://api.example.com/items?limit=20&offset=20',
    )
  })

  test('handles single page of results', () => {
    const envelope = buildPaginationEnvelope(
      10,
      { limit: 20, offset: 0, sort: 'title' },
      mockBuildUrl,
      {},
    )

    expect(envelope.links.self).toBe(
      'https://api.example.com/items?limit=20&offset=0',
    )
    expect(envelope.links.next).toBeNull()
    expect(envelope.links.prev).toBeNull()
  })

  test('handles empty results', () => {
    const envelope = buildPaginationEnvelope(
      0,
      { limit: 20, offset: 0, sort: 'title' },
      mockBuildUrl,
      {},
    )

    expect(envelope.meta.total).toBe(0)
    expect(envelope.links.next).toBeNull()
    expect(envelope.links.prev).toBeNull()
  })

  test('normalizes undefined filters to null', () => {
    const envelope = buildPaginationEnvelope(
      50,
      { limit: 20, offset: 0, sort: 'title' },
      mockBuildUrl,
      { status: 'active', q: undefined, category: undefined },
    )

    expect(envelope.meta.filters).toEqual({
      status: 'active',
      q: null,
      category: null,
    })
  })

  test('handles no filters', () => {
    const envelope = buildPaginationEnvelope(
      50,
      { limit: 20, offset: 0, sort: 'title' },
      mockBuildUrl,
    )

    expect(envelope.meta.filters).toEqual({})
  })

  test('prevents prev link from going below zero offset', () => {
    const envelope = buildPaginationEnvelope(
      100,
      { limit: 20, offset: 10, sort: 'title' },
      mockBuildUrl,
      {},
    )

    expect(envelope.links.prev).toBe(
      'https://api.example.com/items?limit=20&offset=0',
    )
  })
})
