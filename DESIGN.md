# Precompile Studio Design Rules

Precompile Studio should feel like a Ritual-native builder tool, not a generic Web3 dashboard.

## Visual Reference

Primary reference: Ritual Explorer at `https://explorer.ritualfoundation.org/`.

Use the reference for density, hierarchy, dark surface treatment, typography rhythm, and restrained state indicators. Do not copy it literally; adapt it to a precompile composer workflow.

## Product Shape

- The app is a focused workbench for composing and inspecting Ritual precompile calls.
- The primary surface is the composer, supported by readiness, ABI, preview, and trace/guardrail details.
- Avoid dashboard sprawl. Do not add charts, analytics cards, or broad chain-monitoring UI unless they directly help precompile submission.
- Keep the first viewport calm: header, concise hero/search command, compact readiness strip, then the composer.

## Typography

- Use at most two type families:
  - Barlow for UI text.
  - Geist Mono for block numbers, addresses, JSON, encoded calldata, and status values.
- Prefer medium weights over bold weights.
- Avoid oversized headings inside tool surfaces. Large type belongs only to the main page title.
- Keep labels small, uppercase, and low-contrast.

## Color And Surface

- Dark neutral base with subtle purple/green environmental light is acceptable.
- No visible background grid.
- No decorative orbs, blobs, heavy gradients, or busy texture.
- Use one primary accent: Ritual green/emerald.
- Warning and error states should be visible but quiet.
- Panels should have low-opacity borders and restrained shadows.

## Layout

- Do not use a left app rail.
- Do not put cards inside cards.
- Do not add a large decorative hero logo.
- Header should stay compact and explorer-like: brand mark, nav links, block pill, wallet action.
- Readiness tiles should be compact. They are status checks, not marketing metrics.
- Composer should dominate the page width.
- Inspector/guardrails should support the composer, not compete with it.

## Components

- Guardrails are compact status rows, not large red/green alert blocks.
- Use icon + short label for status, then details only when needed.
- Buttons should be familiar controls with clear action labels.
- Tabs should look like tool tabs, not pill cards.
- Inputs should be dense enough for repeated technical work.

## Responsive Rules

- Verify desktop and mobile in browser before committing UI changes.
- No horizontal overflow at common widths: 390, 768, 1440, and 1920.
- On mobile, stack readiness cards and inspector sections cleanly.
- Header actions may wrap, but should not become visually dominant.

## Verification Loop

For every meaningful design pass:

1. Run `npm run build`.
2. Start the local app.
3. Check desktop and mobile in a browser.
4. Compare against the Ritual Explorer reference for density, spacing, and visual noise.
5. Fix overlaps, truncation, and excessive contrast before committing.

## Things To Avoid

- Generic AI-style "premium SaaS" gradients.
- Warm beige, purple-blue-only, or one-note palettes.
- Big floating cards everywhere.
- Explaining the UI inside the UI.
- Hero graphics that do not directly help the task.
- Dashboard sections that do not serve the precompile workflow.
