type PaginationParams = {
  limit: number
  offset: number
  sort: string
}

type PaginationEnvelope = {
  meta: {
    total: number
    limit: number
    offset: number
    sort: string
    filters: Record<string, string | null>
  }
  links: {
    self: string
    next: string | null
    prev: string | null
  }
}

export const buildPaginationEnvelope = (
  total: number,
  params: PaginationParams,
  buildUrl: (offset: number) => string,
  filters: Record<string, string | undefined> = {},
): PaginationEnvelope => {
  const normalizedFilters = Object.entries(filters).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: value || null,
    }),
    {} as Record<string, string | null>,
  )

  return {
    meta: {
      total,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
      filters: normalizedFilters,
    },
    links: {
      self: buildUrl(params.offset),
      next:
        params.offset + params.limit < total
          ? buildUrl(params.offset + params.limit)
          : null,
      prev:
        params.offset > 0
          ? buildUrl(Math.max(0, params.offset - params.limit))
          : null,
    },
  }
}
