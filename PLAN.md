# Mermaid Styler — Implementation Plan

Estado: Fase 3 implementada; exportación, hardening y release pendientes.

## Resultado buscado

Construir y publicar en Dokploy un sitio Astro estático que complete de forma confiable el flujo:

```text
paste Mermaid → render → style → export/copy
```

El trabajo termina cuando el MVP supera los gates técnicos de `SPEC.md` y los criterios de `MVP.md`.

## Orden de ejecución

### Fase 0 — Cerrar decisiones y preparar el repositorio

Objetivo: convertir la documentación actual en una base ejecutable.

Trabajo:

- Revisar `PRODUCT.md`, `MVP.md`, `DESIGN.md`, `BACKLOG.md` y `SPEC.md`.
- Elegir versión concreta de Mermaid y baseline de navegadores.
- Elegir package manager y estrategia inicial de fuentes.
- Confirmar límite de source y watchdog como valores configurables.
- Mantener la licencia de Mermaid y avisos de terceros actualizados.

Salida: decisiones registradas en `SPEC.md`, sin código de producto.

### Fase 1 — Scaffold Astro y sistema base

Estado: completada.

Backlog: `MS-001`, `MS-002`, `MS-033`, `MS-036`.

Objetivo: shell mínimo, estático y consistente.

Trabajo:

- Crear proyecto Astro con TypeScript.
- Configurar build estático, scripts, formato y tipos.
- Crear `tokens.css`, `themes.css` y `global.css`.
- Configurar fuentes locales o fallbacks.
- Crear catálogo inicial de mensajes.
- Crear estructura de componentes sin lógica duplicada.
- Incluir el ejemplo inicial y layout responsive vacío.

Validación: `dev` y `build` funcionan; no hay requests de fuentes remotas obligatorias.

### Fase 2 — Shell visual y estados de interfaz

Estado: completada. Los estados están implementados como una capa de UI
preparada para que el motor de la Fase 3 los actualice sin acoplar Mermaid a
los componentes visuales.

Backlog: `MS-005`, `MS-016`, `MS-017`, `MS-018`, `MS-034`, `MS-035`.

Objetivo: construir la mesa Proof Bench antes de conectar Mermaid.

Trabajo:

- Implementar barra superior y acciones.
- Implementar editor source.
- Implementar artifact stage vacío y estados.
- Implementar rail de estilos con componentes reutilizables.
- Implementar labels, foco, live regions y reduced motion.
- Comprobar expansión de textos y layout móvil.

Validación: la interfaz se puede recorrer por teclado y no contiene valores visuales dispersos.

### Fase 3 — Motor Mermaid y coordinador de renders

Estado: implementada para el preview local del MVP. La exportación y el
hardening profundo quedan para las fases siguientes.

Backlog: `MS-003`, `MS-004`, `MS-006`, `MS-037`, `MS-039`.

Objetivo: obtener preview local rápido y controlado.

Trabajo:

- Implementar `renderMermaid()` y tipos de resultado/error.
- Configurar Mermaid con seguridad restrictiva.
- Implementar validación de source y límite de longitud.
- Implementar debounce y cola latest-wins.
- Implementar request IDs, timeout y descarte de renders obsoletos.
- Limpiar nodos temporales y evitar listeners acumulados.
- Conectar estados `empty`, `rendering`, `ready`, `error` y `timeout`.

Validación: paste → render funciona; un source inválido conserva el preview anterior y muestra un error claro.

### Fase 4 — Temas, presets y compatibilidad Mermaid

Backlog: `MS-007`, `MS-008`, `MS-009`, `MS-010`, `MS-019`, `MS-024`, `MS-043`.

Objetivo: aplicar la identidad visual sin prometer capacidades que Mermaid no soporta.

Trabajo:

- Crear adaptador de tokens a `themeVariables`.
- Implementar presets Light, Dark, Terminal, Paper y Architecture.
- Implementar controles de color, tipografía, tamaño y transparencia.
- Implementar estado `Custom` al modificar un preset.
- Crear matriz de capacidades por familia de diagrama.
- Mostrar compatibilidad `supported`, `partial` o `not-applicable` de forma discreta.

