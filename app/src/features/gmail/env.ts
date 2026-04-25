export const gmailClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''

export function hasGmailClientId() {
  return gmailClientId.length > 0
}
