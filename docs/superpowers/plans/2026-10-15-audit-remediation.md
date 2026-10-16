# Remediación de la auditoría 2026-10-15 — Plan por fases

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los hallazgos AUD-013…AUD-021 (seguridad, límites de render, producción, UX/UI) y dejar la herramienta lista para difusión comunitaria.

**Architecture:** Sitio estático Astro + scripts cliente vanilla. Se conserva la frontera pública `renderMermaid(source, options)`; el sanitizador pasa a devolver un nodo DOM para eliminar la re-interpretación vía `innerHTML`. La lógica geométrica del preview y el formateo de errores se extraen a módulos puros testeables en Vitest; todo lo que depende de layout, canvas o del render real de Mermaid se prueba en Playwright sobre `dist/`.

**Tech Stack:** Astro 7.3.5, TypeScript 7, Mermaid 11.17.0, DOMPurify 3.4.16, Vitest + happy-dom, Playwright, Docker + nginx, GitHub Actions, Dokploy.

**Spec:** Auditoría del 2026-10-15 (hallazgos AUD-013…AUD-021, a volcar en `AUDIT.md` en la Tarea 0.3) + informes de las perspectivas Diseño UX, Dirección visual, Producto y DX (sintetizados en "Decisiones" abajo).

## Global Constraints

- Sin backend, sin persistencia (ni `localStorage` ni `sessionStorage` para el source), sin telemetría ni requests externos.
- `renderMermaid(source, options): Promise<MermaidRenderResult>` mantiene su firma; solo se **añaden** campos al resultado.
- Límite de aristas único: `MAX_EDGES = 500` (igual al `maxEdges` por defecto de Mermaid), exportado desde `src/lib/mermaid/validation.ts`.
- Mermaid se inicializa siempre con la lista `secure` completa y explícita (los arrays de config pueden reemplazarse, no concatenarse): `['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges', 'themeCSS']`. La exporta `src/lib/mermaid/render-mermaid.ts` como `MERMAID_SECURE_KEYS`.
- Ningún `innerHTML =` nuevo en `src/`; los SVG se insertan con `importNode`/`replaceChildren`.
- Todo copy nuevo vive en `src/i18n/messages.en.ts`; ningún texto visible hardcodeado en `.astro`/`.ts`.
- Objetivos táctiles ≥ 44px (`--control-target`); tipografía de UI ≥ 11px.
- Node 22.19.0 (`.nvmrc`); ejecutar los gates con esa versión.
- Mermaid se queda en 11.x hasta cerrar la Fase 6.
- Nombres de test: `AUD-0XX: <comportamiento>` para trazabilidad.

## Decisiones (recomendación por defecto — confirmar antes de la fase indicada)

| # | Decisión | Recomendación | Origen | Fase |
|---|---|---|---|---|
| D1 | ¿`%%{init}%%` puede pisar el style rail? | No por defecto: el rail gana; aviso + toggle "Usar tema del source" (off). `themeCSS` siempre bloqueado. | Producto + UX | 5 |
| D2 | ¿Exportar con source inválido? | Sí, el último preview válido, marcado como tal (`data-stale`) y con su propio source embebido. | Producto + UX | 3 |
| D3 | ¿Restaurar source tras recarga? | No (promesa de privacidad, MS-048). Solo `beforeunload` si el source difiere del ejemplo. | Producto | 3 |
| D4 | ¿Mermaid 12 ahora? | No. ADR + matriz de diagramas en Fase 6. | Producto + DX | 6 |
| D5 | Agrupación de acciones de export | Por formato: split buttons `[⤓ SVG │ ⧉]` `[⤓ PNG │ ⧉]` en desktop; en ≤820px dos botones `SVG ▾` / `PNG ▾` con menú Descargar/Copiar. | Visual (UX proponía por acción; se elige formato por coherencia desktop/móvil) | 4 |
| D6 | Escala de Fit | `clamp(min(vw/w, vh/h) × 0.9, 0.1, 2)`: amplía diagramas pequeños hasta 2× y reduce grandes hasta 10%. | Visual + UX | 4 |
| D7 | Cambiar colores de presets (accent light/architecture/paper) | Sí: accent `#0e7c8c` en light/architecture, `#c2412d` en paper; diferenciar architecture (primary `#ffffff`). Es cambio visible del artefacto exportado. | Visual | 5 |
| D8 | Adoptar Dockerfile en Dokploy | Sí; operación manual del propietario. | Producto + DX | 2 |

## Review Focus

