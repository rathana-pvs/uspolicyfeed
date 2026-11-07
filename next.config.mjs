import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // The media route reads files from a dynamic path, which can make the build trace
  // the whole project (including public/media and .next/standalone) into the output.
  outputFileTracingExcludes: {
    '*': ['./public/**', './.next/standalone/**', './scripts/**', './*.md', './*.sh', './seed_data_40.json'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'http',
        hostname: '0.0.0.0',
      },
      {
        protocol: 'https',
        hostname: 'dam.mediacorp.sg',
      },
      {
        protocol: 'https',
        hostname: 'media-cldnry.s-nbcnews.com',
      },
      {
        protocol: 'https',
        hostname: 'uspolicyfeed.com',
      },
      {
        protocol: 'https',
        hostname: 'www.uspolicyfeed.com',
      },
      {
        protocol: 'https',
        hostname: 'uspolicybrief.com',
      },
      {
        protocol: 'https',
        hostname: 'www.uspolicybrief.com',
      },
      {
        protocol: 'https',
        hostname: 'pulefeed.tech',
      },
      {
        protocol: 'https',
        hostname: 'www.pulefeed.tech',
      },
      {
        protocol: 'https',
        hostname: 'www.aljazeera.com',
      },
      {
        protocol: 'https',
        hostname: 'aljazeera.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/media/file/:path*',
        destination: '/media/:path*',
      },
    ]
  },
}

export default withPayload(nextConfig)
