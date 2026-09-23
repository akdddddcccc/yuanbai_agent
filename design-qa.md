# 元白工作台 Design QA

- Source visual truth: `C:\Users\27851\.codex\generated_images\01a0c8c8-e6b7-7402-8a79-0d1643a6b314\exec-fbf00ce5-838f-4ef5-a5c8-54c9999c84cd.png`
- Desktop implementation screenshot: `D:\codex\yuanbai_agent\qa-desktop.png`
- Mobile implementation board: `D:\codex\yuanbai_agent\qa-mobile-board.png`
- Combined comparison: `D:\codex\yuanbai_agent\design-qa-comparison-normalized.png`
- Desktop viewport: 1280 × 720 CSS px, device scale factor 1.5
- Mobile viewports: three 390 × 844 CSS px same-origin frames for the portal, dialogue, and game
- State: portal idle; dialogue idle; game start and first explored tile

## Normalization

The source is 1584 × 992 px. The in-app browser returned a 1280 × 720 bitmap while drawing the 1280 × 720 CSS viewport into a 853 × 480 CSS-scale region because of its 1.5 density behavior. The implementation region was cropped to 853 × 480 and resized to 1440 × 810 for the combined comparison. The source was scaled to the same 810 px comparison height. Browser chrome was excluded.

## Full-view comparison evidence

The implementation preserves the selected option's primary composition: black command-console field, two large concrete-colored numbered cards, central floating angular building, red accent rules, technical status strip, and narrow project footer. The actual Three.js building replaces the mock's rendered building so the page retains the requested live model, voice animation, and future GLB replacement path.

The mobile board confirms a natural vertical sequence for the portal, a fully visible persistent press-and-hold control on the dialogue page, and reachable game HUD and direction controls after starting the game.

## Focused-region evidence

Separate crops were not needed. The full desktop comparison keeps the card typography, icons, actions, central building, status strip, and footer readable. The mobile board keeps each 390 × 844 frame large enough to inspect the persistent controls and first-screen hierarchy.

## Required fidelity surfaces

- Fonts and typography: heavy Chinese sans headings, compact technical labels, and high-contrast action copy reproduce the source hierarchy. System fallbacks keep Chinese rendering reliable without a font download.
- Spacing and layout rhythm: cards remain balanced around the central model on desktop and become one-column blocks on mobile. Touch targets meet or exceed 44 px.
- Colors and visual tokens: near-black, warm concrete, brick red, and warm window light are centralized in CSS and Three.js palettes.
- Image quality and asset fidelity: the central visual is live WebGL geometry rather than a placeholder. The game texture is stored locally at full resolution. No rasterized UI text is used.
- Copy and content: the page contains only the two requested experiences, with clear Chinese descriptions and consistent Yuanbai naming.

## Interaction and browser checks

- Portal → Explore → return to portal passed.
- Portal → Dialogue → return to portal passed.
- Mobile portal card navigation passed.
- Mobile game start, HUD, and direction controls passed.
- Dialogue long-press control was inspected but not activated, so no microphone or audio was used during QA.
- Browser console errors: none.

## Comparison history

1. Initial implementation used a map icon and lacked the source's technical red grid cue. The exploration icon was changed to a target/maze-like symbol and a low-opacity Three.js grid was added behind the portal model.
2. The game originally depended on a remote texture and `/explore/` did not resolve in Vite development. The texture was localized and the entry now loads `index.html` before cleaning the address to `/explore/`.
3. The frontend exposed an unhelpful JSON parse error when the local API returned an empty response. Local development now proxies to the deployed service, and empty or invalid responses produce a readable HTTP error.

## Findings

No actionable P0, P1, or P2 visual or interaction differences remain.

## Follow-up polish

- P3: the source mock has richer concrete grain and environmental rocks. The implementation keeps flatter card surfaces for text contrast and a smaller payload.
- P3: the current procedural building is more diagrammatic than the concept render; `MODEL_REPLACEMENT.md` documents how to replace it with a future GLB without rewriting interaction logic.

final result: passed
