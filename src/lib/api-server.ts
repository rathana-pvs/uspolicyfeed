import { Article, PaginatedArticles } from '@/types'
import { getPayloadClient } from './payload'
import { unstable_cache } from 'next/cache'
import { mockArticles } from './mockData'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes('placeholder'))
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://uspolicyfeed.com'

/** Ensure a cover image URL is always properly formatted. */
function normalizeImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('/media/')) {
    return `/api/media/file/${url.replace('/media/', '')}`
  }
  if (url.startsWith('/api/media/file/')) {
    return url
  }
  return url.startsWith('/') ? url : `/${url}`
}

// Detect build time to bypass caching placeholder database responses
const isBuildTime = 
  !process.env.DATABASE_URI || 
  process.env.DATABASE_URI.includes('placeholder')

const cachedGetArticles = unstable_cache(
  async (params?: {
    limit?: number
    page?: number
    where?: Record<string, any>
  }): Promise<PaginatedArticles> => {
    try {
      const payload = await getPayloadClient()
      
      const whereClause: any = {
        status: { equals: 'published' },
        ...(params?.where || {}),
      }

      const result = await payload.find({
        collection: 'articles',
        limit: params?.limit || 12,
        page: params?.page || 1,
        where: whereClause,
        depth: 2,
        sort: '-publishedAt',
      })

      if (!result.docs || result.docs.length === 0) {
        return {
          docs: mockArticles.slice(0, params?.limit || 12),
          totalDocs: mockArticles.length,
          limit: params?.limit || 12,
          totalPages: 1,
          page: params?.page || 1,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        } as unknown as PaginatedArticles
      }

      const docs = result.docs.map((doc: any) => {
        if (doc.coverImage && typeof doc.coverImage === 'object') {
          doc.coverImage.url = normalizeImageUrl(doc.coverImage.url)
        }
        return doc
      })

      return { ...result, docs } as unknown as PaginatedArticles
    } catch (error) {
      console.warn('⚠️ Postgres connection failed in getArticles (expected during build):', error instanceof Error ? error.message : error)
      return {
        docs: mockArticles.slice(0, params?.limit || 12),
        totalDocs: mockArticles.length,
        limit: params?.limit || 12,
        totalPages: 1,
        page: params?.page || 1,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      } as unknown as PaginatedArticles
    }
  },
  ['articles-list'],
  { tags: ['articles'] }
)

export async function getArticles(params?: {
  limit?: number
  page?: number
  where?: Record<string, any>
}): Promise<PaginatedArticles> {
  if (isBuildTime) {
    return {
      docs: [],
      totalDocs: 0,
      limit: params?.limit || 12,
      totalPages: 1,
      page: params?.page || 1,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    } as unknown as PaginatedArticles
  }
  return cachedGetArticles(params)
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (isBuildTime) {
    return null
  }
  return unstable_cache(
    async (): Promise<Article | null> => {
      try {
        const payload = await getPayloadClient()
        const result = await payload.find({
          collection: 'articles',
          where: { slug: { equals: slug } },
          limit: 1,
          depth: 2,
        })
        const article = (result.docs[0] as unknown as any) || null
        if (article) {
          if (article.coverImage && typeof article.coverImage === 'object') {
            article.coverImage.url = normalizeImageUrl(article.coverImage.url)
          }
          return (article as unknown as Article) || null
        }
        return null
      } catch (error) {
        console.warn(`⚠️ Postgres connection failed in getArticle for slug "${slug}":`, error instanceof Error ? error.message : error)
        return null
      }
    },
    ['article', slug],
    { tags: ['articles', `article-${slug}`], revalidate: 60 }
  )()
}

const cachedGetFeatured = unstable_cache(
  async (): Promise<{ hero: Article | null; secondary: Article[] }> => {
    try {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'articles',
        where: {
          status: { equals: 'published' },
        },
        limit: 5,
        depth: 2,
        sort: '-publishedAt',
      })
      const docs = result.docs as unknown as Article[]
      if (docs.length > 0) {
        return { hero: docs[0] || null, secondary: docs.slice(1, 5) }
      }
      return { hero: mockArticles[0] || null, secondary: mockArticles.slice(1, 5) }
    } catch (error) {
      console.warn('⚠️ Postgres connection failed in getFeatured (expected during build):', error instanceof Error ? error.message : error)
      return { hero: mockArticles[0] || null, secondary: mockArticles.slice(1, 5) }
    }
  },
  ['featured-articles'],
  { tags: ['articles'] }
)

