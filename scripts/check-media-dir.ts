// Run: npx tsx scripts/check-media-dir.ts  (deploy.sh runs this before every build)
import path from 'path'
import { resolveMediaDirectory } from '../src/lib/media-dir'

const root = '/var/www/site'
const expected = path.join(root, 'public', 'media')
let failed = 0
const check = (label: string, fn: () => string | void, want: string | 'throws') => {
  try {
    const got = fn()
    if (want === 'throws') { failed++; console.error(`✗ ${label}: expected an error, got ${got}`) }
    else if (got !== want) { failed++; console.error(`✗ ${label}: got ${got}, want ${want}`) }
    else console.log(`✓ ${label}`)
  } catch (e) {
    if (want === 'throws') console.log(`✓ ${label} (refused)`)
    else { failed++; console.error(`✗ ${label}: ${(e as Error).message}`) }
  }
}

check('project root', () => resolveMediaDirectory(root, undefined), expected)
check('running from .next/standalone (production)', () => resolveMediaDirectory(`${root}/.next/standalone`, undefined), expected)
check('running from nested .next path', () => resolveMediaDirectory(`${root}/.next/standalone/.next/server`, undefined), expected)
check('PAYLOAD_MEDIA_DIR override', () => resolveMediaDirectory(root, '/data/media'), '/data/media')
check('override pointing inside .next is refused', () => resolveMediaDirectory(root, `${root}/.next/standalone/public/media`), 'throws')
check('actual resolution for this checkout', () => {
  const d = resolveMediaDirectory()
  if (d.split(path.sep).includes('.next')) throw new Error(d)
  return d
}, resolveMediaDirectory())

if (failed) { console.error(`\n❌ media-dir check failed (${failed})`); process.exit(1) }
console.log('\n✅ media-dir check passed')
