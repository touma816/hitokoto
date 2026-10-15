# Design QA — ひとこと（ユーザー指定の変更）

final result: passed

## Target and evidence

- Source visual truth: the four annotated 990 × 604 browser screenshots supplied by the user, backed by the previous owner-state capture `qa/desktop-owner-final.png`.
- Rendered implementation: `qa/blue-desktop.png`, 990 × 604 pixels at CSS viewport 990 × 604 and deviceScaleFactor 1.
- Mobile implementation: `qa/blue-mobile.png`, 390 × 844 pixels at CSS viewport 390 × 844 and deviceScaleFactor 1.
- Profile interaction: `qa/blue-profile-dialog.png`, 990 × 604 pixels.
- State: owner signed in, composer visible, two seed posts, profile updated to 「とうまさん / @touma_816」 to prove editing and persistence.
- Full-view combined comparison: `qa/blue-comparison.png`. The previous published owner view was normalized to 990px width and cropped to 990 × 604 on the left; the new implementation appears at native 990 × 604 on the right.
- Focused review used `qa/blue-profile-dialog.png` because the profile form, labels, inputs, focus ring and save action are readable at full size; no additional crop was needed.
- Browser: installed Chromium through Playwright. The active browser did not expose a programmable capture tool, so Chromium was used for rendering and interaction checks.

## Findings and comparison history

The user identified four issues in the published design: the placeholder identity, the 280-character limit, small timeline text and the purple sidebar theme.

- [P1, resolved] Profile identity was fixed to 「はる / @haru」. The initial profile is now 「とうま / @touma816」 and the profile panel opens an owner-only editor. A test update to 「とうまさん / @touma_816」 persisted after reload and updated every post byline.
- [P2, resolved] The composer allowed 280 characters. The UI, counter and server validation now allow 500 characters; the browser reached `500 / 500` and the API rejects 501 characters.
- [P2, resolved] Timeline text was visually light at the 990px desktop viewport. It is now 20px at that width, 21px on large desktop and 16px on mobile, with adjusted line height.
- [P2, resolved] Purple dominated the sidebar and controls. The sidebar, ink, muted text, focus rings, reaction states and controls now use navy and cornflower blue. The botanical raster asset was regenerated in blue while preserving the gold accents and original composition.

Post-fix evidence: `qa/blue-comparison.png`, `qa/blue-profile-dialog.png` and `qa/blue-mobile.png` were opened and inspected after the changes. No actionable P0/P1/P2 findings remain.

## Required fidelity surfaces

- **Fonts and typography:** locally hosted Noto Sans JP remains readable; Zen Maru Gothic preserves the rounded title and logo. Post text has a stronger hierarchy without crowding the byline or reaction row.
- **Spacing and layout:** the established sidebar, composer, timeline and mobile header structure are preserved. Tested widths 320, 390, 720, 990 and 1440 with no horizontal overflow.
- **Colors and visual tokens:** navy `#183b6b`, primary blue `#3f6edb`, blue ink `#10295a` and pale blue surfaces replace the purple palette consistently. Yellow sparkles and berries remain as intentional accents.
- **Image quality and asset fidelity:** the blue botanical background is a generated raster WebP at the original 500 × 1250 delivery size. Avatar and post photos retain sharp crops. Existing Phosphor SVG icons remain intact.
- **Copy and content:** profile defaults, profile-edit labels, 500-character accessibility label and counter all match the requested behavior. Existing no-comment and reaction copy remains unchanged.

## Interaction validation

- API tests: all 5 pass with `npm test`, including profile authorization/persistence and the 500-character boundary.
- Browser checks: default identity, profile editing, reload persistence, updated post bylines, 500-character counter, desktop/mobile computed font sizes, blue theme token and responsive overflow.
- Primary interactions tested: owner login, profile dialog open/save, long-text entry and reload.
- Console errors checked: none. Detailed results are in `qa/blue-browser-results.json`.
- Tests used an isolated temporary data file, so no user posts or profile data were changed.

## Follow-up polish

- [P3] The small profile-edit hint overlaps the botanical region at some desktop heights, but it remains legible and does not obstruct the profile name or controls.

## Implementation checklist

- [x] Editable owner profile with persisted display name and username.
- [x] 500-character composer and server validation.
- [x] Larger post text across responsive sizes.
- [x] Blue theme and matching botanical asset.
- [x] Desktop and mobile browser evidence captured.
- [x] All P0/P1/P2 findings resolved.
