import type { OrganizedInboxItem } from './types'

export function buildInboxItemPrompt(activeItem: OrganizedInboxItem) {
  return [
    `Sender: ${activeItem.item.from}`,
    `Subject: ${activeItem.item.subject}`,
    `Snippet: ${activeItem.item.snippet}`,
    `Suggested bucket: ${activeItem.bucket}`,
    `Suggested label: ${activeItem.labelSuggestion}`,
    `Suggested next action: ${activeItem.nextAction}`,
    'Reply with: 1) a short summary, 2) one next action, 3) a confidence caveat if needed.',
  ].join('\n')
}

export function buildInboxReorganizationPrompt(items: OrganizedInboxItem[]) {
  const lines = items.map((entry, index) => {
    return [
      `${index + 1}. ${entry.item.subject}`,
      `from=${entry.item.from}`,
      `bucket=${entry.bucket}`,
      `kind=${entry.kind}`,
      `label=${entry.labelSuggestion}`,
      `received=${entry.item.receivedAt}`,
      `snippet=${entry.item.snippet}`,
      `next_action=${entry.nextAction}`,
    ].join(' | ')
  })

  return [
    'You are ZEN Inbox.',
    'Reorganize the whole inbox list, not a single message.',
    'Return concise plain text in this order:',
    '1. Today focus: top 3 messages with why.',
    '2. Suggested bucket adjustments: mention only items that should move.',
    '3. Batch actions: 2-4 actions that reduce inbox load.',
    '4. Risks: note any low-confidence or privacy-sensitive decisions.',
    '',
    'Inbox snapshot:',
    ...lines,
  ].join('\n')
}
