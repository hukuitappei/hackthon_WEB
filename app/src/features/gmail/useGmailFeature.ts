import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InboxLabel } from '../inbox'
import { applyGmailLabel, fetchGmailInbox, getGoogleClientId, getGmailScope, isGoogleAuthConfigured } from './api'
import type { GmailConnection, GmailFeature, GmailLabelRecord } from './types'

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => GoogleTokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void
}

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client'

export function useGmailFeature(): GmailFeature {
  const [connection, setConnection] = useState<GmailConnection>(() => getInitialConnection())
  const [items, setItems] = useState<GmailFeature['items']>([])
  const [labels, setLabels] = useState<GmailLabelRecord[]>([])
  const accessTokenRef = useRef<string>('')
  const tokenClientRef = useRef<GoogleTokenClient | null>(null)

  useEffect(() => {
    if (!isGoogleAuthConfigured()) {
      return
    }

    let cancelled = false

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) {
          return
        }

        const oauth2 = window.google?.accounts?.oauth2
        if (!oauth2) {
          throw new Error('Google Identity Services was not available after script load.')
        }

        tokenClientRef.current = oauth2.initTokenClient({
          client_id: getGoogleClientId(),
          scope: getGmailScope(),
          callback: (response) => {
            if (response.error || !response.access_token) {
              setConnection({
                state: 'error',
                summary: 'Gmail authorization failed.',
                detail: response.error || 'Access token was not returned.',
                signedIn: false,
              })
              return
            }

            accessTokenRef.current = response.access_token
            setConnection({
              state: 'ready',
              summary: 'Gmail is connected.',
              signedIn: true,
            })
            void refreshInbox()
          },
        })

        setConnection({
          state: 'ready',
          summary: 'Google auth is configured. Sign in to load Gmail.',
          signedIn: false,
        })
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setConnection({
          state: 'error',
          summary: 'Failed to initialize Google auth.',
          detail: error instanceof Error ? error.message : 'Unknown Google auth error.',
          signedIn: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function signIn() {
    if (!tokenClientRef.current) {
      setConnection({
        state: 'error',
        summary: 'Google auth client is not ready.',
        detail: 'Set VITE_GOOGLE_CLIENT_ID and reload.',
        signedIn: false,
      })
      return
    }

    setConnection((current) => ({
      ...current,
      state: 'authorizing',
      summary: 'Requesting Gmail permission...',
    }))
    tokenClientRef.current.requestAccessToken({
      prompt: accessTokenRef.current ? '' : 'consent',
    })
  }

  async function refreshInbox() {
    const accessToken = accessTokenRef.current
    if (!accessToken) {
      throw new Error('Gmail is not authorized yet.')
    }

    setConnection((current) => ({
      ...current,
      state: 'loading',
      summary: 'Loading Gmail inbox...',
    }))

    try {
      const result = await fetchGmailInbox(accessToken)
      setItems(result.items)
      setLabels(result.labels)
      setConnection({
        state: 'ready',
        summary: `Loaded ${result.items.length} Gmail messages.`,
        signedIn: true,
      })
    } catch (error) {
      setConnection({
        state: 'error',
        summary: 'Failed to load Gmail inbox.',
        detail: error instanceof Error ? error.message : 'Unknown Gmail loading error.',
        signedIn: true,
      })
      throw error
    }
  }

  const applyLabel = useCallback(async (threadId: string, label: InboxLabel) => {
    const accessToken = accessTokenRef.current
    if (!accessToken) {
      throw new Error('Gmail is not authorized yet.')
    }

    setConnection((current) => ({
      ...current,
      state: 'loading',
      summary: `Applying ${label}...`,
    }))

    try {
      await applyGmailLabel(accessToken, threadId, label)
      await refreshInbox()
    } catch (error) {
      setConnection({
        state: 'error',
        summary: `Failed to apply ${label}.`,
        detail: error instanceof Error ? error.message : 'Unknown Gmail label error.',
        signedIn: true,
      })
      throw error
    }
  }, [])

  function signOut() {
    if (accessTokenRef.current && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(accessTokenRef.current)
    }

    accessTokenRef.current = ''
    setItems([])
    setLabels([])
    setConnection(getInitialConnection())
  }

  return useMemo(
    () => ({
      connection,
      items,
      labels,
      canUse: isGoogleAuthConfigured() && Boolean(tokenClientRef.current),
      isBusy: connection.state === 'authorizing' || connection.state === 'loading',
      signIn,
      refreshInbox,
      signOut,
      applyLabel,
    }),
    [applyLabel, connection, items, labels],
  )
}

function getInitialConnection(): GmailConnection {
  if (!isGoogleAuthConfigured()) {
    return {
      state: 'idle',
      summary: 'Set VITE_GOOGLE_CLIENT_ID to enable Gmail OAuth.',
      signedIn: false,
    }
  }

  return {
    state: 'idle',
    summary: 'Preparing Google auth...',
    signedIn: false,
  }
}

async function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity script.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_IDENTITY_SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity script.'))
    document.head.appendChild(script)
  })
}
