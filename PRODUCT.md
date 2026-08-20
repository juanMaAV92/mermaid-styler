# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro with TypeScript, vanilla client-side scripts, the official Mermaid library running in the browser, and static output. No React, Vue, or Svelte in the first version. No backend for the web interface.

## Users

Primary users are developers and technical practitioners who receive or generate Mermaid code with AI and need to turn it into a presentable visual for Jira, technical documentation, presentations, pull requests, or team communication.

The user is assumed to value speed, privacy, predictable exports, and a tool that does one job well instead of a full diagram editor.

## Product Purpose

Mermaid Styler receives Mermaid source code and turns it into a visually presentable diagram that can be previewed, styled, copied, or downloaded.

Success means that a user can paste valid Mermaid, see a useful preview immediately, apply a visual preset or targeted styling, and obtain an SVG or PNG without signing in or sending the source to a remote service.

## Positioning

Mermaid Styler is a presentation layer for Mermaid code, not another full diagram editor. Its distinctive mechanism is a local, browser-based path from AI-generated Mermaid syntax to a polished, shareable artifact.

## Operating Context

The tool is used as a short, task-oriented utility while preparing technical work. Typical destinations include Jira tickets, engineering documentation, README files, presentations, pull requests, and internal team communication.

The expected workflow is: paste Mermaid, preview, choose a preset or adjust styles, then copy or export the result.

## Capabilities and Constraints

- Accept Mermaid source in a text editor.
- Render the diagram live in the browser using Mermaid.
- Provide a visual preview.
- Support background, box, border, text, connector, emphasis, font, font-size, and transparency controls where Mermaid supports them.
- Include Light, Dark, Terminal, Paper, and Architecture presets.
- Download SVG and PNG.
- Copy SVG text and copy the rendered image where browser support permits.
- Show clear, actionable errors for invalid Mermaid.
- Work on desktop and mobile.
- Keep rendering client-side; Mermaid source must not be sent to an external service.
- Do not include login, database, history, project storage, or persistence. Reloading clears the content.
- Expose a reusable `renderMermaid(source, options)` boundary so rendering is independent from the visual interface.
- Use Mermaid theme variables as the primary styling mechanism.
- Convert SVG to PNG through canvas in the browser.
- Apply input limits, a bounded render operation, and SVG sanitization as part of the safety boundary.
- Keep UI tokens in one authoritative source and build the interface from reusable components instead of scattered markup, styles, and magic values.
- Keep system UI copy in message catalogs so a future translation does not require editing component logic. Mermaid source and diagram labels remain user content and are never translated automatically.
- Prefer locally served, limited font assets with system fallbacks; do not make a remote font request required for correct layout.
- Treat browser resources as bounded: allow at most one active Mermaid render and one latest pending render, clean temporary DOM, canvas, and object URLs, and avoid retaining old SVGs.
- Treat Mermaid's diagram-type differences as a product limitation: styling is best-effort and must be documented per supported diagram family.
- Preserve export fidelity deliberately: decide whether to use system-safe fonts or embed a limited font subset, and test the result outside the application.
- Provide fallbacks for clipboard APIs, unsupported browsers, and SVG features that cannot be preserved safely.
- Expose an accessible description or source fallback for exported diagrams; visual SVG alone is not sufficient for every assistive technology.
- Verify Mermaid, font, and dependency licenses before public release.
- Use Dokploy as the initial deployment target for the static site.
- Remain deployable as a static site.

### Deferred or open product decisions

- A stateless `POST /render` endpoint is deferred. It would require a separate server-capable deployment and is not part of the static V1.
- The initial deployment target is Dokploy. The deployment shape (static server image or platform build) will be finalized with the implementation.
- Exact Mermaid syntax coverage, browser support baseline, and input-size limit will be finalized during implementation and testing.

## Brand Commitments

- Product name: Mermaid Styler.
- The tool should feel professional, fast, clear, and focused for developers.
- It should avoid generic dashboard aesthetics and unnecessary functionality.
- Privacy is part of the product promise: source stays in the browser in the static V1.

## Evidence on Hand

The current product record is based on the user's written brief. No user research, usage analytics, customer quotes, benchmark data, or external brand assets have been provided. Future work must not invent these as proof.

## Product Principles

1. Make the path from source to shareable artifact immediate.
2. Keep private technical content in the browser by default.
3. Favor presentation quality over diagram-authoring breadth.
4. Make errors and export limitations understandable.
5. Keep the architecture small, reusable, and static-friendly.

## Accessibility & Inclusion

The interface must support keyboard navigation, visible focus states, readable contrast, clear labels, responsive layouts, and reduced-motion preferences. Controls and error messages must describe what the user can do in plain language.

Mobile support is required, but the core task must remain usable without relying on hover, drag interactions, or fine pointer precision.

## Assumptions

The audience, workflow, and positioning above are inferred directly from the product brief and should be validated after the first public prototype.
