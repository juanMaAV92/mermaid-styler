# Contributing

Mermaid Styler is a focused static tool: paste Mermaid, style it, export it.
Keep source in the browser and avoid adding storage, accounts, or a backend.

## Local setup

Use the version in `.nvmrc`, then run:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run dev
```

Create a `feature/` branch. Keep changes scoped; describe the problem, resulting
behavior and verification in the pull request. For a new feature, open an issue
first to discuss its fit with `PRODUCT.md` and `MVP.md`.

## Before submitting

```sh
npm run typecheck
npm run test
npm run test:e2e:cross-browser
npm run check:bundle
git diff --check
```

Render/export changes should include a minimal regression fixture. Keep copies
in `src/i18n/messages.en.ts`, appearance in existing tokens, and use the existing
controllers. Preserve `renderMermaid(source, options)` as the engine boundary.

For deployment changes, build the Dockerfile and run `check:deployment` against
the container as described in `DEPLOYMENT.md`. Check desktop, a 390px viewport,
keyboard interaction and PNG export when changing UI.

## Reports

Bug reports should include steps, expected/actual behavior, browser/version and
a small Mermaid example **with private content removed**. Use `SECURITY.md` for
security reports. Do not publish sensitive diagrams, tokens, or infrastructure
details in issues or screenshots.

Contributions are provided under the repository's MIT license.