1. **Escribir rápido en un source inválido** → no aparece ningún `[role=alert]` ni error rojo hasta 800ms tras la última tecla; el preview anterior sigue visible. (Tarea 3.2)
2. **Diagrama de 501–1.200 aristas generado por IA** → error `SOURCE_TOO_COMPLEX` inmediato, sin long task > 100ms medida tras resolver el `fill`, con el límite en el mensaje. (Tarea 1.2)
3. **Label HTML con `<img>`/`<hr>`** → nunca "invalid SVG document"; `<img>` se elimina, `<hr>` se conserva. (Tarea 1.3)
4. **Exportar SVG con "Include source" estando en error** → el `<metadata>` contiene el source del último render válido. (Tarea 3.3)
5. **Rueda del ratón sobre el preview sin modificador** → la página hace scroll, el zoom no cambia. (Tarea 4.2)

---

## Fase 0 — Base DX (rama `chore/dx-tooling`, sin cambios de comportamiento)

### Task 0.1: Entorno de test fiable y bucle rápido

**Files:**
- Modify: `vitest.config.ts`, `package.json` (scripts), `playwright.config.ts`, `.github/workflows/ci.yml`
- Create: `tests/unit/environment.test.ts`, `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Write the failing test** — `tests/unit/environment.test.ts`, `it('DX: DOMParser and XMLSerializer exist so sanitizer tests are real')` con `expect(typeof DOMParser).toBe('function')` y `expect(typeof XMLSerializer).toBe('function')`, **sin** pragma de entorno.
- [ ] **Step 2: Run** `npx vitest run tests/unit/environment.test.ts` → FAIL (`undefined`).
- [ ] **Step 3: Implement** `test.environment: 'happy-dom'` en `vitest.config.ts`; añadir script `"test:e2e:only": "playwright test --project=chromium"`; alinear `@types/node` a `^22` con el engine; en `playwright.config.ts` `reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list'`; en `ci.yml` quitar la doble build (orden: build → check:bundle → `npm run test:e2e:only`). PR template con el checklist: ID AUD, fixture que falla antes/pasa después, `typecheck`, `lint`, `test:unit`, `test:e2e`, cross-browser si toca render/export, delta de `check:bundle`, `docker build` + `check:deployment` si toca deploy, sin `innerHTML` nuevo, `messages.en.ts` actualizado, AUDIT.md actualizado.
- [ ] **Step 4: Run** `npm run test:unit` → 23 PASS; `npm run build && npm run test:e2e:only` → PASS.
- [ ] **Step 5: Commit** `chore(dx): fix vitest env, fast e2e script, CI report and PR template`.

### Task 0.2: Lint con prohibición de `innerHTML`

**Files:**
- Create: `eslint.config.js`, `.editorconfig`
- Modify: `package.json` (devDeps `eslint`, `typescript-eslint`; script `"lint": "eslint src tests scripts"`), `.github/workflows/ci.yml` (paso Lint tras Typecheck)

- [ ] **Step 1:** Configurar typescript-eslint recommended + regla `no-restricted-syntax` con selector `AssignmentExpression[left.property.name='innerHTML']`, mensaje `"Insert sanitized nodes with importNode/replaceChildren (AUD-015)."`.
- [ ] **Step 2: Run** `npm run lint` → FAIL exactamente en `src/scripts/app.ts:168`. Añadir `// eslint-disable-next-line no-restricted-syntax -- removed in Task 1.3` en esa línea.
- [ ] **Step 3: Run** `npm run lint` → 0 errores (corregir el resto de avisos mecánicos sin cambiar comportamiento).
- [ ] **Step 4: Commit** `chore(dx): add eslint with innerHTML ban`.

### Task 0.3: Fixtures adversariales y registro en AUDIT.md

**Files:**
- Create: `tests/fixtures/adversarial/index.ts`, `tests/fixtures/adversarial/svg/*.svg`, `tests/fixtures/adversarial/mermaid/*.mmd`, `tests/fixtures/diagrams/html-label-flowchart.mmd`, `tests/unit/sanitize-svg.adversarial.test.ts`
- Modify: `tests/e2e/hardening.spec.ts` (leer el flowchart desde el fixture), `AUDIT.md`

**Interfaces:**
- Produces: `export type AdversarialFixture = { id: string; file: string; audit: 'AUD-003' | 'AUD-013' | 'AUD-015' | 'AUD-016' | 'AUD-017'; mustNotContain: string[]; mustContain: string[]; pending?: boolean }` y `export const adversarialFixtures: AdversarialFixture[]`.

