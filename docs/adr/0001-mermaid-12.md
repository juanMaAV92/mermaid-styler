# ADR 0001 — Actualización a Mermaid 12

- **Estado:** Aceptada (2026-10-16): aplazar la actualización; ver bloqueos.
- **Decisión de origen:** D4 del plan `docs/superpowers/plans/2026-10-15-audit-remediation.md` (Tarea 6.1).
- **Relacionado:** AUD-001 en `AUDIT.md`.

## Contexto

`npm audit --omit=dev` sobre Mermaid 11.17.0 informa 2 vulnerabilidades low:

- `katex` 0.11.0 - 0.18.1: GHSA-238p-pmpm-9mq7 (prototype pollution que puede
  eludir las restricciones de `trust`).
- `mermaid` 10.9.0-rc.1 - 12.1.0, afectado solo por depender de ese KaTeX.

`npm audit` ofrece como arreglo `npm audit fix --force`, que instala
`mermaid@12.2.0` (cambio mayor). La exposición es baja: la app es estática,
Mermaid corre con `securityLevel: 'strict'`, el SVG se sanea con DOMPurify y
`maxTextSize`/`maxEdges` están acotados.

## Opciones

1. **Actualizar ahora a 12.2.0** en un PR aparte.
2. **Aplazar** hasta resolver los bloqueos medidos en el ensayo, manteniendo
   11.17.0 y el riesgo low aceptado en AUD-001.
3. Parchear KaTeX con `overrides` de npm: descartada, KaTeX >= 0.18.2 solo se
   instala con Mermaid 12.2.0 y forzarlo en 11.x no está validado por upstream.

## Evidencia del ensayo

Ensayo en un worktree aislado de `HEAD` (bd5259c), con `npm ci` y
`npm i mermaid@12.2.0`. Node del entorno: v26.0.0 (el repositorio fija 22.19.0;
Mermaid 12 exige Node >= 22.12, compatible). No se tocó el checkout principal.

| Puerta | Resultado en 12.2.0 |
| --- | --- |
| `npm audit --omit=dev` | 0 vulnerabilidades (KaTeX pasa a 0.18.10) |
| `npm run typecheck` | **FALLA**: `render-mermaid.ts(78,7)` TS2322. La guarda de exhaustividad detecta dos bloques nuevos con `useMaxWidth`: `agentflow` y `usecase` |
| `npm run lint` | OK |
| `npm run test:unit` | OK, 182/182 (16 archivos) |
| `npm run build` | OK |
| `npm run check:bundle` | **FALLA**: mayor chunk 1430 KiB (presupuesto 684 KiB); JS total 5008 KiB (presupuesto 3516 KiB). Causa: ELK ahora va incluido en `mermaid` (chunk `elk-*.js`) |
| `npm run test:e2e:only` (Chromium) | 45 OK / 5 fallos por timeout (ver nota) |
| `npm run test:e2e:cross-browser` (Firefox + WebKit) | OK, 8/8 |

**Nota sobre los fallos de Chromium.** Los 5 fallos son tests de
`hardening.spec.ts` (20 renders consecutivos y cuatro D1) que agotan el timeout
esperando `data-render-state="ready"`. La máquina estaba compartida con otra
ejecución de Playwright, por lo que el tiempo no es fiable. Al repetir solo esos
5 tests: en 12.2.0 pasaron 4/5 (falla el de curvas, `:346`); en 11.17.0 (misma
máquina, mismo árbol) fallaron 1/5 en una pasada (el mismo `:346`) y 3/5 en otra
(dos de ellos bloqueados 11 minutos). Es decir, el comportamiento es
inestable en ambas versiones bajo carga; el ensayo no demuestra una regresión
atribuible a 12.2.0, pero tampoco una pasada limpia. Un resultado concluyente
requiere repetirlo en CI o en una máquina sin carga.
El fallo de `hardening.spec.ts:346` (curvas de flowchart) en 12.2.0 puede ser una
regresión real del layout ELK por defecto y no solo carga: volver a verificarlo
una vez fijado `layout: 'dagre'` (paso 3).

### Matriz de diagramas

El E2E `renders the supported diagram-family matrix` (`hardening.spec.ts`) renderiza
los cinco tipos con el preset por defecto y los 45 tests que pasaron incluyen
esa prueba. No existe hoy un test que cruce tipo × preset; los presets se
verifican aparte en `workbench.spec.ts` (selección de los 5 presets, cambio
Light/Dark) y en `cross-browser-smoke.spec.ts` (render + preset en Firefox y
WebKit, que pasaron).

