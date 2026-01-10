export const sortByField = <T extends Record<string, any>>(
  items: T[],
  sortString: string,
): T[] => {
  const sortField = sortString.startsWith('-')
    ? sortString.slice(1)
    : sortString
  const sortDirection = sortString.startsWith('-') ? -1 : 1

  return [...items].sort((a, b) => {
    const aVal = (() => {
      const val = a[sortField as keyof T]
      return typeof val === 'string' ? val.toLowerCase() : val
    })()
    const bVal = (() => {
      const val = b[sortField as keyof T]
      return typeof val === 'string' ? val.toLowerCase() : val
    })()

    if (aVal < bVal) return -1 * sortDirection
    if (aVal > bVal) return 1 * sortDirection
    return 0
  })
}