- [ ] **Step 1:** Fixtures SVG: `css-import-string.svg` (`<style>@import "https://evil.example/x.css";</style>`), `css-image-set.svg` (`fill: image-set("https://evil.example/a.png" 1x)`), `css-url-external.svg`, `foreignobject-img-unclosed.svg` (`<p>ok</p><img src="x">` sin cerrar), `void-hr-unclosed.svg`, `use-external-href.svg`, `event-handler-attr.svg`, `animate-set-href.svg` (`<a><set attributeName="href" to="javascript:alert(1)"/></a>`). Fixtures Mermaid: `themecss-image-set.mmd` (el payload probado en la auditoría), `edges-501.mmd`, `init-primary-red.mmd` (`%%{init: {"themeVariables": {"primaryColor": "#ff0000"}}}%%`).
- [ ] **Step 2:** `sanitize-svg.adversarial.test.ts` itera el manifiesto: `it.each` con nombre `'%s: sanitized output excludes payload'`; para `pending: true` usar `it.fails`. Marcar pending los de `@import`, `image-set`, void elements y `animate/set`.
- [ ] **Step 3: Run** `npm run test:unit` → PASS (los pending fallan como se espera).
- [ ] **Step 4:** Volcar AUD-013…AUD-021 en `AUDIT.md` con el formato Estado/Ubicación/Evidencia/Impacto/Acción/Validación y fila de historial `2026-10-15`.
- [ ] **Step 5: Commit** `test(security): add adversarial fixture manifest and record AUD-013..021`.

---

## Fase 1 — Seguridad y límites de render (P1; ramas `fix/aud-013-016-…`, `fix/aud-015-017-sanitizer`)

### Task 1.1: AUD-013 — Bloquear `themeCSS` y ampliar el filtro CSS

**Files:**
- Modify: `src/lib/mermaid/render-mermaid.ts:52-68`, `src/lib/mermaid/sanitize-svg.ts:6-9`
- Test: `tests/unit/sanitize-svg.test.ts`, `tests/e2e/hardening.spec.ts`

**Interfaces:**
- Produces: `hasExternalCssReference(value: string): boolean` (sustituye a `hasExternalCssUrl`; detecta `url(` no-fragmento, `image-set(` con string, `@import`, `src(`).

- [ ] **Step 1: Write the failing tests** — unit `it.each` `AUD-013: detects external CSS references` con `['@import "https://x/y.css";', true]`, `['fill: image-set("https://x/a.png" 1x)', true]`, `['src("https://x/f.woff")', true]`, `['fill: url(#grad)', false]`, `['stroke: none', false]`. E2E `AUD-013: themeCSS directive triggers no external request`: cargar `themecss-image-set.mmd`, registrar `page.on('request')` y `page.on('requestfailed')`, esperar `data-render-state="ready"`, `expect(externalRequests).toEqual([])`. E2E `AUD-013: default secure keys stay protected`: `%%{init: {"maxEdges": 2}}%%` con 3 aristas sigue en `ready`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/sanitize-svg.test.ts` y `npm run build && npx playwright test -g "AUD-013"` → FAIL (el E2E ve `FAILED https://evil.example/a.png csp`).
- [ ] **Step 3: Implement** — `export const MERMAID_SECURE_KEYS` con la lista de Global Constraints y `mermaid.initialize({ ..., secure: [...MERMAID_SECURE_KEYS] })`; renombrar a `hasExternalCssReference` y actualizar el uso en `sanitizeSvg`.
- [ ] **Step 4: Run** ambos → PASS; quitar `pending` de `css-import-string` y `css-image-set` en el manifiesto; `npm run test:unit` → PASS.
- [ ] **Step 5: Commit** `fix(security): block themeCSS directive and detect all external CSS references (AUD-013)`.

### Task 1.2: AUD-016 — Límite de aristas único

**Files:**
- Modify: `src/lib/mermaid/validation.ts:5-8,30-36`, `src/lib/mermaid/render-mermaid.ts`
- Test: `tests/unit/validation.test.ts`, `tests/e2e/hardening.spec.ts`

**Interfaces:**
- Produces: `export const MAX_EDGES = 500` (reemplaza `DEFAULT_MAX_CONNECTIONS`; actualizar sus importadores).

