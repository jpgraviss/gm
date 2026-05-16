import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ step?: string }>
}

export default async function LegacyFunnelRedirect({ params, searchParams }: Props) {
  const { slug } = await params
  const { step } = await searchParams
  const qs = step ? `?step=${step}` : ''
  redirect(`/go/page/${slug}${qs}`)
}
