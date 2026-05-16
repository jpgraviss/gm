import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import PublicFunnelPage from './PublicFunnelPage'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ step?: string }>
}

export default async function FunnelPublicPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { step } = await searchParams
  const db = createServiceClient()

  const { data: funnel } = await db
    .from('funnels')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .eq('status', 'Published')
    .single()

  if (!funnel) notFound()

  const { data: pages } = await db
    .from('funnel_pages')
    .select('id, name, slug, blocks, sort_order, views, conversions')
    .eq('funnel_id', funnel.id)
    .order('sort_order', { ascending: true })

  if (!pages || pages.length === 0) notFound()

  const stepSlug = step ?? pages[0].slug
  const currentPage = pages.find((p) => p.slug === stepSlug) ?? pages[0]

  await db
    .from('funnel_pages')
    .update({ views: (currentPage.views ?? 0) + 1 })
    .eq('id', currentPage.id)

  const blocks = (currentPage.blocks ?? []) as Array<{
    id: string
    type: string
    data: Record<string, unknown>
  }>

  return <PublicFunnelPage blocks={blocks} funnelSlug={slug} />
}
