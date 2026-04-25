# Cloud AI Consent Policy (v1)

Last updated: 2026-04-25
Scope: `app/src/lib/ai.ts`, `app/src/App.tsx`

## Policy

- Default behavior: cloud processing is disabled.
- Gemini API execution requires explicit user consent (`allowCloudProcessing = true`).
- Before sending prompt text to cloud providers, the app must sanitize common sensitive patterns:
  - email addresses
  - phone numbers
  - URLs
- UI must disclose whether processing is local (Chrome Built-in AI) or cloud (Gemini API).
- Provider failure messages shown in UI must not expose raw upstream payloads containing mailbox content.

## Implementation mapping

- Consent gate: `AIRequest.allowCloudProcessing` checked in Gemini provider.
- Sanitization: `sanitizeForCloud()` in `app/src/lib/ai.ts`.
- User control: cloud consent checkbox in `app/src/App.tsx`.

## Out of scope (still required for Gmail production)

- Full PII redaction beyond regex-based masking.
- Per-message granular consent history and audit log.
- DLP scanning, encryption-at-rest policy, and retention controls.
