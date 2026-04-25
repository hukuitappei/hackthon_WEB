import type { InboxBucket, InboxItem, InboxKind, InboxLabel, OrganizedInboxItem } from './types'

const urgentKeywords = ['today', 'urgent', 'asap', 'before noon', 'before 17:00', 'approval by this afternoon']
const deadlineTimeKeywords = ['17:00', '15:00', '10:00', 'noon', 'afternoon']
const replyKeywords = ['reply', 'confirm', 'approval', 'review', 'respond']
const scheduleKeywords = ['meeting', 'agenda', 'calendar', 'tomorrow morning', 'planning']
const noiseKeywords = ['newsletter', 'digest', 'unsubscribe', 'platform updates', 'noreply']
const highAuthorityKeywords = ['client', 'legal', 'pm', 'manager', 'company.jp']

export function organizeInboxItems(items: InboxItem[]) {
  return items.map(organizeInboxItem)
}

export function organizeInboxItem(item: InboxItem): OrganizedInboxItem {
  const corpus = `${item.subject} ${item.snippet} ${item.from}`.toLowerCase()
  const dueToday = matchesAny(corpus, urgentKeywords) || matchesAny(corpus, deadlineTimeKeywords)
  const replyNeeded = matchesAny(corpus, replyKeywords)
  const likelyNoise = matchesAny(corpus, noiseKeywords)
  const hasSchedule = matchesAny(corpus, scheduleKeywords)
  const senderAuthority = getSenderAuthority(corpus)

  let kind: InboxKind = 'read_later'
  if (likelyNoise) {
    kind = 'subscription_candidate'
  } else if (dueToday) {
    kind = 'deadline'
  } else if (replyNeeded) {
    kind = 'reply_needed'
  } else if (hasSchedule) {
    kind = 'scheduled'
  }

  const bucket = getBucket({ dueToday, replyNeeded, likelyNoise, senderAuthority, hasSchedule })
  const nextAction = getNextAction(kind, item)
  const reason = getReason(kind, bucket, item)
  const confidence = dueToday || likelyNoise ? 'high' : replyNeeded || hasSchedule ? 'medium' : 'low'
  const labelSuggestion = getLabel(bucket, replyNeeded)

  return {
    item,
    kind,
    bucket,
    nextAction,
    reason,
    confidence,
    labelSuggestion,
    signals: {
      dueToday,
      replyNeeded,
      likelyNoise,
      senderAuthority,
    },
  }
}

function getBucket(input: {
  dueToday: boolean
  replyNeeded: boolean
  likelyNoise: boolean
  senderAuthority: 'high' | 'medium' | 'low'
  hasSchedule: boolean
}): InboxBucket {
  if (input.likelyNoise) {
    return 'someday'
  }

  if (input.dueToday || (input.replyNeeded && input.senderAuthority === 'high')) {
    return 'urgent'
  }

  if (input.replyNeeded || input.hasSchedule || input.senderAuthority === 'medium') {
    return 'soon'
  }

  return 'someday'
}

function getLabel(bucket: InboxBucket, replyNeeded: boolean): InboxLabel {
  if (replyNeeded && bucket !== 'someday') {
    return 'ZEN/Reply'
  }

  switch (bucket) {
    case 'urgent':
      return 'ZEN/Urgent'
    case 'soon':
      return 'ZEN/Soon'
    case 'someday':
      return 'ZEN/Someday'
  }
}

function getNextAction(kind: InboxKind, item: InboxItem) {
  switch (kind) {
    case 'deadline':
      return `Reply to ${extractSenderName(item.from)} with a same-day status update.`
    case 'reply_needed':
      return 'Draft a concise reply and confirm the requested decision.'
    case 'scheduled':
      return 'Add the event details to your calendar and review the prep material.'
    case 'subscription_candidate':
      return 'Batch this later or unsubscribe if it adds no near-term value.'
    case 'read_later':
      return 'Park this for a later review block.'
  }
}

function getReason(kind: InboxKind, bucket: InboxBucket, item: InboxItem) {
  switch (kind) {
    case 'deadline':
      return `${item.subject} includes time-sensitive language, so it is treated as ${bucket}.`
    case 'reply_needed':
      return 'The message appears to request a response or approval, so it should stay visible soon.'
    case 'scheduled':
      return 'This message contains meeting or schedule context that benefits from a follow-up soon.'
    case 'subscription_candidate':
      return 'The content looks like recurring informational mail, so it is safe to defer or batch.'
    case 'read_later':
      return 'The message does not show urgent signals and can stay in a lower-priority review bucket.'
  }
}

function getSenderAuthority(corpus: string) {
  if (matchesAny(corpus, highAuthorityKeywords)) {
    return 'high'
  }

  if (corpus.includes('team') || corpus.includes('office')) {
    return 'medium'
  }

  return 'low'
}

function extractSenderName(from: string) {
  return from.split('<')[0].trim()
}

function matchesAny(corpus: string, keywords: string[]) {
  return keywords.some((keyword) => corpus.includes(keyword.toLowerCase()))
}
