import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.pdf': 'application/pdf',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> }
) {
  const { filename } = await params
  if (!filename || filename.length === 0) {
    return new NextResponse('File Not Found', { status: 404 })
  }

  const rawFilename = filename.join('/')
  const baseDir = path.resolve(process.cwd(), 'public/media')
  let filePath = path.resolve(baseDir, rawFilename)

  // Security check: prevent directory traversal
  if (!filePath.startsWith(baseDir)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    // Fallback: if a resized thumbnail was requested (e.g. name-400x267.jpg) but not generated,
    // check if the original file (name.jpg) exists and serve it instead
    const resizedMatch = rawFilename.match(/^(.*)-\d+x\d+(\.[a-zA-Z0-9]+)$/)
    if (resizedMatch) {
      const originalFilename = `${resizedMatch[1]}${resizedMatch[2]}`
      const originalFilePath = path.resolve(baseDir, originalFilename)
      if (originalFilePath.startsWith(baseDir) && fs.existsSync(originalFilePath)) {
        filePath = originalFilePath
      } else {
        return new NextResponse('File Not Found', { status: 404 })
      }
    } else {
      return new NextResponse('File Not Found', { status: 404 })
    }
  }

  try {
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      return new NextResponse('File Not Found', { status: 404 })
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_MAP[ext] || 'application/octet-stream'
    const fileBuffer = fs.readFileSync(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving media file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> }
) {
  const { filename } = await params
  if (!filename || filename.length === 0) {
    return new NextResponse(null, { status: 404 })
  }

  const rawFilename = filename.join('/')
  const baseDir = path.resolve(process.cwd(), 'public/media')
  let filePath = path.resolve(baseDir, rawFilename)

  if (!filePath.startsWith(baseDir)) {
    return new NextResponse(null, { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    const resizedMatch = rawFilename.match(/^(.*)-\d+x\d+(\.[a-zA-Z0-9]+)$/)
    if (resizedMatch) {
      const originalFilename = `${resizedMatch[1]}${resizedMatch[2]}`
      const originalFilePath = path.resolve(baseDir, originalFilename)
      if (originalFilePath.startsWith(baseDir) && fs.existsSync(originalFilePath)) {
        filePath = originalFilePath
      } else {
        return new NextResponse(null, { status: 404 })
      }
    } else {
      return new NextResponse(null, { status: 404 })
    }
  }

  const stats = fs.statSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_MAP[ext] || 'application/octet-stream'

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
