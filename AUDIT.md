# Mermaid Styler — Auditoría técnica

**Fecha:** 2026-09-23  
**Estado:** baseline de auditoría; no se aplicaron correcciones durante esta revisión.  
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
| Repositorio remoto | `origin/main` en `6de585c` (merge del soporte para etiquetas HTML `<br/>`) |
| Copia de trabajo auditada | `feature/html-label-sanitization` en `9622ea9`; contiene el mismo cambio funcional incluido en `origin/main` |
| Stack | Astro 7.3.4, TypeScript, Mermaid 11.17.0, scripts cliente vanilla, salida estática |
| Hosting | Dokploy, Railpack, sitio estático servido en `https://mermaid-styler.duckdns.org/` |
| Persistencia y backend | No hay base de datos, login, endpoint ni almacenamiento de diagramas |
| Dependencias instaladas | 457 totales; `node_modules` ocupa aproximadamente 363 MiB en desarrollo |

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
| Accesibilidad | 3 | Buena base de teclado, estados y foco; labels y targets táctiles por ajustar |
| Rendimiento | 2 | El timeout no puede interrumpir trabajo síncrono pesado de Mermaid |
| Responsive | 3 | Flujo móvil cubierto, con algunos controles compactos |
| Theming | 3 | Existen tokens, pero presets y valores visuales se duplican |
| Integridad de implementación | 3 | Componentes coherentes; el orquestador cliente concentra demasiadas tareas |
| **Total** | **14 / 20** | **Bueno; atender P1 antes de ampliar distribución comunitaria** |

### Lectura por eje técnico

| Eje | Estado | Motivo |
| --- | --- | --- |
| Escalabilidad de tráfico | Fuerte | Hosting estático, sin backend, BD ni procesamiento remoto |
| Escalabilidad de render en navegador | Media | Render Mermaid, parseo y export PNG compiten por CPU/RAM del dispositivo |
| Mantenibilidad | Media-alta | Tipos, módulos y tests presentes; `app.ts` y tema necesitan separación adicional |
| Operación y release | Media | CI básico y despliegue activo; faltan versionado de Node, headers y configuración versionada |
| Privacidad | Buena | No se hacen requests externos y el source no se incrusta en SVG salvo elección explícita |

## Evidencia verificada

### Gates locales

Los siguientes comandos pasaron el 2026-09-23:

```bash
npm run typecheck
npm run build
npm run test
```

Resultados:

- TypeScript sin errores.
- Build estático correcto.
- 9 pruebas unitarias y 13 pruebas E2E en Chromium correctas.
- La prueba E2E cubre flowchart, sequence, class, state, ER, Unicode,
  transparencia, exportación y veinte renders consecutivos.

### Bundle y red

- Build completo no comprimido: aproximadamente **6.53 MiB** de assets estáticos.
- JavaScript total emitido no comprimido: aproximadamente **6.47 MiB**.
- El build emite aviso por un chunk superior a 500 kB minificado.
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

- **Estado:** resuelto el 2026-09-23.
- **Ubicación:** `package.json`, `package-lock.json`.
- **Evidencia:** el baseline reportó 5 vulnerabilidades: 1 crítica, 3 altas y
  1 moderada, transitivas desde Astro 7.2.4. Astro se actualizó a 7.3.4 y
  `npm audit` finalizó sin vulnerabilidades.
- **Impacto:** la aplicación final es estática y no expone el runtime de Astro,
  por lo que la exposición productiva es menor; aun así, el entorno de CI/build
  usa la cadena vulnerable.
- **Acción:** actualizar Astro a una versión corregida (el audit indicó 7.3.4),
  regenerar el lockfile y volver a ejecutar audit, build y tests.
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

- **Estado:** abierto.
- **Ubicación:** `src/lib/export/png.ts`.
- **Evidencia:** el canvas se limita a 16 millones de píxeles: un buffer RGBA
  puede ocupar como mínimo cerca de 64 MiB, sin contar imagen, blob y copias.
  Para evitar incompatibilidades canvas, `foreignObject` se aplana a texto.
- **Impacto:** posibles cierres o lentitud en móviles y pérdida de estilo en
  labels HTML complejos.
- **Acción:** presupuesto según `deviceMemory`/dimensiones, aviso cuando se
  reduzca escala, liberación explícita del canvas y matriz de fidelidad de PNG.

