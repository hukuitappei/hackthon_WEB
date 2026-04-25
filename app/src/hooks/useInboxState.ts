import { useDeferredValue, useMemo, useState } from 'react'
import {
  inboxSourceOptions,
  manualInboxItems,
  organizeInboxItems,
  sampleInboxItems,
  type InboxBucket,
  type InboxItem,
  type InboxViewSource,
  type OrganizedInboxItem,
} from '../features/inbox'

type UseInboxStateArgs = {
  gmailItems?: InboxItem[]
}

export function useInboxState({ gmailItems = [] }: UseInboxStateArgs = {}) {
  const [searchText, setSearchText] = useState('')
  const [bucketFilter, setBucketFilter] = useState<InboxBucket | 'all'>('all')
  const [selectedSource, setSelectedSource] = useState<InboxViewSource>('mock')
  const sourceItems = useMemo(() => getItemsForSource(selectedSource, gmailItems), [gmailItems, selectedSource])
  const [activeId, setActiveId] = useState(sourceItems[0]?.id ?? '')
  const deferredSearch = useDeferredValue(searchText)

  const organizedItems = useMemo(() => organizeInboxItems(sourceItems), [sourceItems])

  const visibleItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return organizedItems.filter((entry) => {
      const matchesBucket = bucketFilter === 'all' || entry.bucket === bucketFilter
      const matchesSearch =
        query.length === 0 ||
        `${entry.item.subject} ${entry.item.snippet} ${entry.item.from}`.toLowerCase().includes(query)

      return matchesBucket && matchesSearch
    })
  }, [bucketFilter, deferredSearch, organizedItems])

  const activeItem = visibleItems.find((entry) => entry.item.id === activeId) ?? visibleItems[0] ?? null
  const bucketCounts = useMemo(() => countBuckets(organizedItems), [organizedItems])

  return {
    activeItem,
    bucketCounts,
    bucketFilter,
    openOriginalMail,
    organizedItems,
    selectedSource,
    setSelectedSource,
    sourceOptions: inboxSourceOptions,
    totalCount: organizedItems.length,
    visibleItems,
    searchText,
    setActiveId,
    setBucketFilter,
    setSearchText,
  }
}

function countBuckets(items: OrganizedInboxItem[]) {
  return items.reduce(
    (accumulator, item) => {
      accumulator[item.bucket] += 1
      return accumulator
    },
    { urgent: 0, soon: 0, someday: 0 },
  )
}

function getItemsForSource(selectedSource: InboxViewSource, gmailItems: InboxItem[]) {
  switch (selectedSource) {
    case 'manual':
      return manualInboxItems
    case 'gmail':
      return gmailItems
    case 'mock':
      return sampleInboxItems
  }
}

function openOriginalMail(entry: OrganizedInboxItem) {
  if (!entry.item.webLink) {
    return
  }

  window.open(entry.item.webLink, '_blank', 'noopener,noreferrer')
}
