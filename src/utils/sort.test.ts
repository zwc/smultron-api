import { describe, test, expect } from 'bun:test'
import { sortByField } from './sort'

describe('sortByField', () => {
  const items = [
    { id: 3, name: 'Charlie', age: 25, createdAt: '2024-01-03' },
    { id: 1, name: 'alice', age: 30, createdAt: '2024-01-01' },
    { id: 2, name: 'Bob', age: 20, createdAt: '2024-01-02' },
  ]

  test('sorts by numeric field ascending', () => {
    const result = sortByField(items, 'id')

    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
    expect(result[2].id).toBe(3)
  })

  test('sorts by numeric field descending', () => {
    const result = sortByField(items, '-id')

    expect(result[0].id).toBe(3)
    expect(result[1].id).toBe(2)
    expect(result[2].id).toBe(1)
  })

  test('sorts by string field ascending (case-insensitive)', () => {
    const result = sortByField(items, 'name')

    expect(result[0].name).toBe('alice')
    expect(result[1].name).toBe('Bob')
    expect(result[2].name).toBe('Charlie')
  })

  test('sorts by string field descending (case-insensitive)', () => {
    const result = sortByField(items, '-name')

    expect(result[0].name).toBe('Charlie')
    expect(result[1].name).toBe('Bob')
    expect(result[2].name).toBe('alice')
  })

  test('sorts by date string field ascending', () => {
    const result = sortByField(items, 'createdAt')

    expect(result[0].createdAt).toBe('2024-01-01')
    expect(result[1].createdAt).toBe('2024-01-02')
    expect(result[2].createdAt).toBe('2024-01-03')
  })

  test('sorts by date string field descending', () => {
    const result = sortByField(items, '-createdAt')

    expect(result[0].createdAt).toBe('2024-01-03')
    expect(result[1].createdAt).toBe('2024-01-02')
    expect(result[2].createdAt).toBe('2024-01-01')
  })

  test('returns new array without mutating original', () => {
    const original = [...items]
    const result = sortByField(items, 'id')

    expect(items).toEqual(original)
    expect(result).not.toBe(items)
  })

  test('handles empty array', () => {
    const result = sortByField([], 'id')

    expect(result).toEqual([])
  })

  test('handles single item array', () => {
    const single = [{ id: 1, name: 'Test' }]
    const result = sortByField(single, 'name')

    expect(result).toEqual(single)
    expect(result).not.toBe(single)
  })

  test('sorts mixed case strings correctly', () => {
    const mixed = [
      { title: 'Zebra' },
      { title: 'apple' },
      { title: 'BANANA' },
      { title: 'cherry' },
    ]

    const result = sortByField(mixed, 'title')

    expect(result[0].title).toBe('apple')
    expect(result[1].title).toBe('BANANA')
    expect(result[2].title).toBe('cherry')
    expect(result[3].title).toBe('Zebra')
  })
})