#### AUD-006 — Orquestador cliente con demasiadas responsabilidades

- **Estado:** abierto.
- **Ubicación:** `src/scripts/app.ts` (505 líneas).
- **Evidencia:** el mismo módulo gestiona render, estados, tema, exportación,
  clipboard, zoom, pan, teclado y suscripciones DOM.
- **Impacto:** cambios en una capacidad aumentan el riesgo de regresión en otra
  y hacen más difícil probar la lógica fuera de E2E.
- **Acción:** extraer controladores de preview, exportación, tema y estado de
  render; conservar `renderMermaid()` como límite de dominio.

#### AUD-007 — Fuente de verdad de temas duplicada

- **Estado:** abierto.
- **Ubicación:** `src/lib/theme/presets.ts`, `src/styles/themes.css`,
  `src/components/mermaid/StyleRail.astro`, `src/scripts/app.ts`.
- **Evidencia:** los colores de presets y fallbacks existen en varias capas.
- **Impacto:** el aspecto de swatches, preview y export puede divergir al añadir
  o cambiar un preset.
- **Acción:** definir datos de preset una vez y derivar CSS/swatch/controles
  desde ese modelo.

#### AUD-008 — Cobertura automática limitada a Chromium y sin presupuesto real

- **Estado:** abierto.
- **Ubicación:** `.github/workflows/ci.yml`, `playwright.config.ts`,
  `tests/e2e/hardening.spec.ts`.
- **Evidencia:** CI instala y ejecuta solo Chromium. La prueba de veinte renders
  asegura limpieza de DOM/canvas, pero no compara heap, Long Tasks ni tamaño de
  bundle. Exportación y sanitización carecen de pruebas unitarias directas.
- **Impacto:** regresiones de Safari/Firefox, memoria o SVG pueden llegar a
  `main` sin una alerta confiable.
- **Acción:** añadir matriz WebKit/Firefox en una cadencia razonable, pruebas
  unitarias de export/sanitización y budgets de bundle y rendimiento.

#### AUD-009 — Despliegue no totalmente reproducible desde Git

- **Estado:** abierto.
- **Ubicación:** `package.json`, `README.md`, configuración de Dokploy.
- **Evidencia:** no hay `.node-version`, `.nvmrc`, `engines`, Dockerfile ni
  configuración Railpack versionada. La guía indica Node 22, aunque Astro exige
  `>=22.12.0`; un despliegue anterior resolvió 22.11 y falló.
- **Impacto:** builds futuros pueden depender de defaults cambiantes de Dokploy.
- **Acción:** fijar una versión compatible en el repositorio y documentar o
  versionar las variables, publish directory, puerto, headers y health check.

#### AUD-010 — Headers y cache sin contrato explícito

- **Estado:** abierto.
- **Ubicación:** Dokploy/Traefik, fuera del repositorio.
- **Evidencia:** no se observó CSP ni `Cache-Control` explícito para HTML.
- **Impacto:** menor defensa ante un fallo de sanitización y diagnósticos más
  confusos después de deploys por clientes con assets en cache.
- **Acción:** configurar HTML revalidable, assets con hash cacheables y CSP
  compatible con Mermaid/SVG; documentar la configuración.

### P3 — mejoras de calidad y documentación

#### AUD-011 — Labels y targets táctiles por reforzar

- **Estado:** abierto.
- **Ubicación:** `src/components/mermaid/MermaidEditor.astro`,
  `src/styles/global.css`.
- **Evidencia:** el textarea usa placeholder como nombre accesible, no un label
  asociado. Los controles de zoom miden 30 px y las acciones móviles 38 px.
- **Acción:** asociar label visible o `aria-label` estable y elevar controles
  frecuentes a 44 px cuando el espacio lo permita.

#### AUD-012 — Documentación y licencia de proyecto por cerrar

- **Estado:** abierto.
- **Ubicación:** `PLAN.md`, `BACKLOG.md`, raíz del repositorio.
- **Evidencia:** el plan aún registra validaciones como pendientes y no existe
  una licencia propia de raíz; solo se incluye la licencia de Mermaid.
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

1. Resolver AUD-005 para PNG en móviles y labels complejos.
2. Resolver AUD-006 y AUD-007 sin modificar la frontera pública
   `renderMermaid()`.
3. Resolver AUD-008 con métricas y cobertura de navegador.

### Hito 3 — Operación abierta a comunidad

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
npm run build
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