- [ ] **Step 1: Write the failing tests** — `AUD-016: validator edge limit matches Mermaid maxEdges`: `expect(MAX_EDGES).toBe(500)`; `validateSource` con 501 líneas `A --> B` lanza `SOURCE_TOO_COMPLEX` y el mensaje contiene `"500"`; con 500 no lanza. E2E: con `edges-501.mmd`, el feedback contiene `/500/` y `PerformanceObserver('longtask')`, iniciado después de que resuelva el `fill`, no registra tareas > 100ms.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `MAX_EDGES = 500`; ampliar `connectionPattern` con los operadores que hoy no cuenta: `--o`, `--x`, `-.-`, `~~~` (una coincidencia por arista; test por operador); pasar `maxEdges: MAX_EDGES` a `mermaid.initialize`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `fix(render): align edge limit with Mermaid maxEdges (AUD-016)`.

### Task 1.3: AUD-015 + AUD-017 — Sanitizador que devuelve nodo y normaliza elementos vacíos

**Files:**
- Modify: `src/lib/mermaid/sanitize-svg.ts`, `src/lib/mermaid/types.ts:39-43`, `src/lib/mermaid/render-mermaid.ts:80-84`, `src/scripts/app.ts:166-171`
- Test: `tests/unit/sanitize-svg.test.ts`, `tests/unit/sanitize-svg.adversarial.test.ts`, `tests/e2e/hardening.spec.ts`

**Interfaces:**
- Produces: `sanitizeSvgElement(svg: string): SVGSVGElement`; `sanitizeSvg(svg: string): string` pasa a ser `XMLSerializer` sobre el anterior; `normalizeVoidElements(svg: string): string` (sustituye a `normalizeMermaidLineBreaks`; cubre `area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr`); `MermaidRenderResult` gana `element: SVGSVGElement`.

- [ ] **Step 1: Write the failing tests** — `AUD-017: normalizes all void elements` (`'<svg><hr><img src="x"><br/></svg>'` → `'<svg><hr/><img src="x"/><br/></svg>'`); `AUD-017: label with unclosed img sanitizes without error` (no lanza, el resultado no contiene `<img`, sí el texto); `AUD-015: removes animate/set that can rewrite href`; `AUD-015: sanitizeSvgElement returns an SVGSVGElement`. E2E `AUD-017: HTML label with <img> renders` con `A["<b>bold</b> <img src=x>"] --> B` → `data-render-state="ready"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `normalizeVoidElements`; añadir `animate, animateMotion, animateTransform, set` a la denylist; `sanitizeSvgElement` devuelve el `root`; `renderMermaid` devuelve `{ svg, element, diagramType, bindFunctions }`; en `app.ts` `svgHost.replaceChildren(document.importNode(outcome.result.element, true))` y retirar el `eslint-disable`.
- [ ] **Step 4: Run** `npm run test:unit && npm run lint && npm run build && npm run test:e2e:only && npm run test:e2e:cross-browser` → PASS (Firefox sustituye la raíz por `parsererror`: el test de error debe seguir lanzando `SANITIZE_ERROR`). Quitar los `pending` restantes del manifiesto.
- [ ] **Step 5: Commit** `fix(security): return sanitized DOM node and normalize void elements (AUD-015, AUD-017)`.

---

## Fase 2 — Producción (P1; ramas `chore/aud-014-unprivileged`, `chore/ci-supply-chain`)

### Task 2.1: nginx sin root y compresión completa

**Files:** `Dockerfile`, `deploy/nginx.conf`, `.github/workflows/ci.yml`, `DEPLOYMENT.md` (cambio atómico)

- [ ] **Step 1:** `FROM nginxinc/nginx-unprivileged:1.28.0-alpine@sha256:<digest>`; `EXPOSE 8080`; healthcheck a `http://127.0.0.1:8080/healthz`; `listen 8080;`; `gzip_types` añade `text/plain`; CI mapea `-p 127.0.0.1:8080:8080`; DEPLOYMENT.md indica puerto 8080. Fijar también `node:22.19.0-alpine@sha256:<digest>`.
- [ ] **Step 2: Run** `docker build -t ms . && docker run -d -p 127.0.0.1:8080:8080 ms && npm run check:deployment` → "Deployment contract passed"; `docker exec <id> id -u` ≠ 0; `curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8080/third-party-licenses.txt` incluye `content-encoding: gzip`.
- [ ] **Step 3: Commit** `chore(deploy): run nginx unprivileged on 8080 and gzip text`.

### Task 2.2: Cadena de suministro de CI

**Files:** `.github/workflows/ci.yml`, Create `.github/dependabot.yml`, Create `.github/workflows/post-deploy.yml`

