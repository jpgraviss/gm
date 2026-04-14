// Force dynamic rendering on every request to prevent cached HTML shells.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function TeamLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
