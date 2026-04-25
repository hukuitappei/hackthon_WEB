export type InboxSource = 'gmail' | 'manual_import' | 'slack' | 'line' | 'mock'

export type InboxViewSource = 'mock' | 'manual' | 'gmail'

export type InboxKind =
  | 'reply_needed'
  | 'scheduled'
  | 'deadline'
  | 'read_later'
  | 'subscription_candidate'

export type InboxBucket = 'urgent' | 'soon' | 'someday'

export type InboxLabel = 'ZEN/Urgent' | 'ZEN/Soon' | 'ZEN/Someday' | 'ZEN/Reply'

export type InboxItem = {
  id: string
  source: InboxSource
  threadId: string
  subject: string
  from: string
  snippet: string
  receivedAt: string
  isUnread: boolean
  hasAttachment?: boolean
  webLink?: string
  originalLabel?: string
  labelIds?: string[]
}

export type InboxSignal = {
  dueToday: boolean
  replyNeeded: boolean
  likelyNoise: boolean
  senderAuthority: 'high' | 'medium' | 'low'
}

export type OrganizedInboxItem = {
  item: InboxItem
  kind: InboxKind
  bucket: InboxBucket
  nextAction: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
  labelSuggestion: InboxLabel
  signals: InboxSignal
}

export type InboxSourceOption = {
  id: InboxViewSource
  label: string
  description: string
}
