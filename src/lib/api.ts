import { PaginatedArticles } from '@/types'

export async function getArticles(params?: {
  limit?: number
  page?: number
  where?: Record<string, any>
}): Promise<PaginatedArticles> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.page) searchParams.set('page', String(params.page))
    searchParams.set('where[status][equals]', 'published')
    searchParams.set('depth', '1')
    // Only the fields list views render. Without this the search page downloaded
    // the full body, SEO and image-size data of 100 articles (~2 MB) on every visit.
    for (const f of ['title', 'slug', 'excerpt', 'author', 'coverImage', 'publishedAt', 'readTime', 'isBreaking', 'region']) {
      searchParams.set(`select[${f}]`, 'true')
    }
    for (const f of ['url', 'filename', 'alt', 'externalUrl']) {
      searchParams.set(`populate[media][${f}]`, 'true')
    }
    searchParams.set('populate[authors][name]', 'true')
    searchParams.set('populate[authors][slug]', 'true')

    const res = await fetch(`/api/articles?${searchParams}`)
    if (!res.ok) throw new Error('Failed to fetch articles')
    return res.json()
  } catch (e) {
    console.error(e)
    return {
      docs: [],
      totalDocs: 0,
      limit: 12,
      totalPages: 0,
      page: 1,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }
  }
}
