import { describe, test, expect } from 'bun:test'
import { buildPaginationUrl } from './url'

describe('buildPaginationUrl', () => {
  test('builds URL with all parameters', () => {
    const url = buildPaginationUrl('api.example.com', '/admin/categories', {
      status: 'active',
      q: 'test',
      sort: 'title',
      limit: 20,
      offset: 0,
    })

    expect(url).toBe(
      'https://api.example.com/admin/categories?status=active&q=test&sort=title&limit=20&offset=0',
    )
  })

  test('builds URL with only required parameters', () => {
    const url = buildPaginationUrl('api.example.com', '/admin/products', {
      sort: '-createdAt',
      limit: 10,
      offset: 20,
    })

    expect(url).toBe(
      'https://api.example.com/admin/products?sort=-createdAt&limit=10&offset=20',
    )
  })

  test('omits undefined parameters', () => {
    const url = buildPaginationUrl('api.example.com', '/admin/categories', {
      status: undefined,
      q: undefined,
      sort: 'title',
      limit: 20,
      offset: 0,
    })

    expect(url).toBe(
      'https://api.example.com/admin/categories?sort=title&limit=20&offset=0',
    )
  })

  test('handles numeric values correctly', () => {
    const url = buildPaginationUrl('api.example.com', '/items', {
      limit: 100,
      offset: 50,
    })

    expect(url).toBe('https://api.example.com/items?limit=100&offset=50')
  })

  test('encodes special characters in query values', () => {
    const url = buildPaginationUrl('api.example.com', '/search', {
      q: 'hello world',
      filter: 'type:A&B',
    })

    expect(url).toBe(
      'https://api.example.com/search?q=hello+world&filter=type%3AA%26B',
    )
  })

  test('handles empty params object', () => {
    const url = buildPaginationUrl('api.example.com', '/items', {})

    expect(url).toBe('https://api.example.com/items?')
  })
})
