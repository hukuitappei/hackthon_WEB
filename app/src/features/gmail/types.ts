import type { InboxItem, InboxLabel } from '../inbox'

export type GmailConnectionState = 'idle' | 'ready' | 'authorizing' | 'loading' | 'error'

export type GmailConnection = {
  state: GmailConnectionState
  summary: string
  detail?: string
  signedIn: boolean
}

export type GmailLabelRecord = {
  id: string
  name: string
}

export type GmailSyncResult = {
  items: InboxItem[]
  labels: GmailLabelRecord[]
}

export type GmailFeature = {
  connection: GmailConnection
  items: InboxItem[]
  labels: GmailLabelRecord[]
  canUse: boolean
  isBusy: boolean
  signIn: () => Promise<void>
  refreshInbox: () => Promise<void>
  signOut: () => void
  applyLabel: (threadId: string, label: InboxLabel) => Promise<void>
}

export type GmailManagedLabelName = InboxLabel

export type GmailAvailabilityState = 'checking' | 'ready' | 'missing-client-id' | 'unsupported' | 'error'

export type GmailAvailability = {
  state: GmailAvailabilityState
  summary: string
  detail?: string
}

export type GmailAuthState = 'signed_out' | 'authorizing' | 'authorized' | 'error'

export type GmailLabel = GmailLabelRecord & {
  type?: 'system' | 'user'
  messagesTotal?: number
  messagesUnread?: number
}

export type GmailMessageSummary = InboxItem & {
  labels: GmailLabel[]
}

export type GmailMailboxSnapshot = {
  messages: GmailMessageSummary[]
  labels: GmailLabel[]
  fetchedAt: string
  nextPageToken?: string
  resultSizeEstimate: number
}

export type GmailWritebackResult = {
  messageId: string
  labelId: string
  labelName: GmailManagedLabelName
  appliedAt: string
}