- [ ] **Step 1:** Fijar `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` por SHA con comentario `# vX.Y.Z`; añadir `hadolint` al job de deployment.
- [ ] **Step 2:** `dependabot.yml`: ecosistemas `npm`, `github-actions`, `docker`, semanal; `ignore: [{ dependency-name: mermaid, update-types: ['version-update:semver-major'] }]`.
- [ ] **Step 3:** `post-deploy.yml` (`workflow_dispatch` + cron diario): `npm run check:deployment -- https://mermaid-styler.duckdns.org` y el smoke cross-browser contra esa URL vía `PLAYWRIGHT_BASE_URL` (añadir soporte a esa variable en `playwright.config.ts`, sin `webServer` cuando está definida).
- [ ] **Step 4: Run** CI en el PR → verde.
- [ ] **Step 5: Commit** `chore(ci): pin actions by SHA, add dependabot and post-deploy check`.

### Task 2.3: AUD-014 — Adopción en Dokploy (operación manual, D8)

- [ ] **Step 1:** El propietario cambia Build Type a Dockerfile y puerto 8080 en Dokploy según `DEPLOYMENT.md`.
- [ ] **Step 2: Run** `npm run check:deployment -- https://mermaid-styler.duckdns.org` → PASS; `curl -sSI https://mermaid-styler.duckdns.org/nope` → `404` con CSP y `x-frame-options: DENY`.
- [ ] **Step 3:** Marcar AUD-009, AUD-010 y AUD-014 resueltos en `AUDIT.md` con la salida de los comandos.

**Gate de difusión:** Fases 1 y 2 + Task 3.4 (copy) cerradas = se puede promover la demo.

---

## Fase 3 — Errores útiles y estado honesto (UX; rama `fix/aud-018-019-020-feedback`)

### Task 3.1: AUD-018 — Mostrar el error real de Mermaid con "Ir a la línea"

**Files:**
- Create: `src/lib/mermaid/format-error.ts`, `tests/unit/format-error.test.ts`
- Modify: `src/scripts/app.ts:132-140`, `src/scripts/render-state-controller.ts`, `src/components/mermaid/MermaidEditor.astro:41-44`, `src/i18n/messages.en.ts`, `src/styles/global.css` (`.source-feedback` sticky al pie de `.panel--editor`)

**Interfaces:**
- Produces: `formatRenderError(error: unknown, messages: ErrorMessages): { title: string; detail: string; line?: number }`; `RenderStateOptions` gana `line?: number`.

