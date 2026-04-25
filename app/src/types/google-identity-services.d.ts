export {}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }

  interface GoogleIdentityServices {
    accounts: GoogleAccountsNamespace
  }

  interface GoogleAccountsNamespace {
    oauth2: GoogleOAuth2Namespace
  }

  interface GoogleOAuth2Namespace {
    initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient
    revoke(token: string, callback?: () => void): void
  }

  interface GoogleTokenClientConfig {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (response: GoogleTokenClientErrorResponse) => void
  }

  interface GoogleTokenClient {
    requestAccessToken(options?: GoogleRequestAccessTokenOptions): void
  }

  interface GoogleRequestAccessTokenOptions {
    prompt?: '' | 'consent' | 'select_account'
    hint?: string
  }

  interface GoogleTokenResponse {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
    scope?: string
    token_type?: string
  }

  interface GoogleTokenClientErrorResponse {
    type: string
    message?: string
  }
}
