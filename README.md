# Interactive Comments Section

The [Frontend Mentor interactive comments section](https://www.frontendmentor.io/challenges/interactive-comments-section-iG1RugEG9), built with Next.js 16.3.6, React 19.2.8, TypeScript 5.9.3 and Tailwind 4.2.1 on Node 24.

Live: https://interactive-comments-section-fm.royeradames.com/

- FM's four sample comments, words, avatars and icon paths come from the starter files. Rubik uses weights 400, 500 and 700. The desktop column is 730 px wide and centred, with vertical score controls. At 375 px the column has 16 px side margins and horizontal score controls.
- Add comments as juliusomo, reply to another user, edit your own comments and delete them through a native confirmation dialog. Replies to replies append to the same top-level thread, with a bold purple `@replyingTo` tag. Top-level comments sort by score, with insertion order breaking ties; replies keep their chronological order.
- Vote once per comment. Press the same vote again to remove it, or the opposite vote to switch it. Buttons expose `aria-pressed`; live regions announce additions, updates, deletes and vote changes.
- The delete dialog starts with focus on "No, cancel". Cancel and Escape return focus to the Delete button. Confirm removes the comment and moves focus to the main comment textarea when the trigger is gone. Empty submissions show an inline error linked to the textarea and put focus there.
- Fictional demo state stays in localStorage under `fm-interactive-comments-v1`; no network writes or sign-in. Server rendering starts with `app/data.json`, then an effect restores validated storage without an empty loading screen. Invalid JSON, invalid shapes, duplicate IDs and unknown users fall back to the sample data. Unavailable storage keeps the demo working in memory and shows a notice. "Reset the demo" restores the samples and clears drafts, edits and votes.
- Sample timestamps stay exactly as supplied. New comments store timestamps and show relative time, refreshed every 30 seconds and after reload.
- All visible text is at least 16 px, including the "you" tag and footer. Purple 200 and Pink 200 are too light for hover text, so hover uses darker tones and underlines. Delete text, error text and the confirmation button use `hsl(358, 60%, 42%)` instead of Pink 400, so white button labels and pink text meet 4.5:1. Vote icons use Purple 600 instead of Purple 200 to meet 3:1. At the narrowest widths own-comment actions can move onto another row to preserve one-line labels. These choices change a few line breaks from the reference images.
- `og:site_name` and WebSite JSON-LD name the site "Interactive Comments Section". The 1200 x 630 sharing image shows amyrobson's sample comment. The SVG favicon uses FM colours. Metadata references `/icon-96.png` and `/apple-touch-icon.png`; the caller must export those PNGs from `public/icon.svg` before verification. No PNG icons were created in this edit-only task.

## Development

```bash
npm ci
npm run lint && npm run typecheck && npm run build
npm test   # Playwright: comments, replies, modal focus, voting, persistence, identity, widths and contrast
```

The implementation includes these tests. Installs, builds, tests, servers and browser verification are left to the caller; none were run during this edit-only task.
