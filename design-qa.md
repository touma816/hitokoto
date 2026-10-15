# Design QA — ひとこと

final result: passed

## Target and evidence

- Source visual truth: `qa/source-design.png`, selected purple concept with image attachment refinement approved by the user.
- Implementation: `qa/desktop-owner-final.png`.
- Both desktop artifacts are 1487 × 1058 pixels, CSS viewport 1487 × 1058, deviceScaleFactor 1. No scaling or browser chrome in either artifact.
- State: owner signed in, autumn photo attached, draft 「近所の散歩で、秋を見つけた。」, default two seed posts, picker closed, no toast, no selected reactions.
- Full-view combined comparison: `qa/comparison-final.jpg`, source on the left and implementation on the right.
- Focused combined comparison: `qa/focus-final.jpg`, heading/composer source on left and implementation on right. Reviewed at readable scale to check typography, icons, attachment preview and posting affordance.
- Additional evidence: `qa/desktop-visitor-final.png`, `qa/mobile-owner-final.png`, `qa/mobile-picker-final.png`.
- Browser: installed Chromium using Playwright. An in-app Browser control tool was not exposed in this session, so the available Chromium fallback was used for rendering and interaction testing.

## Findings and comparison history

Initial comparison: `qa/comparison-before-fix.jpg`, implementation capture `qa/desktop-owner-before-fix.png`.

- [P2, resolved] Timeline text was too small and the main content started about 22px too far left relative to the source. Changed desktop post text from 19px to 21px, adjusted line-height, avatar size from 64px to 70px, and post gap from 20px to 32px. Final text/image column starts at x398 vs approximately x402 in the source; its width and visual hierarchy now match.
- [P2, resolved] Second image and reaction row were pushed too low. Reduced the desktop second sample image crop to the source's 120px height and tightened inter-post rhythm. Both posts and reaction controls are now visible in the matched desktop viewport.
- [P2, resolved] Secondary text color had insufficient normal-text contrast. Changed the muted token from #8c7bae to #79658f, approximately 4.79:1 on #f8f5ff. The selected palette remains purple.
- [P2, resolved] Sidebar avatar sat too high, and background art had a visible seam. Increased desktop profile top spacing and matched the solid sidebar ground to the generated illustration's top edge.

Post-fix comparison: `qa/comparison-final.jpg` and `qa/focus-final.jpg`, opened together with the source and inspected after the fixes. No actionable P0/P1/P2 findings remain.

## Required fidelity surfaces

- **Fonts and typography:** locally hosted Noto Sans JP for readable UI and posts, Zen Maru Gothic 900 for the rounded Japanese title/logo. Desktop title 52px, posts 21px, comfortable two-line wrapping. Mobile input 16px avoids automatic iOS focus zoom. No clipped labels or fallback-font errors observed.
- **Spacing and layout:** matched purple sidebar, generous main padding, lavender composer, circular avatars, open timeline with simple separators and pill reactions. Desktop image/text alignment corrected. Tested owner and visitor widths 320, 390, 720, 768, 1024 and 1440; no horizontal overflow. The small mobile header intentionally replaces the desktop sidebar.
- **Colors and tokens:** plum ink, lavender ground/composer, purple primary button and pale reaction chips preserve the source. Muted text is deliberately darker for contrast. Hover, focus, selected and disabled states are distinct.
- **Image quality and asset fidelity:** generated raster avatar, steaming coffee landscape, autumn lake landscape and botanical sidebar art match the subjects and art direction. WebP delivery is sharp at intended sizes; originals are preserved in the generated-images directory. Standard icons come from Phosphor's distributed SVG assets, with no custom-drawn SVG/CSS illustrations. Actual emoji are the reaction content.
- **Copy and content:** Japanese title, subtitle, owner identity, draft, sample post text, image-add action and primary post action follow the chosen visual. Login guidance, character count, deletion and visitor-view controls are functional additions required by the existing owner-only app. No comment/reply/repost controls.

## Interaction validation

- API tests: all 4 pass (`npm test`). Includes unauthorized posting/deletion, persisted image-only posts, invalid image types/content/count, overlong/empty text, per-visitor emoji toggling, and absence of comment endpoints.
- Browser journey: visitor read-only view, like persistence across reload, emoji picker selection, photo lightbox, owner login, text+photo posting and reload persistence, removing attachments, image-only posting, owner deletion, visitor preview, logout and a separate visitor context.
- Keyboard: modal focus, Escape dismissal, reaction buttons, labelled file attachment and removal controls. Visible focus states and reduced-motion preference supported.
- Console errors checked: none. Detailed interaction results: `qa/browser-results.json`.
- Tests use isolated temporary data files; no real user posts are changed by verification.

## Follow-up polish

- [P3] The Phosphor sparkle differs slightly from the two yellow hand-drawn strokes in the mockup. The icon keeps the same accent and does not affect hierarchy.
- [P3] Generated photographs and the rounded display font preserve the visual direction rather than reproducing every pixel of the generated mockup. Minor baseline and crop differences remain.

## Implementation checklist

- [x] Selected design implemented and all generated assets placed.
- [x] Owner-only posting/deletion enforced by the server.
- [x] Images and emoji reactions saved locally.
- [x] Desktop and mobile browser interactions verified.
- [x] All P0/P1/P2 findings corrected and post-fix captures compared.
- [x] Local preview left running on port 4173. No public deployment performed.
