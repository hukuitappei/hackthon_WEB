# Hackathon AI Web App Foundation

Theme-agnostic frontend starter for a Chrome-based AI hackathon.

## What is included

- React + Vite + TypeScript app shell
- Theme workspace section for the final feature
- AI provider abstraction with:
  - Chrome Built-in AI slot
  - Transformers.js slot
  - Gemini API fallback
- Submission metadata panel and checklist

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Environment variables

Copy `.env.example` to `.env` only if you want the Gemini fallback:

```bash
VITE_GEMINI_API_KEY=your_key
VITE_GEMINI_MODEL=gemini-2.5-flash
```

If no API key is configured, the app still works and shows the Gemini provider as not configured.
