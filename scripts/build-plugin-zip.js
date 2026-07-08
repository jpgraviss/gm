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
archive.directory(pluginDir, 'gravhub-seo')
archive.finalize()
