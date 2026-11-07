import { getPayload } from 'payload'
import config from '../../payload.config'
import fs from 'fs'
import path from 'path'
import { getMediaDirectory } from './media-dir'
import { assertWipeAllowed } from './wipe-guard'

const seed = async () => {
  assertWipeAllowed('npm run seed')
  console.log('🚀 Starting US Policy Feed Database Seed...')
  const payload = await getPayload({ config })

  // 1. Clear existing data
  console.log('\n🧹 Clearing Existing Data...')
  try {
    await payload.delete({
      collection: 'articles',
      where: { id: { exists: true } },
    })
    console.log('  ✓ Deleted existing articles')
  } catch (e: any) {
    console.warn('  ⚠️ Article cleanup note:', e.message)
  }

  try {
    await payload.delete({
      collection: 'media',
      where: { id: { exists: true } },
    })
    console.log('  ✓ Deleted existing media')
  } catch (e: any) {
    console.warn('  ⚠️ Media cleanup note:', e.message)
  }

  // 2. Ensure Admin User
  console.log('\n👤 Ensuring Admin User...')
  const adminEmail = 'admin@uspolicyfeed.com'
  const adminPassword = 'adminpassword123'

  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
  })

  if (existingAdmin.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        name: 'US Policy Feed Admin',
        role: 'admin',
      },
    })
    console.log(`  ✓ Created admin user: ${adminEmail} / ${adminPassword}`)
  } else {
    console.log(`  ✓ Admin user exists: ${adminEmail}`)
  }

  // 3. Load Seed Data JSON
  const seedPath = path.resolve(process.cwd(), 'seed_data_40.json')
  if (!fs.existsSync(seedPath)) {
    console.error(`❌ seed_data_40.json not found at ${seedPath}! Run scrape first.`)
    process.exit(1)
  }

  const { authors = [], articles = [] } = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  console.log(`📦 Loaded ${articles.length} articles and ${authors.length} authors from seed file`)

  // 4. Seed Authors
  console.log('\n✍️ Seeding Authors...')
  const authorMap: Record<string, string | number> = {}

  for (const author of authors) {
    const existing = await payload.find({
      collection: 'authors',
      where: { slug: { equals: author.slug } },
    })

    const authorPayload = {
      name: author.name,
      slug: author.slug,
      bio: author.bio || '',
      role: author.role || 'Staff Reporter',
      email: author.email || 'news@uspolicyfeed.com',
    }

    if (existing.docs.length === 0) {
      const created = await payload.create({
        collection: 'authors',
        data: authorPayload,
        draft: false,
      })
      authorMap[author.slug] = created.id
      console.log(`  ✓ Created author: "${author.name}" (ID: ${created.id})`)
    } else {
      authorMap[author.slug] = existing.docs[0].id
      console.log(`  ✓ Existing author: "${author.name}" (ID: ${existing.docs[0].id})`)
    }
  }

  // 5. Seed Media and Articles
  console.log(`\n📰 Seeding ${articles.length} Articles with Media Assets...`)
  const mediaDir = getMediaDirectory()
  let successCount = 0

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i]
    const prefix = `[${i + 1}/${articles.length}]`
    console.log(`\n${prefix} Processing: "${art.title}"`)

    // Create Media Record
    let mediaId: string | number | null = null
    const coverInfo = art.coverImage || {}

    try {
      if (coverInfo.filename && fs.existsSync(path.join(mediaDir, coverInfo.filename))) {
        const filePath = path.join(mediaDir, coverInfo.filename)
        const fileBuffer = fs.readFileSync(filePath)
        
        const mediaDoc = await payload.create({
          collection: 'media',
          data: {
            alt: art.title,
            caption: art.title,
            source: 'local',
          },
          file: {
            data: fileBuffer,
            name: coverInfo.filename,
            mimetype: coverInfo.mimeType || 'image/jpeg',
            size: fileBuffer.length,
          },
        })
        mediaId = mediaDoc.id
        console.log(`  🖼️ Created local media (ID: ${mediaId}, File: ${coverInfo.filename})`)
      } else if (coverInfo.remoteUrl) {
        const mediaDoc = await payload.create({
          collection: 'media',
          data: {
            alt: art.title,
            caption: art.title,
            source: 'external',
            externalUrl: coverInfo.remoteUrl,
          },
          file: {
            data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA6ie6hQAAAABJRU5ErkJggg==', 'base64'),
            name: `external-${art.slug}.png`,
            mimetype: 'image/png',
            size: 70,
          },
        })
        mediaId = mediaDoc.id
        console.log(`  🖼️ Created external media (ID: ${mediaId})`)
      }
    } catch (mediaErr: any) {
      console.warn(`  ⚠️ Media creation notice for "${art.title}":`, mediaErr.message)
    }

    // Author ID resolution
    const authorSlug = art.author?.slug || 'uspolicyfeed-newsroom'
    const resolvedAuthorId = authorMap[authorSlug] || Object.values(authorMap)[0]

    // Create Article Record
    const articlePayload: any = {
      title: art.title,
      slug: art.slug,
      excerpt: art.excerpt,
      content: art.content,
      coverImage: mediaId,
      author: resolvedAuthorId,
      tags: art.tags || [{ tag: 'news' }],
      status: 'published',
      isBreaking: !!art.isBreaking,
      isFeatured: !!art.isFeatured,
      publishedAt: art.publishedAt,
      readTime: art.readTime || 3,
      credit: art.credit || 'US Policy Feed Wire Service',
      og: art.og || {
        metaTitle: art.title,
        metaDescription: art.excerpt,
      },
      meta: art.meta || {
        title: art.title,
        description: art.excerpt,
      },
    }

    try {
      const createdArticle = await payload.create({
        collection: 'articles',
        data: articlePayload,
        draft: false,
      })
      console.log(`  ✅ Created Article #${createdArticle.id}: "${createdArticle.title.slice(0, 45)}..."`)
      successCount++
    } catch (artErr: any) {
      console.error(`  ❌ Failed to create article "${art.title}":`, artErr.message)
    }
  }

  console.log(`\n==============================================`)
  console.log(`🎉 US Policy Feed Seed Completed Successfully!`)
  console.log(`- Total Articles Seeded: ${successCount} / ${articles.length}`)
  console.log(`- Admin Credentials: ${adminEmail} / ${adminPassword}`)
  console.log(`==============================================\n`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Direct DB Seed Error:', err)
  process.exit(1)
})
