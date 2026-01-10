export const buildPaginationUrl = (
  domain: string | undefined,
  path: string | undefined,
  params: Record<string, string | number | undefined>,
): string => {
  const baseUrl = `https://${domain || 'localhost'}${path || ''}`
  const urlParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      urlParams.set(key, value.toString())
    }
  })

  return `${baseUrl}?${urlParams.toString()}`
}