| Tipo | Render (E2E de familia, Chromium) | Preset aplicado (workbench / cross-browser) | Comprobación visual cruzada tipo × 5 presets |
| --- | --- | --- | --- |
| flowchart | OK | OK (smoke + hardening D1) | No automatizada |
| sequence | OK | solo smoke genérico | No automatizada |
| class | OK | solo smoke genérico | No automatizada |
| state | OK | solo smoke genérico | No automatizada |
| ER | OK | solo smoke genérico | No automatizada |

Pendiente (MS-019/043): una matriz visual 5 × 5 requiere capturas; no existe
infraestructura de regresión visual y no se añadió en este ensayo. Es un
criterio de entrada para el PR de actualización.

## Cambios de Mermaid 12.x relevantes

Fuente: CHANGELOG de `packages/mermaid` (12.0.0 a 12.2.0) y tipos del paquete
instalado.

- **Tema por defecto y `look`:** `redux-color` y `neo` pasan a ser el tema y el
  aspecto por defecto en diez tipos de diagrama. En `theme: 'base'` el `neo`
  dibuja bordes con degradado, que se desactiva si se define `nodeBorder`. La
  app usa `base` con `themeVariables`; habría que fijar `look: 'classic'` (o
  `nodeBorder`) y revisar los 5 presets. Nombres de tema desconocidos ahora
  resuelven al tema por defecto.
- **ELK incluido y por defecto** en flowchart, state, class, ER, requirement,
  use case y agentflow (cambio rompiente): el diseño cambia respecto a dagre
  (12.1.0 activa `orientFeedbackEdges`, 12.2.0 usa Brandes-Koepf). Para conservar
  el diseño actual hay que fijar `layout: 'dagre'`. `defaultRenderer` desaparece.
  Es la causa del salto de bundle: fijar `dagre` no elimina el chunk ELK, que se
  importa de forma diferida pero sigue en `dist/`; solo la build `tiny` lo omite.
- **`maxEdges`:** sin cambio de contrato. 12.1.0 mejora el mensaje de error y
  remite a `mermaid.initialize`. `maxEdges` sigue en `MERMAID_SECURE_KEYS`.
- **`secure` / sanitización de directivas:** el CHANGELOG no recoge cambios; el
  ensayo confirma que `MERMAID_SECURE_KEYS` y el opt-in de
  `theme`/`themeVariables` siguen funcionando: los tests unitarios (182) pasan y
  los E2E D1 pasaron en los reintentos de 12.2.0 salvo el de curvas, que también
  falla en 11.17.0.
- **`mermaidAPI.reset`:** sin cambios en la API; la llamada de
  `initializeMermaid` compila y funciona.
- **`useMaxWidth` por diagrama:** 12.x añade `agentflow` y `usecase`; la guarda de
  tipos hizo su trabajo. Hay que añadirlos a `MERMAID_DIAGRAM_CONFIG_KEYS`.
- **KaTeX:** 0.18.10, fuera del rango vulnerable.
- **Plataforma:** exige ES2024, Safari >= 17.4 y Node >= 22.12.
- Nuevos tipos: use case y `agentflow-beta` (el segundo es beta).

## Decisión

**Aplazar** la actualización a Mermaid 12 y mantener 11.17.0, con la
actualización planificada en un PR aparte cuando se cumplan estos bloqueos:

1. Añadir `agentflow` y `usecase` a `MERMAID_DIAGRAM_CONFIG_KEYS` (arreglo
   trivial; typecheck debe quedar en verde).
2. Decidir el presupuesto de bundle: el JS total pasa de ~3.4 MiB a 5.0 MiB y el
   mayor chunk de <684 KiB a 1430 KiB. O bien se acepta y se sube el
   presupuesto con justificación (el chunk ELK se carga en diferido), o se
   evalúa la build `tiny`.
3. Fijar `layout: 'dagre'` y `look: 'classic'` (o aceptar y revisar el nuevo
   aspecto) y aprobar visualmente los 5 presets × 5 tipos de diagrama.
4. Repetir `test:e2e:only` en CI o en máquina sin carga y obtener 0 fallos.

Motivo: el beneficio de seguridad es real pero limitado (2 low, mitigadas),
mientras que el coste en tamaño y el cambio de aspecto afectan a todos los
usuarios y la evidencia E2E de Chromium no es concluyente.

## Consecuencias

- AUD-001 permanece en "2 low bajo seguimiento"; no cambia de estado.
- Dependabot sigue ignorando las subidas mayores de `mermaid`; las menores y
  parches de 11.x se siguen recibiendo. El `ignore` se **mantiene ahora** y se
  **elimina en el PR que actualice a Mermaid 12**, una vez cerrados los bloqueos.
- Se debe volver a ejecutar el ensayo cuando salga una 12.x posterior a 12.2.0
  (mejoras de ELK y bundle) o cuando se publique un KaTeX corregido para 11.x.
