import { NextRequest, NextResponse } from 'next/server'
import { requireWordPressAuth } from '@/lib/wordpress-auth'
import { withErrorHandler } from '@/lib/api-handler'
import path from 'path'
import fs from 'fs'

export const GET = withErrorHandler('wordpress/plugin/download GET', async (req) => {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const zipPath = path.join(process.cwd(), 'public', 'downloads', 'gravhub-seo.zip')

  if (!fs.existsSync(zipPath)) {
    return NextResponse.json(
      { error: 'Plugin zip not built. Run: node scripts/build-plugin-zip.js' },
      { status: 404 }
    )
  }

  const buffer = fs.readFileSync(zipPath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="gravhub-seo.zip"',
      'Content-Length': String(buffer.length),
    },
  })
})