Validación: cambiar un control actualiza el preview y la matriz registra las diferencias reales entre flowchart, sequence, class, state y ER.

### Fase 5 — Sanitización, exportación y clipboard

Backlog: `MS-011`, `MS-012`, `MS-013`, `MS-014`, `MS-015`, `MS-045`, `MS-046`, `MS-049`.

Objetivo: producir artefactos confiables fuera de la aplicación.

Trabajo:

- Sanitizar SVG con una política allowlist.
- Preservar dimensiones, viewBox, estilos y transparencia.
- Añadir title/description y source alternativo cuando sea posible.
- Implementar descarga SVG.
- Implementar PNG 2x/3x con canvas temporal.
- Liberar canvas, imágenes y object URLs.
- Implementar copy SVG y copy PNG con feature detection.
- Documentar fallbacks de Safari, Firefox y móvil tras probarlos.

Validación: SVG y PNG no tienen recortes, conservan estilos y no contienen contenido ejecutable ni requests externos.

### Fase 6 — Hardening, privacidad, licencias y rendimiento

Backlog: `MS-020`, `MS-021`, `MS-022`, `MS-040`, `MS-041`, `MS-042`, `MS-044`, `MS-047`, `MS-048`, `MS-050`, `MS-051`.

Objetivo: comprobar que el MVP es resistente y publicable.

Trabajo:

- Probar source grande, Unicode, emoji, labels largos y subgrafos.
- Ejecutar 20 renders consecutivos y revisar DOM, listeners, canvas y object URLs.
- Auditar bundle y dependencias.
- Revisar requests en DevTools y confirmar procesamiento local.
- Probar restauración automática de formularios tras recarga.
- Ejecutar pruebas de expansión de traducciones y RTL.
- Comparar fuentes seguras frente a subset embebido.
- Revisar licencias y completar `THIRD_PARTY_NOTICES.md`.
- Probar navegadores desktop y móvil.

Validación: no hay crecimiento sostenido de recursos, requests de source ni bloqueos ante inputs extremos.

### Fase 7 — Dokploy y release

Backlog: `MS-023`, `MS-025`, `MS-026`, `MS-052`.

Objetivo: publicar el sitio estático en Dokploy.

Trabajo:

- Crear README de instalación, build, test y deploy.
- Crear la configuración reproducible de Dokploy.
- Definir build, `dist/`, puerto y health check.
- Crear Dockerfile multistage si es la opción elegida.
- Publicar una demo.
- Añadir guía de contribución e issues.
- Revisar la demo desde desktop y móvil después del deploy.

Validación: Dokploy sirve el build estático con HTTP 200, sin backend y sin cambiar el comportamiento local.

## Dependencias críticas

```text
Scaffold
  → tokens/components
  → render coordinator
  → Mermaid engine
  → themes/presets
  → export/security
  → hardening/QA
  → Dokploy release
```

No empezar por exportación ni por Dokploy antes de tener un render local estable. No optimizar memoria con mediciones ficticias: primero implementar límites observables y luego medir la sesión de 20 renders.

## Primer corte implementable

El primer corte de código debe producir:

- Astro funcionando;
- layout Proof Bench responsive;
- tokens y componentes base;
- editor con source inicial;
- preview vacío con estado accesible;
- catálogo de mensajes;
- sin Mermaid todavía si cargarlo impide validar el shell.

El segundo corte conectará Mermaid y el coordinador. Así se puede evaluar primero la composición y después el comportamiento pesado.

## Definition of Done del MVP

- Todos los requisitos `MVP-01` a `MVP-20` verificados.
- `SPEC.md` no tiene decisiones abiertas que afecten seguridad o publicación.
- Build estático reproducible.
- Tests y pruebas manuales documentados.
- Avisos de licencia completos.
- Demo funcionando en Dokploy.
- Repositorio limpio y README actualizado.
