import { useEffect, useMemo, useRef, useState } from 'react'
import type { GmailAvailability, GmailAuthState, GmailMailboxSnapshot, GmailManagedLabelName, GmailWritebackResult } from './types'
import { applyGmailLabelToMessage, ensureGmailLabel, fetchGmailMailboxSnapshot } from './api'
import { getGmailAvailability, requestGmailAccessToken, revokeGmailAccessToken } from './googleIdentity'

const GMAIL_EXCLUSIVE_BUCKET_LABELS: GmailManagedLabelName[] = ['ZEN/Urgent', 'ZEN/Soon', 'ZEN/Someday']

export function useGmailFoundation() {
  const [availability, setAvailability] = useState<GmailAvailability>({
    state: 'checking',
    summary: 'Checking Gmail integration availability.',
  })
  const [authState, setAuthState] = useState<GmailAuthState>('signed_out')
  const [authError, setAuthError] = useState('')
  const [mailbox, setMailbox] = useState<GmailMailboxSnapshot | null>(null)
  const [mailboxError, setMailboxError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isApplyingLabel, setIsApplyingLabel] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState('')
  const [lastWriteback, setLastWriteback] = useState<GmailWritebackResult | null>(null)
  const accessTokenRef = useRef('')

  useEffect(() => {
    let active = true

    async function checkAvailability() {
      const nextAvailability = await getGmailAvailability()
      if (active) {
        setAvailability(nextAvailability)
      }
    }

    void checkAvailability()

    return () => {
      active = false
    }
  }, [])

  const selectedMessage = useMemo(
    () => {
      if (!mailbox?.messages.length) {
        return null
      }

      if (selectedMessageId) {
        const selected = mailbox.messages.find((message) => message.id === selectedMessageId)
        if (selected) {
          return selected
        }
      }

      return mailbox.messages[0] ?? null
    },
    [mailbox, selectedMessageId],
  )

  async function connect() {
    setAuthState('authorizing')
    setAuthError('')

    try {
      const tokenResponse = await requestGmailAccessToken('consent')
      accessTokenRef.current = tokenResponse.access_token ?? ''
      setAuthState('authorized')
      await refreshMailbox()
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to authorize Gmail access.'
      setAuthState('error')
      setAuthError(detail)
    }
  }

  async function disconnect() {
    const accessToken = accessTokenRef.current
    accessTokenRef.current = ''
    setAuthState('signed_out')
    setAuthError('')
    setMailbox(null)
    setMailboxError('')
    setLastWriteback(null)
    setSelectedMessageId('')

    if (accessToken) {
      await revokeGmailAccessToken(accessToken)
    }
  }

  async function refreshMailbox() {
    if (!accessTokenRef.current) {
      setMailboxError('Connect Gmail before fetching mailbox data.')
      return
    }

    setIsRefreshing(true)
    setMailboxError('')

    try {
      const snapshot = await fetchGmailMailboxSnapshot(accessTokenRef.current)
      setMailbox(snapshot)
      setAuthState('authorized')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to fetch Gmail mailbox data.'
      setMailboxError(detail)
      if (detail.includes('401') || detail.includes('403')) {
        setAuthState('error')
        setAuthError('Gmail access expired or was rejected. Reconnect and try again.')
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  async function applyManagedLabel(labelName: GmailManagedLabelName) {
    const accessToken = accessTokenRef.current

    if (!accessToken || !mailbox || !selectedMessage) {
      return
    }

    setIsApplyingLabel(true)
    setMailboxError('')

    try {
      const targetLabel = await ensureGmailLabel(accessToken, labelName, mailbox.labels)
      const removeLabelIds =
        GMAIL_EXCLUSIVE_BUCKET_LABELS.includes(labelName)
          ? selectedMessage.labels
              .filter((label) => GMAIL_EXCLUSIVE_BUCKET_LABELS.includes(label.name as GmailManagedLabelName) && label.name !== labelName)
              .map((label) => label.id)
          : []

      await applyGmailLabelToMessage(accessToken, selectedMessage.id, [targetLabel.id], removeLabelIds)
      setLastWriteback({
        messageId: selectedMessage.id,
        labelId: targetLabel.id,
        labelName,
        appliedAt: new Date().toISOString(),
      })
      await refreshMailbox()
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to write Gmail labels.'
      setMailboxError(detail)
    } finally {
      setIsApplyingLabel(false)
    }
  }

  return {
    availability,
    authError,
    authState,
    connect,
    disconnect,
    refreshMailbox,
    applyManagedLabel,
    isApplyingLabel,
    isRefreshing,
    lastWriteback,
    mailbox,
    mailboxError,
    selectedMessage,
    selectedMessageId,
    setSelectedMessageId,
  }
}
