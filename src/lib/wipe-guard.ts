/**
 * Guard for scripts that delete ALL articles/media (seed, clean).
 * Running one against a live database wipes the site, so it requires the caller
 * to type the database name, and refuses on the production server unless a
 * second, explicit flag is also set.
 */
export function assertWipeAllowed(scriptName: string): void {
  const uri = process.env.DATABASE_URI || ''
  let dbName = ''
  let host = ''
  try {
    const u = new URL(uri)
    dbName = u.pathname.replace(/^\//, '')
    host = u.hostname
  } catch {
    // fall through with empty values
  }

  const onProductionServer = process.cwd().startsWith('/var/www/') || process.env.NODE_ENV === 'production'

  console.log(`\n⚠️  ${scriptName} DELETES ALL articles and media (records AND image files).`)
  console.log(`   Database: ${dbName || '(unknown)'} on ${host || '(unknown host)'}`)

  if (!dbName || process.env.CONFIRM_WIPE !== dbName) {
    console.error(`\n❌ Refusing to run. To confirm, re-run with: CONFIRM_WIPE=${dbName || '<database name>'}`)
    process.exit(1)
  }
  if (onProductionServer && process.env.ALLOW_PRODUCTION_WIPE !== 'yes') {
    console.error('\n❌ Refusing to run on the production server. Back up first, then add ALLOW_PRODUCTION_WIPE=yes.')
    process.exit(1)
  }
}