export async function getFeatured(): Promise<{ hero: Article | null; secondary: Article[] }> {
  if (isBuildTime) {
    return { hero: null, secondary: [] }
  }
  return cachedGetFeatured()
}

const cachedGetBreakingArticles = unstable_cache(
  async (): Promise<Article[]> => {
    try {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'articles',
        where: {
          isBreaking: { equals: true },
          status: { equals: 'published' },
        },
        limit: 5,
        depth: 2,
      })
      if (result.docs && result.docs.length > 0) {
        return result.docs as unknown as Article[]
      }
      return mockArticles.filter((a) => a.isBreaking)
    } catch (error) {
      console.warn('⚠️ Postgres connection failed in getBreakingArticles (expected during build):', error instanceof Error ? error.message : error)
      return mockArticles.filter((a) => a.isBreaking)
    }
  },
  ['breaking-articles'],
  { tags: ['articles'] }
)

export async function getBreakingArticles(): Promise<Article[]> {
  if (isBuildTime) {
    return []
  }
  return cachedGetBreakingArticles()
}

export async function getRelatedArticles(articleId: string | number): Promise<Article[]> {
  if (isBuildTime) {
    return []
  }
  return unstable_cache(
    async (): Promise<Article[]> => {
      try {
        const payload = await getPayloadClient()
        const where: any = {
          status: { equals: 'published' },
          id: { not_equals: articleId },
        }

        const result = await payload.find({
          collection: 'articles',
          where,
          limit: 3,
          depth: 2,
        })
        if (result.docs && result.docs.length > 0) {
          return result.docs as unknown as Article[]
        }
        return []
      } catch (error) {
        console.warn(`⚠️ Postgres connection failed in getRelatedArticles for ID "${articleId}":`, error instanceof Error ? error.message : error)
        return []
      }
    },
    ['related-articles', String(articleId)],
    { tags: ['articles'], revalidate: 60 }
  )()
}

export async function getVideoArticles(limit: number = 6): Promise<Article[]> {
  if (isBuildTime) {
    return []
  }
  return unstable_cache(
    async (): Promise<Article[]> => {
      try {
        const payload = await getPayloadClient()
        const result = await payload.find({
          collection: 'articles',
          where: {
            status: { equals: 'published' },
            isVideo: { equals: true },
          },
          limit,
          depth: 2,
          sort: '-publishedAt',
        })
        if (result.docs && result.docs.length > 0) {
          return result.docs as unknown as Article[]
        }
        return (mockArticles as Article[]).filter((a) => a.isVideo).slice(0, limit)
      } catch (error) {
        console.warn('⚠️ Postgres connection failed in getVideoArticles:', error instanceof Error ? error.message : error)
        return (mockArticles as Article[]).filter((a) => a.isVideo).slice(0, limit)
      }
    },
    ['video-articles', String(limit)],
    { tags: ['articles'], revalidate: 60 }
  )()
}

export async function getArticlesByRegion(region: string, limit: number = 6): Promise<Article[]> {
  if (isBuildTime) {
    return []
  }
  return unstable_cache(
    async (): Promise<Article[]> => {
      try {
        const payload = await getPayloadClient()
        const result = await payload.find({
          collection: 'articles',
          where: {
            status: { equals: 'published' },
            region: { equals: region.toLowerCase() },
          },
          limit,
          depth: 2,
          sort: '-publishedAt',
        })
        if (result.docs && result.docs.length > 0) {
          return result.docs as unknown as Article[]
        }
        return (mockArticles as Article[]).filter((a) => a.region?.toLowerCase() === region.toLowerCase()).slice(0, limit)
      } catch (error) {
        console.warn(`⚠️ Postgres connection failed in getArticlesByRegion (${region}):`, error instanceof Error ? error.message : error)
        return (mockArticles as Article[]).filter((a) => a.region?.toLowerCase() === region.toLowerCase()).slice(0, limit)
      }
    },
    ['region-articles', region.toLowerCase(), String(limit)],
    { tags: ['articles'], revalidate: 60 }
  )()
}


