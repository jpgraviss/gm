declare module 'intuit-oauth' {
  interface OAuthClientConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
  }

  interface TokenData {
    token_type: string
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
    realmId: string
    [key: string]: unknown
  }

  interface AuthResponse {
    getToken(): TokenData
  }

  class OAuthClient {
    static scopes: {
      Accounting: string
      Payment: string
      Payroll: string
      TimeTracking: string
      Benefits: string
      Profile: string
      Email: string
      Phone: string
      Address: string
      OpenId: string
      Intuit_name: string
    }

    constructor(config: OAuthClientConfig)
    authorizeUri(options: { scope: string[]; state?: string }): string
    createToken(url: string): Promise<AuthResponse>
    refresh(): Promise<AuthResponse>
    revoke(options: { token: string }): Promise<void>
    setToken(token: TokenData): void
  }

  export = OAuthClient
}
