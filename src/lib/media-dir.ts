import path from 'path'

/**
 * Single source of truth for where uploaded media is stored.
 *
 * In production PM2 runs .next/standalone/server.js, which chdir()s into the build
 * folder. Anything saved under .next/ is deleted by the next `next build`, which is
 * how ~2,800 images were lost across two sites in Sept–Nov 2026. So the upload
 * folder must ALWAYS be the project's own public/media, never a path inside .next.
 */
export function resolveMediaDirectory(
  cwd: string = process.cwd(),
  envDir: string | undefined = process.env.PAYLOAD_MEDIA_DIR,
): string {
  let dir: string
  if (envDir) {
    dir = path.resolve(envDir)
  } else {
    const marker = `${path.sep}.next`
    const i = cwd.indexOf(marker)
    const projectRoot = i === -1 ? cwd : cwd.slice(0, i)
    dir = path.resolve(projectRoot, 'public', 'media')
  }
  assertSafeMediaDirectory(dir)
  return dir
}

/** Throws if the folder is inside a build output that gets wiped on deploy. */
export function assertSafeMediaDirectory(dir: string): void {
  const parts = path.resolve(dir).split(path.sep)
  if (parts.includes('.next')) {
    throw new Error(
      `[media] Refusing to use "${dir}" as the upload folder: it is inside .next/, ` +
        'which is deleted on every build. Uploads would be lost. ' +
        'Set PAYLOAD_MEDIA_DIR to a persistent folder outside .next/.',
    )
  }
}

export const getMediaDirectory = (): string => resolveMediaDirectory()
