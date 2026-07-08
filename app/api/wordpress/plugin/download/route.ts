import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import path from 'path'
import fs from 'fs'
import { PassThrough } from 'stream'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('wordpress/plugin/download GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const pluginDir = path.join(process.cwd(), 'wordpress', 'gravhub-seo')

  if (!fs.existsSync(pluginDir)) {
    return NextResponse.json({ error: 'Plugin directory not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const archiver = require('archiver')

  const passthrough = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 9 } })

  archive.on('error', (err: Error) => {
    console.error('[plugin/download]', err)
  })

  archive.pipe(passthrough)
  archive.directory(pluginDir, 'gravhub-seo')
  archive.finalize()

  const chunks: Buffer[] = []
  for await (const chunk of passthrough) {
    chunks.push(Buffer.from(chunk))
  }
  const buffer = Buffer.concat(chunks)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="gravhub-seo.zip"',
      'Content-Length': String(buffer.length),
    },
  })
})
