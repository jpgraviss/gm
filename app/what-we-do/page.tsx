import type { Metadata } from 'next'
import GravHubHome from '@/components/marketing/GravHubHome'

export const metadata: Metadata = {
  title: 'What is GravHub? — Graviss Marketing',
  description: 'GravHub is the operating system Graviss Marketing built to run its own agency — one place for pipeline, proposals, delivery, billing, SEO, and the client relationship.',
}

export default function WhatWeDoPage() {
  return <GravHubHome />
}
