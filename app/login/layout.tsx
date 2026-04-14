// Force dynamic rendering on every request so Vercel's edge cache can't
// serve a stale HTML shell that references old JS chunk hashes. The login
// page MUST always fetch the latest build so users never see a cached
// version of the sign-in flow.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
