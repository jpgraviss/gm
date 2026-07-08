import { proxy } from './proxy'

export default proxy

export const config = {
  matcher: '/api/:path*',
}
