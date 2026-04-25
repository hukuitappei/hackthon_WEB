import { gmailClientId, hasGmailClientId } from './env'
import type { GmailAvailability } from './types'

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let googleIdentityPromise: Promise<GoogleIdentityServices> | null = null

export const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
].join(' ')

export async function getGmailAvailability(): Promise<GmailAvailability> {
  if (!hasGmailClientId()) {
    return {
      state: 'missing-client-id',
      summary: 'Google OAuth client ID is not configured.',
      detail: 'Set VITE_GOOGLE_CLIENT_ID before trying Gmail auth.',
    }
  }

  try {
    await loadGoogleIdentityServices()
    return {
      state: 'ready',
      summary: 'Google Identity Services is ready.',
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Google Identity Services error.'
    return {
      state: 'unsupported',
      summary: 'Google Identity Services could not be loaded.',
      detail,
    }
  }
}

export function loadGoogleIdentityServices() {
  const loadedGoogle = getLoadedGoogleIdentityServices(window.google)
  if (loadedGoogle) {
    return Promise.resolve(loadedGoogle)
  }

  if (googleIdentityPromise) {
    return googleIdentityPromise
  }

  googleIdentityPromise = new Promise<GoogleIdentityServices>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null

    const handleLoad = () => {
      const nextGoogle = getLoadedGoogleIdentityServices(window.google)
      if (nextGoogle) {
        resolve(nextGoogle)
        return
      }

      reject(new Error('Google Identity Services loaded without oauth2 support.'))
    }

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = handleLoad
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'))
    document.head.appendChild(script)
  })

  return googleIdentityPromise
}

export async function requestGmailAccessToken(prompt: '' | 'consent' | 'select_account' = 'consent') {
  if (!hasGmailClientId()) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is missing.')
  }

  const google = await loadGoogleIdentityServices()

  return new Promise<GoogleTokenResponse>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: gmailClientId,
      scope: GMAIL_OAUTH_SCOPES,
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google OAuth did not return an access token.'))
          return
        }

        resolve(response)
      },
      error_callback: (response: GoogleTokenClientErrorResponse) => {
        reject(new Error(response.message || response.type || 'Google OAuth popup failed.'))
      },
    })

    client.requestAccessToken({ prompt })
  })
}

export async function revokeGmailAccessToken(accessToken: string) {
  if (!accessToken) {
    return
  }

  const google = await loadGoogleIdentityServices()

  await new Promise<void>((resolve) => {
    google.accounts.oauth2.revoke(accessToken, () => resolve())
  })
}

function getLoadedGoogleIdentityServices(value: Window['google']) {
  if (!value?.accounts?.oauth2) {
    return null
  }

  return value as GoogleIdentityServices
}
