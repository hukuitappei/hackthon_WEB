import type { GmailAvailabilityState, GmailManagedLabelName } from './types'
import { useGmailFoundation } from './useGmailFoundation'
import './GmailFoundation.css'

const MANAGED_LABELS: GmailManagedLabelName[] = ['ZEN/Urgent', 'ZEN/Soon', 'ZEN/Someday', 'ZEN/Reply']

const availabilityCopy: Record<GmailAvailabilityState, string> = {
  checking: 'Checking',
  ready: 'Ready',
  'missing-client-id': 'Needs env',
  unsupported: 'Unavailable',
  error: 'Error',
}

export function GmailFoundationPanel() {
  const {
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
  } = useGmailFoundation()

  const isBusy = authState === 'authorizing' || isRefreshing || isApplyingLabel

  return (
    <section className="panel gmail-foundation">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Gmail foundation</p>
          <h2>Google Identity Services auth, real mailbox fetch, and label writeback</h2>
        </div>
        <span className="pill">{availabilityCopy[availability.state]}</span>
      </div>

      <div className="gmail-foundation-status">
        <p className="gmail-foundation-note">
          {availability.summary} {availability.detail ? `(${availability.detail})` : ''}
        </p>
        <div className="gmail-foundation-actions">
          <button
            className="gmail-foundation-button"
            disabled={availability.state !== 'ready' || isBusy}
            onClick={() => void connect()}
            type="button"
          >
            {authState === 'authorized' ? 'Reconnect Gmail' : 'Connect Gmail'}
          </button>
          <button
            className="gmail-foundation-button"
            disabled={authState !== 'authorized' || isBusy}
            onClick={() => void refreshMailbox()}
            type="button"
          >
            Refresh mailbox
          </button>
          <button
            className="gmail-foundation-button"
            disabled={authState === 'signed_out' || isBusy}
            onClick={() => void disconnect()}
            type="button"
          >
            Disconnect
          </button>
        </div>
      </div>

      <p className="section-note">
        This is frontend-only: the OAuth access token stays in memory, fetches the latest 10 Gmail messages, and can create/apply the
        ZEN labels directly through Gmail REST.
      </p>

      {authError ? <p className="gmail-foundation-error">{authError}</p> : null}
      {mailboxError ? <p className="gmail-foundation-error">{mailboxError}</p> : null}
      {lastWriteback ? (
        <p className="gmail-foundation-note">
          Last writeback: {lastWriteback.labelName} on message {lastWriteback.messageId} at {formatDateTime(lastWriteback.appliedAt)}.
        </p>
      ) : null}

      {mailbox ? (
        <div className="gmail-foundation-grid">
          <div className="gmail-foundation-list">
            <p className="section-note">
              Loaded {mailbox.messages.length} message(s) from Gmail. Estimated mailbox result size: {mailbox.resultSizeEstimate}. Last sync:{' '}
              {formatDateTime(mailbox.fetchedAt)}.
            </p>
            {mailbox.messages.length > 0 ? (
              mailbox.messages.map((message) => (
                <button
                  key={message.id}
                  className={selectedMessageId === message.id ? 'gmail-foundation-message active' : 'gmail-foundation-message'}
                  onClick={() => setSelectedMessageId(message.id)}
                  type="button"
                >
                  <div className="gmail-foundation-meta">
                    <span className="gmail-foundation-chip">{message.isUnread ? 'Unread' : 'Read'}</span>
                    <span className="gmail-foundation-chip">{formatDateTime(message.receivedAt)}</span>
                  </div>
                  <h3>{message.subject}</h3>
                  <p>{message.from}</p>
                  <p>{message.snippet || 'No snippet returned by Gmail.'}</p>
                  <div className="gmail-foundation-labels">
                    {message.labels.length > 0 ? (
                      message.labels.map((label) => (
                        <span key={`${message.id}-${label.id}`} className="gmail-foundation-chip">
                          {label.name}
                        </span>
                      ))
                    ) : (
                      <span className="gmail-foundation-chip">No labels</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <p className="gmail-foundation-note">No messages returned for the current Gmail account.</p>
            )}
          </div>

          <div className="gmail-foundation-detail">
            <div className="gmail-foundation-detail-card">
              {selectedMessage ? (
                <>
                  <h3>{selectedMessage.subject}</h3>
                  <p>{selectedMessage.from}</p>
                  <p>{selectedMessage.snippet || 'No snippet returned by Gmail.'}</p>
                  <div className="gmail-foundation-labels">
                    {selectedMessage.labels.map((label) => (
                      <span key={`${selectedMessage.id}-${label.id}`} className="gmail-foundation-chip">
                        {label.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p>Select a Gmail message to inspect and label.</p>
              )}
            </div>

            <div className="gmail-foundation-detail-card">
              <h3>Write back ZEN labels</h3>
              <p className="section-note">Bucket labels are exclusive across `ZEN/Urgent`, `ZEN/Soon`, and `ZEN/Someday`. `ZEN/Reply` is additive.</p>
              <div className="gmail-foundation-writeback">
                {MANAGED_LABELS.map((labelName) => (
                  <button
                    key={labelName}
                    className="gmail-foundation-button"
                    disabled={!selectedMessage || isBusy}
                    onClick={() => void applyManagedLabel(labelName)}
                    type="button"
                  >
                    Apply {labelName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="gmail-foundation-note">Authorize Gmail to fetch real mailbox data and enable label writeback.</p>
      )}
    </section>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
