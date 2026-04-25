# Agent Collaboration Plan

## Goal
- Build `ZEN Inbox` as a Chrome-first web app with a dashboard-first inbox triage experience.
- Keep the app functional without AI and resilient when external integrations fail.

## Shared Constraints
- Google Chrome is the primary runtime target.
- The main UI is a dashboard, not a chat-first product.
- AI is assistive and must fall back to rule-based processing.
- Gmail write-back is limited to labeling.
- Slack and LINE are future sources only for v1.

## Ownership Split
### Codex
- Own architecture and integration boundaries.
- Own data model and normalization flow.
- Own fallback-safe inbox pipeline design.
- Own implementation of shared types, selectors, and orchestration.
- Own repository hygiene, commit flow, and release readiness.

### Claude Code
- Own dashboard presentation details and interaction polish.
- Own inbox card UX, filters, empty states, and source status surfaces.
- Own copy refinement for calm, low-noise `ZEN` presentation.
- Own demo flow tuning so the product story is clear in judging.

## File Ownership
### Codex-owned
- `app/src/features/inbox/**`
- `app/src/features/gmail/**`
- `app/src/features/ai/**`
- `app/src/hooks/**`
- `app/src/lib/**` except visual-only utilities
- `plan3_requirements.md`

### Claude Code-owned
- `app/src/components/**`
- `app/src/styles/**`
- `app/src/App.tsx`
- `app/src/App.css`
- `app/src/index.css`

## Coordination Rules
- Avoid overlapping edits unless explicitly synchronized.
- Do not revert another agent's changes without confirmation.
- Integrate through stable interfaces in `types.ts` first.
- If Gmail integration blocks progress, continue with mock data and keep the UI demoable.
- If on-device AI is unavailable, keep the rule-based pipeline and demo states intact.

## Implementation Order
1. Codex defines the core domain types and inbox pipeline contracts.
2. Claude Code builds the dashboard UI against mock data and stable interfaces.
3. Codex wires rule-based classification, AI orchestration, and source adapters.
4. Claude Code refines the presentation, explanation surfaces, and judge-facing flow.
5. Codex finalizes integration, verifies fallback paths, and prepares commit/push.

## Definition of Done for v1
- Inbox items render in `urgent / soon / someday` views.
- Each item shows source, summary, timestamp, kind, priority, and next action.
- The app works with mock data even if Gmail is unavailable.
- AI enhancement is visible but non-blocking.
- Failure states are understandable and do not break the UI.
