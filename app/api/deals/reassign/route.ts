import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { fromRep, toRep } = await req.json()

  if (!fromRep || !toRep) {
    return NextResponse.json({ error: 'fromRep and toRep are required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('deals')
    .update({ assigned_rep: toRep })
    .eq('assigned_rep', fromRep)
    .select('id')

  if (error) {
    console.error('[deals/reassign POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reassigned: data?.length ?? 0 })
}
