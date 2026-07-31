import type { Metadata } from 'next'
import GravHubHome from '@/components/marketing/GravHubHome'

const TITLE = 'GravHub — The Agency Operating System'
const DESCRIPTION = 'GravHub is the operating system for running an agency end to end — pipeline, proposals, delivery, billing, SEO operations, and the client relationship, all in one place.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'GravHub',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function WhatWeDoPage() {
  return <GravHubHome />
}
