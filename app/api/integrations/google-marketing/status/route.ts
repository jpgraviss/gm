import { NextResponse } from 'next/server'
import { getMarketingIntegrationStatuses } from '@/lib/google-marketing'

export async function GET() {
  const statuses = await getMarketingIntegrationStatuses()
  return NextResponse.json(statuses)
}
