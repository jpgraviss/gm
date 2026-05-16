import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ embed?: string }>
}

export default async function LegacyFormRedirect({ params, searchParams }: Props) {
  const { slug } = await params
  const { embed } = await searchParams
  const qs = embed ? `?embed=${embed}` : ''
  redirect(`/go/form/${slug}${qs}`)
}
