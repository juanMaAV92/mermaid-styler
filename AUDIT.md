# Mermaid Styler — Auditoría técnica

**Fecha:** 2026-10-08
**Estado:** Hitos 1 y 2 integrados en `main` (PR #3–#5). Hito 3 implementado en
`feature/phase-three-operations`; falta integración y adopción/verificación del
Dockerfile en el servicio Dokploy existente.
**Alcance:** escalabilidad, mantenibilidad, deuda técnica, seguridad preventiva,
calidad de UI y operación del sitio estático.

## Cómo retomar esta auditoría

Este documento es el punto de partida para sesiones futuras. Antes de marcar un
hallazgo como resuelto:

1. enlazar el PR o commit que lo aborda;
2. ejecutar los comandos de validación indicados;
3. actualizar su estado en la tabla de seguimiento;
4. repetir la auditoría cuando se cierren todos los elementos P1.

No convertir la ausencia de un hallazgo en una garantía: Mermaid, navegadores,
dependencias y Dokploy cambian con el tiempo.

## Snapshot auditado

| Área | Evidencia |
| --- | --- |
| Repositorio remoto | `origin/main` en `783aaae` (merge PR #5) |
| Copia de trabajo auditada | `feature/phase-three-operations`; operación, accesibilidad y documentación |
| Stack | Astro 7.3.5, TypeScript, Mermaid 11.17.0, scripts cliente vanilla, salida estática |
| Hosting | Dokploy/Railpack actual; Dockerfile y Nginx versionados para la siguiente publicación |
| Persistencia y backend | No hay base de datos, login, endpoint ni almacenamiento de diagramas |
| Dependencias instaladas | 459 totales en desarrollo; no se incluyen en el artefacto estático publicado |

## Resumen ejecutivo

Mermaid Styler tiene una arquitectura de infraestructura apropiada para el
producto: al ser un sitio estático y renderizar en el navegador, escala bien en
tráfico y no crea una carga de cómputo, almacenamiento o privacidad en el
servidor.

El límite de escala real está en el cliente. Mermaid puede consumir CPU en el
hilo principal; el export PNG puede consumir memoria; y la frontera de
sanitización SVG requiere un hardening adicional antes de promover la
herramienta de forma amplia para uso comunitario.

### Score de salud

| Dimensión | Nota / 4 | Hallazgo clave |
| --- | ---: | --- |
| Accesibilidad | 3 | Nombre estable y acciones 44px; lector de pantalla físico aún pendiente |
| Rendimiento | 3 | PNG tiene presupuesto adaptativo y budget de bundle; Mermaid aún puede bloquear el hilo |
| Responsive | 3 | Sin overflow a 320/390px; dispositivos físicos en seguimiento |
| Theming | 4 | Preset, swatches, controles y variables derivan de un solo modelo tipado |
| Integridad de implementación | 4 | Tema, estado y acciones están aislados; quedan límites inherentes de Mermaid |
| **Total** | **17 / 20** | **Bueno; atender los P1 residuales antes de ampliar distribución comunitaria** |

### Lectura por eje técnico

| Eje | Estado | Motivo |
| --- | --- | --- |
| Escalabilidad de tráfico | Fuerte | Hosting estático, sin backend, BD ni procesamiento remoto |
| Escalabilidad de render en navegador | Media | Render Mermaid, parseo y export PNG compiten por CPU/RAM del dispositivo |
| Mantenibilidad | Alta | Tipos, módulos y tests presentes; tema y estado ya no acoplan el orquestador |
| Operación y release | Media-alta | Docker/CI/headers validados localmente; adopción en Dokploy pendiente |
| Privacidad | Buena | No se hacen requests externos y el source no se incrusta en SVG salvo elección explícita |

## Evidencia verificada

### Gates locales

Los siguientes comandos pasaron el 2026-10-08 sobre el build estático generado:

```bash
npm run typecheck
npm run build
npm run test
npm run test:e2e:cross-browser
npm run check:bundle
```

Resultados:

- TypeScript sin errores.
- Build estático correcto.
- 22 pruebas unitarias y 15 pruebas E2E en Chromium correctas.
- Un smoke de render, preset, PNG y recuperación ante source inválido pasó en
  Firefox y WebKit.
- La prueba E2E cubre flowchart, sequence, class, state y ER; Unicode,
  etiquetas largas, transparencia, exportación y veinte renders consecutivos.
- La suite E2E sirve `dist/` en el puerto aislado 4322; no reutiliza el servidor
  de desarrollo del usuario ni valida accidentalmente código sin construir.
- Docker build con Node 22.19.0 pasó. El contenedor Nginx pasó contrato HTTP y
  suite Chromium completa; health check healthy. Revisión visual desktop,
  390px y 320px: sin desbordamiento, acciones principales de al menos 44px.

### Bundle y red

- Budget automatizado: entrypoint **20 KiB** (máximo 35 KiB), chunk mayor
  **647 KiB** (máximo 700 KiB) y JavaScript total **3314 KiB** (máximo 3600 KiB).
- El build sigue emitiendo aviso de Vite por un chunk Mermaid superior a 500 kB.
  No se silencia: el umbral de CI, algo mayor, documenta y controla el coste
  actual mientras una división adicional no sea segura para Mermaid.
- Medición puntual en Chromium contra producción, con el diagrama de ejemplo:
  **29 recursos**, todos del mismo origen, y aproximadamente **238 kB**
  transferidos.
- No se observaron requests a fuentes, analytics, APIs o servicios externos.
- Medición puntual hasta estado `ready`: aproximadamente **3.25 s**. No es un
  benchmark de dispositivos móviles ni una SLO.

### Headers de producción observados

La respuesta incluye `X-Content-Type-Options: nosniff`. No se observaron una
Content Security Policy ni una política explícita de cache para HTML en la
respuesta inspeccionada. Debe verificarse otra vez cuando se modifique Dokploy o
Traefik.

### Detector de coherencia de UI

El detector mecánico de Impeccable no devolvió hallazgos. Esto confirma que no
detectó drift visual mecánico; no sustituye las pruebas de accesibilidad,
seguridad ni rendimiento.

## Hallazgos priorizados

### P0 — bloqueantes

No se identificaron bloqueantes actuales.

### P1 — resolver antes de promover distribución amplia

#### AUD-001 — Dependencias con vulnerabilidades conocidas

- **Estado:** high corregidos el 2026-10-08; 2 low bajo seguimiento.
- **Ubicación:** `package.json`, `package-lock.json`.
- **Evidencia:** `npm audit fix` compatible corrige los hallazgos high de
  http-cache-semantics, sharp y source-map-js. Quedan 2 low: KaTeX y su efecto
  sobre Mermaid. La solución automática ofrecida degrada Mermaid a 10.8.0.
- **Impacto:** la aplicación final es estática y no expone el runtime de Astro,
  por lo que la exposición productiva es menor; aun así, el entorno de CI/build
  usa la cadena vulnerable.
- **Decisión:** no aplicar `npm audit fix --force`. KaTeX sí forma parte del
  cliente; la sanitización y Mermaid strict son mitigaciones, no una corrección
  del paquete. Revalidar ante actualizaciones de Mermaid. Node 22.19.0 se usa
  en Docker/CI/.nvmrc por el mínimo requerido por Undici.
- **Validación:** `npm audit --omit=dev`, `npm run typecheck`, `npm run test`,
  `npm run build`.

#### AUD-002 — El watchdog no puede cancelar un render que bloquee el hilo

- **Estado:** mitigado parcialmente el 2026-09-23.
- **Ubicación:** `src/lib/mermaid/render-mermaid.ts`, `src/lib/mermaid/validation.ts`.
- **Evidencia:** `Promise.race()` limita promesas, pero no puede preemptar
  parseo, layout o render síncrono de Mermaid. El source ahora se limita a
  50.000 caracteres, 2.000 líneas y 1.200 conexiones estimadas. Sigue sin
  existir cancelación de trabajo síncrono ya iniciado.
- **Impacto:** un diagrama generado por IA, válido pero costoso, puede congelar
  temporalmente la pestaña; el mensaje de timeout podría no aparecer a tiempo.
- **Acción:** definir un presupuesto de complejidad y una estrategia de
  degradación. Medir inputs grandes y decidir entre límite más bajo, render bajo
  demanda para fuentes pesadas o aislamiento compatible con Mermaid.
- **Validación:** pruebas con grafos grandes y medición de Long Tasks,
  responsiveness y recuperación de la UI.

#### AUD-003 — Frontera de sanitización SVG incompleta para evolución futura

- **Estado:** mitigado parcialmente el 2026-09-23.
- **Ubicación:** `src/lib/mermaid/sanitize-svg.ts`, `src/scripts/app.ts`.
- **Evidencia:** las etiquetas HTML de `foreignObject` pasan por DOMPurify; el
  sanitizador elimina elementos activos, imágenes, usos/referencias y atributos
  de eventos o enlaces. La página incorpora una CSP por meta y una prueba E2E
  bloquea una referencia `url(https://…)`. Aún falta una CSP como header del
  servidor y fixtures adversariales más amplios.
- **Impacto:** no se probó un bypass durante la auditoría y `securityLevel:
  'strict'` reduce el riesgo, pero una ampliación del output de Mermaid o un
  vector SVG no previsto tendría una barrera insuficiente.
- **Acción:** definir una política explícita de elementos/atributos permitidos
  compatible con `foreignObject`, añadir fixtures adversariales y configurar una
  CSP de defensa en profundidad en el servidor estático.
- **Validación:** pruebas de `script`, eventos, enlaces, URLs, CSS/`url()`,
  namespaces, `foreignObject`, IDs y SVG malformado.

#### AUD-004 — El source completo se filtra intencionalmente en el SVG exportado

- **Estado:** resuelto el 2026-09-23.
- **Ubicación:** `src/lib/export/svg.ts`, `src/scripts/app.ts`.
- **Evidencia:** el baseline incluía el Mermaid original en cada SVG. Ahora la
  metadata se omite por defecto y el usuario debe activar “Include Mermaid
  source in SVG” para incorporarla.
- **Impacto:** al compartir un SVG se pueden revelar comentarios, URLs internas,
  identificadores o detalles que no se perciben en el diagrama. Choca con la
  expectativa de privacidad del producto si no se explica.
- **Acción:** convertirlo en una elección visible, por ejemplo “Incluir source
  Mermaid como alternativa accesible”, y comunicar su efecto antes de exportar.
- **Validación:** exportar ambas variantes, inspeccionar el archivo y confirmar
  que copy/download mantienen el comportamiento elegido.

### P2 — planificar en la siguiente iteración

#### AUD-005 — PNG de alta resolución tiene coste de memoria y fidelidad parcial

- **Estado:** cerrado para el alcance del MVP el 2026-10-02; seguir monitorizando
  fidelidad en dispositivos físicos.
- **Ubicación:** `src/lib/export/png.ts`.
- **Evidencia:** la exportación usa un presupuesto de 4 MP en dispositivos de
  hasta 2 GB, 8 MP cuando no hay señal fiable o hasta 4 GB, y 16 MP por encima.
  La escala se limita correctamente contra el área base del SVG, libera URL,
  `Image` y canvas temporal tras codificar, y avisa mediante región viva cuando
  debe bajar resolución. Para evitar incompatibilidades canvas, `foreignObject`
  se aplana a texto.
- **Evidencia adicional:** E2E valida PNG en viewport móvil de 390 × 844 y otro
  caso con Unicode, etiquetas largas y fondo transparente. El smoke en Firefox
  y WebKit valida un PNG con cabecera correcta. Veinte renders consecutivos
  finalizan en menos de 20 segundos y no dejan canvas, SVG o nodos Mermaid
  temporales.
- **Impacto residual:** los `foreignObject` se aplanan a texto al rasterizar,
  así que labels HTML complejos pueden perder formato. La automatización no
  reemplaza la inspección visual en Safari y móviles físicos.
- **Seguimiento:** si se reciben reportes de fidelidad, registrar navegador,
  diagrama, memoria del dispositivo y tamaño del SVG antes de cambiar el
  presupuesto.

#### AUD-006 — Orquestador cliente con demasiadas responsabilidades

- **Estado:** resuelto el 2026-10-02.
- **Ubicación:** `src/scripts/app.ts` (207 líneas),
  `src/scripts/theme-controls.ts`, `src/scripts/render-state-controller.ts`,
  `src/scripts/preview-controls.ts`, `src/scripts/artifact-actions.ts`.
- **Evidencia:** el orquestador conserva solo selección de DOM, coordinación
  latest-wins y cableado. Tema/presets, estado accesible de render, preview y
  acciones de artefactos son controladores especializados. La frontera pública
  `renderMermaid(source, options)` no cambió.
- **Validación:** typecheck, 22 unitarias, 15 E2E Chromium y smoke Firefox/WebKit
  pasaron sobre `dist/`.

#### AUD-007 — Fuente de verdad de temas duplicada

- **Estado:** resuelto el 2026-09-24.
- **Ubicación:** `src/lib/theme/presets.ts`.
- **Evidencia:** `PresetId`, `DEFAULT_PRESET_ID`, `defaultPreset` y
  `toThemeVariables()` son la fuente única. El shell recibe las variables
  iniciales desde Astro; la lista de presets, swatches, inputs y render cliente
  las derivan del mismo modelo. Se eliminó `src/styles/themes.css` y los colores
  de diagrama duplicados de los tokens CSS.
- **Impacto:** añadir o modificar un preset ya no requiere sincronizar valores
  entre CSS, Astro y JavaScript.
- **Validación:** prueba unitaria de mapeo a variables CSS, `typecheck`, 16
  pruebas unitarias, 15 E2E y build estático correctos.

#### AUD-008 — Cobertura automática limitada a Chromium y sin presupuesto real

- **Estado:** resuelto para el alcance de CI el 2026-10-02.
- **Ubicación:** `.github/workflows/ci.yml`, `playwright.config.ts`,
  `tests/e2e/hardening.spec.ts`.
- **Evidencia:** CI ejecuta Chromium completo y smoke de Firefox/WebKit. Añade
  budget de bundle (`check:bundle`), una suite directa de sanitización SVG en
  DOM, exportación PNG móvil/Unicode/transparencia y 20 renders bajo 20 s. La
  prueba se sirve desde `dist/` para cubrir el artefacto desplegable.
- **Límite explícito:** no hay medición portable de heap ni Long Tasks entre
  navegadores; se considera observabilidad futura, no bloqueo del MVP.

#### AUD-009 — Despliegue no totalmente reproducible desde Git

- **Estado:** implementación versionada completa; adopción en Dokploy pendiente.
- **Ubicación:** `package.json`, `README.md`, configuración de Dokploy.
- **Evidencia:** Dockerfile multistage con Node 22.19.0 y Nginx 1.28.0,
  `npm ci`, health check `/healthz`, `.dockerignore` y `DEPLOYMENT.md`.
  La imagen final publica solo archivos estáticos. CI construye y comprueba el
  contenedor. Los tags de imagen son explícitos, sin pin por digest.
- **Impacto:** builds futuros pueden depender de defaults cambiantes de Dokploy.
- **Acción:** fijar una versión compatible en el repositorio y documentar o
  versionar las variables, publish directory, puerto, headers y health check.

#### AUD-010 — Headers y cache sin contrato explícito

- **Estado:** contrato validado en contenedor local; producción pendiente.
- **Ubicación:** `deploy/nginx.conf`, `scripts/check-deployment.mjs`.
- **Evidencia:** CSP HTTP, nosniff, DENY y no-referrer se aplican incluso a 404.
  HTML revalidable y assets Astro immutable. El contrato se comprueba en CI
  y la suite Chromium se ejecutó bajo la CSP real del contenedor.
- **Impacto:** menor defensa ante un fallo de sanitización y diagnósticos más
  confusos después de deploys por clientes con assets en cache.
- **Acción:** configurar HTML revalidable, assets con hash cacheables y CSP
  compatible con Mermaid/SVG; documentar la configuración.

### P3 — mejoras de calidad y documentación

#### AUD-011 — Labels y targets táctiles por reforzar

- **Estado:** resuelto en código el 2026-10-08.
- **Ubicación:** `src/components/mermaid/MermaidEditor.astro`,
  `src/styles/global.css`.
- **Evidencia:** textarea asociado al título Source por `aria-labelledby`.
  El token `--control-target: 44px` aplica a exportación y zoom; presets/reset
  móviles usan el mismo mínimo. Barra móvil permite envolver acciones.
- **Acción:** asociar label visible o `aria-label` estable y elevar controles
  frecuentes a 44 px cuando el espacio lo permita.

#### AUD-012 — Documentación y licencia de proyecto por cerrar

- **Estado:** resuelto en código el 2026-10-08.
- **Ubicación:** `PLAN.md`, `BACKLOG.md`, raíz del repositorio.
- **Evidencia:** licencia MIT propia, CONTRIBUTING, SECURITY, DEPLOYMENT,
  README/PLAN/BACKLOG actualizados. Cada build publica textos de licencia de
  dependencias instaladas en `/third-party-licenses.txt`. No se empaquetan fuentes.
- **Acción:** actualizar los estados con evidencia/fecha y añadir una licencia
  para Mermaid Styler antes de solicitar contribuciones externas.

## Aspectos positivos a preservar

- El motor de render se mantiene separado de la interfaz mediante
  `renderMermaid(source, options)`.
- El coordinador latest-wins evita que renders obsoletos sustituyan el preview
  actual y conserva como máximo una solicitud pendiente.
- Los contenedores temporales de Mermaid se eliminan y el preview mantiene un
  solo SVG visible.
- SVG, PNG y clipboard tienen errores controlados y fallback para PNG.
- La interfaz tiene componentes específicos, tokens, catálogo de mensajes,
  foco visible, navegación por teclado y `prefers-reduced-motion`.
- No hay almacenamiento local, telemetría, analytics ni red de render externa.
- La prueba regresiva para `<br/>`, subgraphs, Unicode y clases Mermaid evita
  repetir el incidente de sanitización XML.

## Plan de remediación sugerido

### Hito 1 — Hardening previo a difusión

1. Resolver AUD-001 y verificar el audit limpio o riesgos aceptados.
2. Resolver AUD-003 con política SVG, CSP y fixtures adversariales.
3. Resolver AUD-004 con decisión explícita para metadata de source.
4. Resolver AUD-002 definiendo presupuesto de complejidad y comportamiento ante
   render pesado.

### Hito 2 — Rendimiento y mantenibilidad

**Cerrado el 2026-10-02.**

1. AUD-005: PNG cubierto en móvil, Unicode, labels largos, transparencia y
   navegadores automatizados; queda seguimiento visual físico no bloqueante.
2. AUD-006: tema y estado de render extraídos sin modificar
   `renderMermaid()`.
3. AUD-008: budget de bundle, sanitización directa y smoke Firefox/WebKit
   incorporados al CI.

### Hito 3 — Operación abierta a comunidad

**Implementación completa el 2026-10-08; cierre operativo pendiente.**

Validar en GitHub CI tras abrir el PR. Después de integrar, cambiar Build Type
a Dockerfile en Dokploy según `DEPLOYMENT.md` y ejecutar `check:deployment`
contra el dominio público. No marcar headers públicos como aplicados antes.

1. Resolver AUD-009 y AUD-010: versión de Node, config desplegable, CSP y
   cache.
2. Resolver AUD-011 y AUD-012.
3. Añadir `CONTRIBUTING.md`, política de reportes de seguridad y licencia propia
   si el repositorio se abrirá a contribuciones.

## Comandos de revalidación

```bash
npm audit --omit=dev
npm run typecheck
npm run test
npm run test:e2e:cross-browser
npm run build
npm run check:bundle
```

Después de modificar deploy:

```bash
curl -sSI https://mermaid-styler.duckdns.org/
```

Después de modificar render/export, ejecutar además una prueba manual con:

- flowchart grande con subgraphs y etiquetas HTML;
- sequence, class, state y ER;
- Unicode, emoji, RTL y labels largos;
- fondo transparente;
- export SVG/PNG y clipboard en Chromium, Firefox, Safari/WebKit y móvil.

## Historial de revisiones

| Fecha | Resultado | Referencia |
| --- | --- | --- |
| 2026-09-23 | Baseline inicial: 0 P0, 4 P1, 6 P2, 2 P3 | Esta auditoría |
| 2026-09-23 | Hito 1: dependencias actualizadas, límites preventivos, DOMPurify en labels HTML, CSP de documento y opt-in de source SVG | 10 unitarias, 13 E2E, build y audit sin vulnerabilidades |
| 2026-09-24 | Hito 2 (parcial): PNG con presupuesto adaptativo y limpieza explícita; temas deduplicados en un modelo tipado | 16 unitarias, 15 E2E, build y audit sin vulnerabilidades |
| 2026-09-24 | Hito 2 (parcial): preview y export aislados del orquestador; CI suma smoke Firefox/WebKit; Node fijado a 22.12.0 | Pendiente de CI remoto |
| 2026-10-02 | Hito 2 cerrado: controlador de tema/estado, build estático para E2E, budget de bundle y sanitización directa | 22 unitarias, 15 E2E Chromium, 2 smoke Firefox/WebKit y budget correcto |
| 2026-10-02 | Astro 7.3.5 y Undici 8.11.2; riesgo transitorio de `http-cache-semantics` aceptado | 2 hallazgos high solo en cadena de build; no hay actualización compatible |
| 2026-10-08 | Hito 3 implementado: contenedor estático, contrato HTTP, acciones 44px, licencia y contribuciones | Validación local; pendiente CI remoto y adopción en Dokploy |
| 2026-10-08 | Correcciones transitivas compatibles y Node 22.19.0 | Sin hallazgos high; quedan 2 low de KaTeX/Mermaid |