- [ ] **Step 1: Write the failing tests** — unit: `PARSE_ERROR` con `details = 'Parse error on line 2:\n...B[\n------^\nExpecting ...'` → `{ line: 2, title: 'Syntax error on line 2' }` y `detail` con como mucho 3 líneas de `details`; `SOURCE_TOO_COMPLEX` → `detail` contiene `'500'`; error no-Mermaid → `messages.errorFallback`. E2E `AUD-018: parse error shows line and jumps to it`: fill `'flowchart LR\n A --> B['`, esperar 1s, `[data-source-feedback]` contiene `/line 2/i`, click en el botón "Go to line 2", `selectionStart` del textarea ≥ índice del inicio de la línea 2.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — línea con `/line (\d+)/i`; el detalle se muestra en `<pre>` con `textContent`; botón `data-go-to-line` que hace `setSelectionRange` + `focus`; copy nuevo: `syntaxErrorOnLine: 'Syntax error on line {line}'`, `goToLine: 'Go to line {line}'`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ux): surface Mermaid error details with go-to-line (AUD-018)`.

### Task 3.2: Preview estable mientras se escribe y una sola región live

**Files:**
- Modify: `src/scripts/render-state-controller.ts:63-93`, `src/scripts/app.ts:142-178`, `src/components/mermaid/ArtifactStage.astro:34,42,46,50,85,91`, `src/components/mermaid/MermaidEditor.astro:41`, `src/styles/global.css`

**Interfaces:**
- Produces: constantes `RENDER_DEBOUNCE_MS = 300`, `ERROR_REVEAL_MS = 800`, `RENDERING_OVERLAY_DELAY_MS = 400` en `src/lib/ui/render-state.ts`.

- [ ] **Step 1: Write the failing E2E tests** — `UX: typing invalid source shows no alert before 800ms idle` (teclear `A --> B[` con `delay: 50`; durante la escritura `[data-source-feedback]` oculto; a los 900ms visible); `UX: previous diagram stays visible and exports stay enabled while rendering` (cambiar el slider de tamaño: `[data-svg-host] svg` nunca oculto, botones `[data-action]` nunca `disabled`); `A11y: exactly one live region` (`page.getByRole('status')` + `getByRole('alert')` + `[aria-live]` suman 1; `getByRole` cuenta también el `role=status` implícito de `<output>`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `rendering` no oculta la vista `ready` ni desactiva acciones cuando hay artefacto; overlay `.stage-rendering-overlay` (SVG a `opacity: .6` + línea de registro cian) solo tras 400ms; el error se revela tras 800ms de inactividad o en `blur`; antes, indicador neutro "Editing…"; quitar `role=alert`/`aria-live`/`role=status` de ArtifactStage y MermaidEditor, y cambiar `<output>` de `[data-preview-zoom]` y `[data-text-size]` por `<span>`, dejar solo `[data-live-status]`, que anuncia una vez cada mensaje distinto (deduplicar por texto); eliminar `.stage-notice--error`/`--timeout` (el mensaje vive solo en el editor); en el stage, franja superior de 2px `--ember` y sello "LAST VALID" (`--font-code` 11px) con el SVG a `opacity:.55; filter: grayscale(.4)`.
- [ ] **Step 4: Run** `npm run test:e2e:only` → PASS.
- [ ] **Step 5: Commit** `feat(ux): keep preview during render, delay errors, single live region`.

### Task 3.3: AUD-019 — Exportar el source que se renderizó (D2)

**Files:** `src/scripts/app.ts:61-71,173`, `src/scripts/render-state-controller.ts`, `src/styles/global.css`, `src/i18n/messages.en.ts`

- [ ] **Step 1: Write the failing E2E** `AUD-019: include-source export embeds last rendered source`: render válido `A`, luego inválido `B`, activar `#include-source`, interceptar la descarga SVG → `<mermaid-source>` contiene `A` y no `B`; los botones tienen `data-stale="true"` y `title` con "last valid preview".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `let lastRenderedSource = ''` asignado en el éxito; `getExportSvgMarkup` lo usa; `data-stale` en acciones en `error`/`timeout`; copy `exportsLastValid: 'Exports use the last valid preview'`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `fix(export): embed the rendered source, mark stale exports (AUD-019)`.

### Task 3.4: AUD-020 — Limpieza de copy de scaffold

**Files:** `src/i18n/messages.en.ts`, `src/pages/index.astro:41-43,64`, `src/components/mermaid/MermaidEditor.astro:47`, `src/components/mermaid/ArtifactStage.astro:34,57-78`, `src/scripts/render-state-controller.ts`, Test: `tests/e2e/workbench.spec.ts`

- [ ] **Step 1: Write the failing E2E** `AUD-020: no scaffold copy in the shipped page`: `page.getByText(/connects next|Scaffold|Example artifact|next phase|Renderer next/i)` count 0; `page.locator('kbd')` count 0; con diagrama renderizado, el footer no contiene "Paste Mermaid to start styling".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — borrar `renderLater`, `rendererNext`, `scaffoldReady`, `exampleArtifact`, `exampleArtifactHint`, el `<kbd>` y el SVG de ejemplo; estado inicial "Rendering"; el footer muestra `noDiagram` solo en `empty`; el label del preset sale de `messages` (no de `presetId` capitalizado en `theme-controls.ts:51` ni hardcodeado en `StyleRail.astro:58`); `beforeunload` si el source difiere del ejemplo y hubo edición del usuario (D3); añadir en `tests/e2e/` un fixture compartido con `page.on('dialog', d => d.accept())` para que recargas/navegaciones no se cuelguen.
- [ ] **Step 4: Run** `npm run test:e2e:only` → PASS.
- [ ] **Step 5: Commit** `fix(copy): remove scaffold leftovers (AUD-020)`.

---

## Fase 4 — Preview y móvil (UX + visual; rama `feat/aud-021-preview-mobile`)

### Task 4.1: Geometría pura del preview

**Files:** Create `src/lib/ui/preview-geometry.ts`, `tests/unit/preview-geometry.test.ts`

**Interfaces:**
- Produces: `computeFitScale(content: Size, viewport: Size): number` = `clamp(min(vw/w, vh/h) * 0.9, 0.1, 2)`; `computePanLimit(content: Size, viewport: Size, scale: number): { x: number; y: number }` = por eje `max(0, (c*scale - v) / 2) + 48`; `wheelZoomFactor(deltaY: number): number` = `Math.exp(-deltaY * 0.002)`; `zoomAt(point, scale, nextScale, pan): pan` (mantiene fijo el punto bajo el cursor); `type Size = { width: number; height: number }`.

- [ ] **Step 1: Write the failing tests** — fit de 100×50 en 800×600 → 2; de 4000×3000 en 800×600 → 0.18; de 100000×10 → 0.1; pan limit con contenido menor que el viewport → `{x:48,y:48}`; `wheelZoomFactor(100) < 1`, `wheelZoomFactor(-100) > 1`; `zoomAt` mantiene invariante el punto del cursor.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(preview): add pure fit/pan/zoom geometry`.

### Task 4.2: Fit real, rueda, teclado y táctil

**Files:** `src/scripts/preview-controls.ts`, `src/scripts/app.ts` (llamar `fit()` tras el render si cambió el tipo de diagrama o el tamaño en más de un 20%), `src/styles/global.css:469,572-578`

**Interfaces:**
- Consumes: Task 4.1. Produces: `initPreviewControls(...)` devuelve `{ fit(): void }`.

- [ ] **Step 1: Write the failing E2E** — `AUD-021: rendered diagram fits the viewport` (bbox del SVG dentro del viewport ±2px y `max(w/vw, h/vh) ≥ 0.8` en 1440×900; probar un diagrama ancho y uno alto); `AUD-021: wheel without modifier scrolls the page` (`mouse.wheel(0,300)` cambia `scrollY` y `[data-preview-zoom]` no cambia); `AUD-021: ctrl+wheel zooms`; `AUD-021: arrow keys in viewport do not scroll the page`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — quitar `width:min(100%,760px)` y poner `useMaxWidth: false` en **cada** bloque por tipo de la config de Mermaid (`flowchart`, `sequence`, `class`, `state`, `er`, `gantt`, `journey`, `pie`, …) para que 100% = tamaño intrínseco; zoom con rueda solo con `ctrlKey||metaKey` (pinch de trackpad incluido), anclado al cursor; `preventDefault` en flechas/+/-/0 solo dentro del viewport; `touch-action: pan-y` y pan/pinch con dos dedos; límite de pan dinámico; zoom mínimo 0.1; aviso "Large diagram: zoom in or export" si en fit el texto efectivo queda por debajo de 8px.
- [ ] **Step 4: Run** `npm run test:e2e:only && npm run test:e2e:cross-browser` → PASS.
- [ ] **Step 5: Commit** `feat(preview): real fit, modifier wheel zoom, touch and keyboard fixes (AUD-021)`.

### Task 4.3: Acciones de export inequívocas (D5)

**Files:** `src/components/ui/Icon.astro` (iconos `copy-svg`, `copy-png`, `export-svg`, `export-png`; viewBox 24, stroke 1.7, round caps), Create `src/components/ui/ExportGroup.astro`, `src/pages/index.astro:44-49`, `src/styles/global.css` (`@media (max-width:820px) .topbar-actions`), `src/i18n/messages.en.ts`

- [ ] **Step 1: Write the failing E2E** `AUD-021: export actions are unambiguous on mobile`: a 390×844, los nombres accesibles de los botones visibles de `.topbar-actions` son únicos, cada uno con texto visible y ≥ 44×44; el menú "PNG ▾" ofrece "Download" y "Copy" y "Copy" dispara `copy-png`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — desktop: dos split buttons por formato (PNG primario cian), con separador de 1px `--line`; ≤820px: `SVG ▾`/`PNG ▾` con menú nativo `popover` (sin JS de posicionamiento propio); badge de formato `.button__format` (11px, `--font-code`); reusar `data-action` existentes para no tocar `artifact-actions.ts`.
- [ ] **Step 4: Run** → PASS; revisión visual 1440/390/320 sin overflow.
- [ ] **Step 5: Commit** `feat(ui): format-grouped export actions with distinct icons (AUD-021)`.

### Task 4.4: Stage sin marcos anidados y layout móvil

**Files:** `src/styles/global.css` (`.stage-surface`, `.preview-viewport`, `.preview-controls`, `.stage-alternative`, `.preview-pan-hint`, `.preview-zoom`, `.preview-fit`, `.panel--editor`, `.workbench` en ≤820px), `src/components/mermaid/ArtifactStage.astro`

- [ ] **Step 1: Write the failing E2E** — `UI: no UI text below 11px` (computed `font-size` ≥ 11 en todos los nodos de texto visibles de `.panel`); `UI: on mobile the preview is visible while styling` (a 390×844, tras hacer scroll hasta `#primary-color`, el `[data-preview-viewport]` interseca el viewport).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `.stage-surface` sin borde ni fondo, padding `--space-4`; `.preview-viewport { flex: 1; min-height: 0 }` sin borde; controles flotando abajo a la derecha dentro del viewport; `.stage-alternative` como `sr-only`; "Drag to move" solo en `:hover`/`:focus-visible`; editor ≤ 34% del ancho en desktop; en ≤820px preview `position: sticky; top: 0; height: 40vh` sobre el rail.
- [ ] **Step 4: Run** → PASS; capturas a 1440/390/320 adjuntas al PR.
- [ ] **Step 5: Commit** `feat(ui): flatten stage frames and keep preview visible on mobile`.

---

## Fase 5 — Presets y directivas (visual + producto; rama `feat/presets-directives`)

### Task 5.1: Contraste de presets (D7)

**Files:** `src/lib/theme/presets.ts:16-22`, `src/styles/tokens.css` (token `--ember-ink`), `src/styles/global.css` (`.stage-notice`, sello de error), Create `src/lib/theme/contrast.ts`, Test `tests/unit/presets.test.ts`

**Interfaces:** Produces `contrastRatio(a: string, b: string): number` (WCAG 2.x, hex `#rrggbb`).

- [ ] **Step 1: Write the failing test** — `D7: every preset meets contrast floors` iterando `presetIds`: `text/primary ≥ 4.5`, `line/surface ≥ 4.5`, `accent/surface ≥ 3`, `border/primary ≥ 3`; y `light` y `architecture` difieren en `primary`/`surface` (ΔE perceptible: al menos uno de los dos con diferencia ≥ 0x10 en un canal).
- [ ] **Step 2: Run** → FAIL (accent light 1.30, architecture 1.24, paper 2.48; line paper 3.84).
- [ ] **Step 3: Implement** — accent `#0e7c8c` en light y architecture, `#c2412d` en paper; line/border de paper `#8f5a3a`; architecture `primary: '#ffffff'`; `--ember-ink` ≈ `#b33a2a` para texto de error sobre papel.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(theme): meet contrast floors in presets (D7)`.

### Task 5.2: Conflicto con `%%{init}%%` (D1)

**Files:** Create `src/lib/mermaid/directives.ts`, `tests/unit/directives.test.ts`; Modify `src/scripts/app.ts`, `src/components/mermaid/StyleRail.astro`, `src/i18n/messages.en.ts`

**Interfaces:** Produces `hasThemeDirective(source: string): boolean` (detecta `%%{init}%%` y frontmatter YAML `---\nconfig:\n  theme…`). **Primero investigar** si añadir `'theme'` y `'themeVariables'` a `secure` cuando el toggle está apagado bloquea tanto directivas como frontmatter; si es así, usar eso y no implementar `stripThemeDirective`.

- [ ] **Step 1: Write the failing tests** — unit: `hasThemeDirective` detecta `%%{init: {"themeVariables": …}}%%`, `%%{init: {'theme':'dark'}}%%` y frontmatter `config.theme`; E2E: `"flowchart": {"curve": "basis"}` sigue aplicándose con el toggle apagado. E2E `D1: style rail wins over init directive by default`: `init-primary-red.mmd` + Primary `#00ff00` → `fill` del primer nodo `rgb(0, 255, 0)`; activar "Use source theme" → `rgb(255, 0, 0)`; el aviso es visible solo cuando hay directiva.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (el bloqueo afecta solo al render; el textarea no se toca). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(theme): style rail overrides source theme directives with opt-in (D1)`.

---

## Fase 6 — Mantenimiento (rama `docs/adr-mermaid-12`)

### Task 6.1: ADR de Mermaid 12 y matriz de diagramas (D4)

- [ ] **Step 1:** Crear `docs/adr/0001-mermaid-12.md` con: vulnerabilidades KaTeX (2 low), cambios rompientes de 12.x relevantes para `themeVariables`, `secure` y `maxEdges`, y la decisión.
- [ ] **Step 2:** En una rama de prueba, `npm i mermaid@12.2.0` y ejecutar `npm run test && npm run test:e2e:cross-browser && npm run check:bundle`; registrar los resultados en el ADR (matriz flowchart/sequence/class/state/ER × presets, MS-019/043).
- [ ] **Step 3:** Si está en verde, PR de actualización y retirar el `ignore` de Dependabot; si no, documentar los bloqueos.
- [ ] **Step 4: Commit** `docs(adr): decide Mermaid 12 upgrade`.

---

## Cierre de cada fase

1. `npm audit --omit=dev && npm run typecheck && npm run lint && npm run test && npm run test:e2e:cross-browser && npm run check:bundle` en verde con Node 22.19.0.
2. En `AUDIT.md`: estado con fecha y PR en cada hallazgo y una fila nueva en el historial con el número de tests unitarios/E2E.
3. Al cerrar la Fase 5: nueva pasada de auditoría (score de salud) y prueba manual en iOS Safari y Android Chrome (MS-021).
