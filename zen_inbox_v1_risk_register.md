# ZEN Inbox v1 Risk Register

Last updated: 2026-04-25
Owner: Codex risk review
Scope: security, privacy, misclassification, UX, and Chrome dependency risks for ZEN Inbox v1

## Current baseline

- Requirements expect Gmail-first inbox organization, AI plus rule-based classification, Gmail label writeback, safe fallback when Gmail or AI is unavailable, and Chrome-first delivery. See `plan3_requirements.md:20-22`, `plan3_requirements.md:97-105`, `plan3_requirements.md:179-203`, `plan3_requirements.md:218-276`.
- Current app code now ships source-switchable inbox triage (`mock/manual/gmail`), Gmail OAuth ingestion and label writeback wiring, plus deterministic fallback and cloud-AI consent gating. Persistence for user corrections is still missing. See `app/src/App.tsx`, `app/src/features/gmail/*`, `app/src/features/inbox/organize.ts`, `app/src/hooks/useInboxState.ts`, `app/src/lib/ai.ts`.
- Current AI layer prefers Chrome built-in AI, falls back to Gemini API, and sends prompts directly to Google when API mode is enabled. See `app/src/lib/ai.ts:37-100`, `app/src/lib/ai.ts:117-183`, `app/.env.example:1-2`.
- Canonical status precedence for contributors: `app/README.md` (developer onboarding) -> this risk register (risk posture) -> `plan3_requirements.md` (target requirements).

## Priority risks

| Priority | Category | Risk | Why it matters now | Mitigation | Recheck trigger |
| --- | --- | --- | --- | --- | --- |
| P0 | Privacy | Raw Gmail contents may be sent to Gemini API fallback without explicit per-message consent, redaction, or provider disclosure. | v1 requires Gmail ingestion and AI assistance, while current cloud fallback posts prompt text to `generativelanguage.googleapis.com`. This becomes a direct privacy breach if mail bodies, names, or contracts are forwarded as-is. | Default to on-device or rule-based processing for Gmail data. Require an explicit "send to cloud AI" toggle, redact sender addresses and quoted history before upload, log provider choice in UI, and keep cloud off by default for production demos. | When Gmail adapter or classification prompt wiring is added. |
| P0 | Security | Gmail writeback can apply wrong labels or touch the wrong thread if item identity mapping is weak. | v1 requires Gmail label writeback only, which is safer than edits, but still changes user state in Gmail. A mismatch between inbox item IDs and Gmail thread/message IDs can silently corrupt organization. | Keep immutable source identifiers, require idempotent writeback, dry-run mode for demo, confirmation on bulk actions, and audit entries for each label mutation. | When any Gmail write API or label mutation UI is introduced. |
| P0 | Misclassification | The product may present AI judgments as facts even though requirements say AI is advisory and uncertain results must be shown as candidates. | Requirements explicitly say the final judgment belongs to the user and uncertain outputs should be shown as candidates. If the UI collapses this nuance, users will miss urgent mail or ignore important follow-ups. | Store confidence and rationale per classification, show "candidate" wording below threshold, allow one-click correction, and feed corrections into deterministic rules before AI. | When inbox list UI and classification data model are added. |
| P1 | UX | Fallback behavior is partially defined, but still lacks degraded-mode persistence safeguards. | Requirements require safe transitions to empty, error, or demo states and rule-based fallback when AI is unavailable. Current app now surfaces runtime states in the inbox flow, but does not preserve last-successful local snapshot. | Keep explicit UI states for `loading`, `demo`, `empty`, `permission-needed`, and `writeback-failed`; add degraded snapshot fallback and recovery messaging. | When offline cache or persistence is introduced. |
| P1 | Chrome dependency | Chrome Built-in AI availability varies by device, version, download state, and flags; depending on it for core inbox value risks demo failure. | Requirements prefer Chrome and on-device AI, but also say center value must survive without it. Current code already distinguishes `ready`, `downloadable`, and `unavailable`, which implies unstable availability across environments. | Treat built-in AI as optimization, not dependency. Prepare deterministic rule fallback and mock-data demo path, and add a pre-demo environment checklist with exact Chrome version and model download status. | Before every demo and when using Prompt API for real classification. |
| P1 | Privacy | Gmail-derived data may be persisted unsafely in browser storage, logs, screenshots, or error messages during development. | The current code surfaces raw provider errors to the UI. Once Gmail data is attached to prompts or failures, stack traces and debug logs can leak sensitive content. | Ban storing raw mail bodies in `localStorage` by default, sanitize errors before rendering, separate demo data from real data, and add a "clear local data" action. | When local cache, dev logging, or offline snapshot features are introduced. |
| P1 | Security | OAuth scope sprawl may exceed the v1 requirement of "read + label writeback only". | Gmail integration is not implemented yet, which is exactly when scope creep is easiest to prevent. Overbroad scopes increase blast radius if tokens leak or the app is misused. | Lock the scope set early, document it in code and README, refuse send/delete/archive scopes in v1, and validate granted scopes on startup. | When Google auth is added. |
| P2 | Misclassification | `urgent / soon / someday` compression can hide deadline ambiguity, cross-thread context, or sender authority. | Requirements force a three-bucket priority view. That is good for clarity but dangerous when urgency depends on hidden context such as overdue replies, forwarded chains, or meeting time zones. | Add supporting signals beside the bucket: due date, sender, unread count, reply-needed flag, and "why classified" hints. Let users sort by multiple dimensions, not bucket alone. | When the priority list view is implemented. |
| P2 | UX | Manual corrections may not survive reclassification, causing label thrash and loss of trust. | Requirements expect persistent states like `未処理 / 保留 / 今日やる / 要返信` and actual organization actions. If nightly refresh or AI reruns overwrite user changes, the inbox becomes hostile. | Separate user-owned state from model-owned suggestions, give user state precedence, and require explicit reset before reclassifying corrected items. | When state persistence or periodic refresh is added. |
| P2 | Chrome dependency | The app is nominally Chrome-first, but current build behavior is already fragile in this environment. | `npm run build` currently fails with `spawn EPERM` while loading Vite config, so the release path is not yet reliable even before Gmail logic lands. | Reproduce outside sandbox, document the required build environment, and add CI or at least one clean build path before demo freeze. | Before release or branch handoff. |
| P2 | Privacy | Demo mode can accidentally mix mock and real Gmail data, leading to embarrassing screen exposure. | Requirements want easy switching among mock, manual, and Gmail data. Without hard environment boundaries, demo operators can reveal real inbox snippets on shared screens. | Add a strong mode banner, separate stores for mock and real data, one-click demo reset, and a "real data hidden" privacy screen for live presentations. | When data-source switching is implemented. |

## Review checklist for completion pass

- Confirm Gmail OAuth scopes are limited to read and label writeback.
- Confirm cloud AI is opt-in for real Gmail content and visibly disclosed.
- Confirm rule-based classification still works when Chrome AI and Gemini are both unavailable.
- Confirm every AI suggestion can be corrected by the user without being overwritten on refresh.
- Confirm inbox screens distinguish candidate labels from confirmed user state.
- Confirm demo mode cannot leak real Gmail data by default.
- Confirm build, lint, and at least one Chrome smoke test pass on a clean machine.

## Evidence captured during this pass

- `npm run lint` passed in `app/`.
- `npx tsc -b --pretty false` passed in `app/`.
- `npm run build` passed in `app/` (Vite production build completed).
