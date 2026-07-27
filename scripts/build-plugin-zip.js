/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS
   Node script (run directly via `node scripts/build-plugin-zip.js`, not
   compiled), not part of the Next.js app's ESM module graph. */
const { ZipArchive } = require('archiver')
const fs = require('fs')
const path = require('path')

const pluginDir = path.join(__dirname, '..', 'wordpress', 'gravhub-seo')
const outPath = path.join(__dirname, '..', 'public', 'downloads', 'gravhub-seo.zip')

if (!fs.existsSync(pluginDir)) {
  console.error('Plugin directory not found:', pluginDir)
  process.exit(1)
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })

const output = fs.createWriteStream(outPath)
const archive = new ZipArchive({ zlib: { level: 9 } })

output.on('close', () => {
  console.log(`gravhub-seo.zip created (${(archive.pointer() / 1024).toFixed(1)} KB)`)
})

archive.on('error', (err) => { throw err })
archive.pipe(output)
// Pin every entry's timestamp instead of letting archiver read each
// source file's real mtime. The CI check (see ci.yml's "WordPress plugin
// zip is up to date" step) rebuilds this zip fresh from a freshly
// checked-out working tree and diffs it byte-for-byte against this
// committed file -- a fresh git checkout resets file mtimes to checkout
// time, which never matches whatever mtimes happened to be on disk when
// this zip was originally built, so the byte-for-byte comparison failed
// on every rebuild regardless of whether the source had actually changed.
archive.directory(pluginDir, 'gravhub-seo', { date: new Date(0) })
archive.finalize()
