# OmniPost AI

Chrome extension for multi-platform auto-posting. AI-powered (ChatGPT / Gemini) content generation with one-click publish to Facebook, Threads, and X (Twitter).

## Features

- **AI Content Generation** -- pick ChatGPT or Gemini, describe your topic, AI writes the post
- **Multi-Platform** -- post to Facebook, Threads, and X (Twitter) from a single popup
- **Thread Scheduling** -- set date and time for Threads posts (uses chrome.alarms)
- **Multi-Paragraph Threads** -- configure 1-5 paragraphs for Threads
- **No API Keys Required** -- works with your existing browser login sessions

## Project Structure

```
docs/          Documentation website (Vite + Tailwind CSS v4)
extension/     Chrome extension (MV3 + Vite + CRXJS + TypeScript + Tailwind v3)
```

### Extension

```
extension/
  manifest.json           Chrome extension manifest (MV3)
  vite.config.ts          Vite build config with CRXJS
  src/
    background/           Service worker (background.ts)
    content_scripts/      Content scripts for AI and social platforms
      platforms/          Per-platform posting logic (facebook.ts, threads.ts, x.ts)
    popup/                Extension popup UI (index.html, popup.ts, style.css)
    utils/                Shared types, selectors, Supabase client
```

### Docs

```
docs/
  index.html              Documentation page
  style.css               Tailwind v4 theme (Dala design system)
  vite.config.js          Vite config with Tailwind v4 plugin
```

## Development

### Extension

```bash
cd extension
npm install
npm run dev       # watch mode with hot reload
npm run build     # production build -> dist/
```

### Docs

```bash
cd docs
npm install
npm run dev       # dev server at localhost:5173
npm run build     # production build -> dist/
```

## Build Output

Extension build produces a `dist/` folder ready for Chrome loading:
1. Open Chrome -> chrome://extensions
2. Enable Developer mode
3. Load unpacked -> select `extension/dist/`

## Platform Support

| Platform  | Post Type        | Schedule | Paragraph Count |
|-----------|------------------|----------|-----------------|
| Threads   | Multi-paragraph  | Yes      | 1-5             |
| Facebook  | Single post      | No       | N/A             |
| X (Twitter) | Single tweet   | No       | N/A (280 chars) |

## Links

- [Documentation](https://omnipost.codeworks.web.id/)
- [GitHub](https://github.com/wanglinsaputra/OmniPost-AI)

## Licensi

[MIT](LICENSE)