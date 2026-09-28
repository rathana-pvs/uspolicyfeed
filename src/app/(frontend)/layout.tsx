import type { Metadata } from 'next'
import Script from 'next/script'
import '@/app/globals.css'
import Header from '@/components/layout/Header'
import Navigation from '@/components/layout/Navigation'
import LiveBanner from '@/components/layout/LiveBanner'
import Footer from '@/components/layout/Footer'
import { GoogleAnalytics } from '@next/third-parties/google'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { VisitorCounter } from '@/components/layout/VisitorCounter'
import { getBreakingArticles } from '@/lib/api-server'
import { IBM_Plex_Mono } from 'next/font/google'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
})

const envUrl = process.env.NEXT_PUBLIC_SITE_URL
const siteUrl = envUrl && !envUrl.includes('placeholder.com') ? envUrl : 'https://uspolicyfeed.com'
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'US Policy Feed'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — US Policy, Governance, Global Affairs & Economy`,
    template: `%s — ${siteName}`,
  },
  description: 'Independent reporting and authoritative analysis on US policy, governance, legislation, defense, and international affairs.',
  keywords: ['news', 'politics', 'us policy', 'policy', 'governance', 'legislation', 'congress', 'white house', 'economy', 'world news'],
  openGraph: {
    siteName,
    type: 'website',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon_192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon_512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default async function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const breakingList = await getBreakingArticles()
  const breakingStory = breakingList[0] || null

  return (
    <html lang="en" className={ibmPlexMono.variable}>
      <head>
        {/* Adskeeper site loader script */}
        {process.env.NEXT_PUBLIC_ADS_ENABLED === 'true' && (
          <script
            src={`https://jsc.adskeeper.com/site/${process.env.NEXT_PUBLIC_ADS_KEEPER_SITE_ID || '1113195'}.js`}
            async
          />
        )}
      </head>
      <body>
        <NavigationProgress />
        <Header />
        <Navigation />
        {breakingStory && (
          <LiveBanner
            headline={breakingStory.title}
            slug={breakingStory.slug}
          />
        )}
        <main id="main-content" className="site-main">
          {children}
        </main>
        <Footer />
        <VisitorCounter />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  )
}
