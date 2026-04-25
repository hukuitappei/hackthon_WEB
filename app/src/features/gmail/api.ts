import type { InboxItem, InboxLabel } from '../inbox'
import type {
  GmailLabel,
  GmailLabelRecord,
  GmailMailboxSnapshot,
  GmailManagedLabelName,
  GmailMessageSummary,
  GmailSyncResult,
} from './types'

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'
const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me'

type GmailMessageListResponse = {
  messages?: Array<{
    id: string
    threadId: string
  }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

type GmailMessageResponse = {
  id: string
  threadId: string
  labelIds?: string[]
  internalDate?: string
  snippet?: string
  payload?: {
    headers?: Array<{
      name?: string
      value?: string
    }>
  }
}

type GmailLabelsResponse = {
  labels?: Array<{
    id?: string
    name?: string
    type?: 'system' | 'user'
    messagesTotal?: number
    messagesUnread?: number
  }>
}

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
}

export function isGoogleAuthConfigured() {
  return getGoogleClientId().length > 0
}

export function getGmailScope() {
  return GMAIL_SCOPE
}

export async function fetchGmailInbox(accessToken: string): Promise<GmailSyncResult> {
  const [messageList, labels] = await Promise.all([fetchMessageList(accessToken), fetchGmailLabels(accessToken)])
  const items = await Promise.all(messageList.map((message) => fetchGmailMessage(accessToken, message.id, message.threadId)))

  return {
    items,
    labels,
  }
}

export async function applyGmailLabel(accessToken: string, threadId: string, label: InboxLabel) {
  const labels = await fetchGmailLabels(accessToken)
  const labelId = await ensureLabel(accessToken, labels, label)

  await gmailFetch(`/threads/${threadId}/modify`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds: [labelId],
    }),
  })
}

export async function fetchGmailMailboxSnapshot(accessToken: string): Promise<GmailMailboxSnapshot> {
  const [messageListResponse, labels] = await Promise.all([fetchMessageListResponse(accessToken), listGmailLabels(accessToken)])
  const labelMap = new Map(labels.map((label) => [label.id, label]))
  const messages = await Promise.all(
    (messageListResponse.messages ?? []).map((message) => fetchGmailMessageSummary(accessToken, message.id, message.threadId, labelMap)),
  )

  return {
    messages,
    labels,
    fetchedAt: new Date().toISOString(),
    nextPageToken: messageListResponse.nextPageToken,
    resultSizeEstimate: messageListResponse.resultSizeEstimate ?? messages.length,
  }
}

export async function listGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const response = await gmailFetch('/labels', accessToken)
  const data = (await response.json()) as GmailLabelsResponse

  return (data.labels ?? [])
    .filter((label): label is { id: string; name: string; type?: 'system' | 'user'; messagesTotal?: number; messagesUnread?: number } =>
      Boolean(label.id && label.name),
    )
    .map((label) => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
    }))
}

export async function ensureGmailLabel(accessToken: string, labelName: GmailManagedLabelName, labels?: GmailLabel[]) {
  const availableLabels = labels ?? (await listGmailLabels(accessToken))
  const existing = availableLabels.find((label) => label.name === labelName)
  if (existing) {
    return existing
  }

  const response = await gmailFetch('/labels', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  })
  const created = (await response.json()) as {
    id?: string
    name?: string
    type?: 'system' | 'user'
    messagesTotal?: number
    messagesUnread?: number
  }

  if (!created.id || !created.name) {
    throw new Error(`Failed to create Gmail label: ${labelName}`)
  }

  return {
    id: created.id,
    name: created.name,
    type: created.type,
    messagesTotal: created.messagesTotal,
    messagesUnread: created.messagesUnread,
  } satisfies GmailLabel
}

export async function applyGmailLabelToMessage(
  accessToken: string,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[] = [],
) {
  await gmailFetch(`/messages/${messageId}/modify`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds,
      removeLabelIds,
    }),
  })
}

async function fetchMessageList(accessToken: string) {
  const data = await fetchMessageListResponse(accessToken)
  return data.messages ?? []
}

async function fetchGmailMessage(accessToken: string, messageId: string, threadId: string): Promise<InboxItem> {
  const response = await gmailFetch(
    `/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
    accessToken,
  )
  const data = (await response.json()) as GmailMessageResponse
  const headers = Object.fromEntries((data.payload?.headers ?? []).map((header) => [header.name ?? '', header.value ?? '']))

  return {
    id: data.id,
    source: 'gmail',
    threadId,
    subject: headers.Subject || '(no subject)',
    from: headers.From || 'Unknown sender',
    snippet: data.snippet || '',
    receivedAt: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : new Date().toISOString(),
    isUnread: data.labelIds?.includes('UNREAD') ?? false,
    hasAttachment: data.labelIds?.includes('CATEGORY_UPDATES') ?? false,
    webLink: `https://mail.google.com/mail/u/0/#all/${threadId}`,
    labelIds: data.labelIds ?? [],
  }
}

async function fetchGmailLabels(accessToken: string): Promise<GmailLabelRecord[]> {
  const labels = await listGmailLabels(accessToken)
  return labels.map((label) => ({
    id: label.id,
    name: label.name,
  }))
}

async function ensureLabel(accessToken: string, labels: GmailLabelRecord[], labelName: InboxLabel) {
  const existing = labels.find((label) => label.name === labelName)
  if (existing) {
    return existing.id
  }

  const response = await gmailFetch('/labels', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  })
  const created = (await response.json()) as { id?: string }

  if (!created.id) {
    throw new Error(`Failed to create Gmail label: ${labelName}`)
  }

  return created.id
}

async function fetchMessageListResponse(accessToken: string) {
  const response = await gmailFetch('/messages?maxResults=12&q=in:inbox', accessToken)
  return (await response.json()) as GmailMessageListResponse
}

async function fetchGmailMessageSummary(
  accessToken: string,
  messageId: string,
  threadId: string,
  labelMap: Map<string, GmailLabel>,
): Promise<GmailMessageSummary> {
  const item = await fetchGmailMessage(accessToken, messageId, threadId)

  return {
    ...item,
    labels: (item.labelIds ?? []).map((labelId) => labelMap.get(labelId)).filter((label): label is GmailLabel => Boolean(label)),
  }
}

async function gmailFetch(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`${GMAIL_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gmail API request failed (${response.status}): ${detail}`)
  }

  return response
}
