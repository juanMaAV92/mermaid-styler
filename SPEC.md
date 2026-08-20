# Mermaid Styler — Technical Specification

Estado: propuesta técnica para la implementación del MVP.

Este documento convierte `PRODUCT.md`, `MVP.md`, `DESIGN.md` y `BACKLOG.md` en contratos técnicos. Cuando exista conflicto, gana el alcance del MVP y la privacidad local.

## 1. Límites del sistema

### Dentro de la aplicación

- Astro genera el shell estático.
- TypeScript y scripts vanilla controlan la interacción.
- Mermaid renderiza en el navegador.
- El SVG se valida, sanitiza y muestra localmente.
- Canvas convierte SVG a PNG.
- El navegador gestiona descargas y clipboard.

### Fuera de la aplicación

- No existe API propia en el MVP.
- No existe almacenamiento remoto ni local.
- No se envía source, SVG ni preferencias a terceros.
- Dokploy solo sirve los archivos estáticos compilados.

## 2. Arquitectura de capas

```text
Astro page
  └── app controller
        ├── Mermaid editor state
        ├── Render coordinator
        │     └── renderMermaid(source, options)
        ├── Style/preset state
        ├── SVG sanitizer
        ├── Export adapters
        │     ├── SVG download
        │     ├── PNG canvas export
        │     └── Clipboard
        └── UI components and message catalog
```

La UI no conoce los detalles internos de Mermaid. El motor no conoce la UI. Los adaptadores de exportación reciben SVG ya validado y no vuelven a renderizar Mermaid.

## 3. Estructura de código prevista

```text
src/
  components/
    ui/
      Button.astro
      Field.astro
      StatusBadge.astro
      ColorField.astro
    mermaid/
      MermaidEditor.astro
      ArtifactStage.astro
      StyleRail.astro
      PresetList.astro
      ErrorTray.astro
  i18n/
    messages.en.ts
  lib/
    mermaid/
      renderMermaid.ts
      mermaidConfig.ts
      themeVariables.ts
      mermaidErrors.ts
      renderCapabilities.ts
    export/
      sanitizeSvg.ts
      downloadSvg.ts
      svgToPng.ts
      clipboard.ts
    performance/
      renderCoordinator.ts
  scripts/
    app.ts
  styles/
    tokens.css
    themes.css
    global.css
  pages/
    index.astro
```

La estructura puede simplificarse durante el scaffold, pero no debe mezclar lógica de render, exportación, estado y presentación en un único script.

## 4. Contratos de datos

```ts
export type MermaidThemeOptions = {
  background: string;
  primaryColor: string;
  primaryBorderColor: string;
  primaryTextColor: string;
  lineColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  transparent: boolean;
};

export type RenderCapabilities = {
  diagramType: string;
  styling: 'supported' | 'partial' | 'not-applicable';
  notes: string[];
};

export type RenderResult = {
  svg: string;
  capabilities: RenderCapabilities;
};

export type RenderErrorCode =
  | 'EMPTY_SOURCE'
  | 'SOURCE_TOO_LARGE'
  | 'PARSE_ERROR'
  | 'RENDER_TIMEOUT'
  | 'RENDER_ERROR'
  | 'SANITIZE_ERROR';

export class MermaidRenderError extends Error {
  code: RenderErrorCode;
  details?: string;
}
```

El contrato público mínimo será:

```ts
renderMermaid(
  source: string,
  options: MermaidThemeOptions,
): Promise<RenderResult>;
```

El resultado nunca debe incluir una referencia a un nodo permanente de la aplicación.

## 5. Flujo de renderizado

1. El editor actualiza el source en memoria.
2. El coordinador aplica debounce.
3. Se valida longitud y contenido vacío.
4. Se crea un `requestId` monotónico.
5. Si hay un render pendiente, se reemplaza por la petición más reciente.
6. Se ejecuta como máximo un render activo.
7. Mermaid valida y genera SVG en un contenedor aislado.
8. El SVG se sanitiza y se valida que tenga dimensiones o `viewBox` útiles.
9. Si el `requestId` sigue vigente, se actualiza el único stage visible.
10. Si el resultado es obsoleto, se descarta sin cambiar la UI.
11. Se limpian contenedores temporales, listeners y referencias auxiliares.

Un error del source actual no debe borrar silenciosamente el último preview válido. La UI debe mostrar `Preview from last valid source` junto al error actual.

## 6. Coordinación y límites de rendimiento

- Source: límite inicial objetivo de 100.000 caracteres, configurable.
- Escritura: debounce de 250–350 ms.
- Cambios de estilo: actualización más corta, sin saltarse la cola latest-wins.
- Concurrencia: un render Mermaid activo y como máximo uno pendiente.
- Timeout: watchdog configurable; el valor final se definirá con pruebas de diagramas grandes.
- DOM: un SVG visible y ningún contenedor auxiliar persistente por render.
- PNG: un canvas temporal por exportación; liberar dimensiones y referencias al finalizar.
- URLs: revocar cada `URL.createObjectURL()` después de su uso.
- Historial: no guardar sources ni SVGs anteriores.
- Dependencias: no añadir Monaco, CodeMirror ni otra dependencia pesada en el MVP.

El coordinador debe ser testeable sin depender del DOM completo: entrada de peticiones, reemplazo de pendientes, descarte de resultados obsoletos y recuperación tras timeout.

## 7. Mermaid y seguridad

- Fijar una versión concreta de Mermaid en el lockfile.
- No permitir que directives del source sobrescriban las configuraciones seguras de la aplicación.
- Usar el nivel de seguridad más restrictivo compatible con los diagramas soportados.
- Mantener Mermaid dentro de un contenedor aislado y sin hermanos manipulables por el SVG.
- Sanitizar scripts, event handlers, referencias externas y contenido no permitido.
- Probar `foreignObject`, enlaces, `classDef`, etiquetas, IDs repetidos y diagramas generados por IA.
- No asumir que la sanitización de Mermaid reemplaza la revisión propia del SVG exportado.
- Rechazar o degradar con claridad diagramas que no puedan mostrarse de forma segura.

El SVG descargado debe ser un archivo inerte: sin JavaScript, handlers, requests externos ni modificaciones al documento que lo abra.

## 8. Temas y tokens

Los presets son datos, no componentes independientes. Cada preset devuelve un `MermaidThemeOptions` completo y los controles editan una copia inmutable del estado actual.

La aplicación tendrá tres capas de tokens:

1. primitivos: color, espacio, tipografía, pesos, radios, bordes, motion y breakpoints;
2. semánticos: superficies, texto, foco, error, éxito y divisores;
3. componentes: editor, stage, rail, botones, campos y estados.

Los valores del diagrama se transforman a `themeVariables` mediante un adaptador. La UI debe poder marcar cada capacidad como `supported`, `partial` o `not-applicable` según la familia Mermaid.

## 9. Exportación

### SVG

- Usar el SVG sanitizado actualmente visible.
- Preservar `viewBox`, dimensiones, estilos y transparencia.
- Crear un `Blob` y revocar el object URL después de la descarga.
- Añadir título y descripción accesibles cuando el pipeline lo permita.
- Mantener una acción para copiar el source Mermaid como alternativa textual.

### PNG

- Derivar dimensiones desde `viewBox` o width/height válidos.
- Usar escala configurable, inicialmente 2x y con opción 3x si el dispositivo lo soporta.
- Esperar fuentes antes de dibujar cuando haya fuentes locales cargadas.
- Mantener transparencia real cuando corresponda.
- Liberar canvas, imagen temporal y URLs al terminar.
- Mostrar error de exportación sin reemplazar el preview válido.

### Clipboard

- Detectar `navigator.clipboard` y `ClipboardItem` en runtime.
- Copiar SVG como texto cuando sea posible.
- Copiar PNG como imagen cuando sea posible.
- Ofrecer descarga como fallback explícito.
- No bloquear el flujo si el permiso del portapapeles se deniega.

## 10. Fuentes e internacionalización

- Usar `IBM Plex Sans` y `IBM Plex Mono` con fallbacks del sistema.
- Cargar solo pesos usados, con `font-display: swap` u `optional`.
- No depender de fuentes remotas.
- Medir fuentes seguras frente a un subset local embebido antes de decidir la estrategia final del SVG.
- Mantener copy de interfaz en `messages.en.ts` o catálogo equivalente.
- Usar claves estables, no strings dentro de componentes.
- Reservar 30–40% de expansión para traducciones.
- Usar CSS lógico para una futura interfaz RTL.
- No traducir ni modificar automáticamente el source Mermaid.

## 11. Accesibilidad

- HTML semántico y labels visibles.
- Foco visible y orden de tabulación estable.
- Estados anunciables: renderizando, válido, inválido, timeout y exportación completada.
- `aria-live` solo para cambios relevantes, sin robar el foco.
- Contraste suficiente y estados que no dependan únicamente de color.
- Preview con nombre/descripcion; source como fallback textual.
- Respeto de `prefers-reduced-motion`.
- Pruebas con zoom al 200%, teclado, lector de pantalla y viewport móvil.

## 12. Despliegue en Dokploy

Destino inicial: Dokploy, sirviendo un artefacto estático.

Configuración prevista:

- build: `npm run build`;
- output: `dist/`;
- runtime: servidor estático dentro de una imagen pequeña;
- puerto: variable de entorno con fallback documentado, preferiblemente `8080`;
- health check: respuesta HTTP 200 de la página principal;
- no runtime server-side para el render Mermaid;
- no variables secretas para el funcionamiento del MVP.

La implementación podrá usar un Dockerfile multistage con builder Node y runtime estático. La elección final se validará contra el flujo de Dokploy durante el scaffold.

## 13. Pruebas y gates

- Unitarias: theme mapping, errores, sanitizer, coordinator y utilidades de exportación.
- Integración: paste → render → style → export.
- Browser: desktop y móvil, clipboard con feature detection, recarga sin persistencia.
- Compatibilidad: flowchart, sequence, class, state, ER y un diagrama grande.
- Seguridad: source malicioso, enlaces, HTML, CSS, IDs repetidos, timeout y requests externos.
- Rendimiento: 20 renders consecutivos sin crecimiento de DOM, listeners, canvas u object URLs.
- Licencias: lockfile y avisos de Mermaid, fuentes, iconos y dependencias.
- Deploy: build limpio y health check correcto en Dokploy.

## 14. Decisiones abiertas controladas

Estas decisiones no bloquean el diseño del sistema, pero deben cerrarse antes del release:

- versión exacta de Mermaid;
- browser baseline oficial;
- watchdog definitivo;
- estrategia de fuente segura frente a subset embebido;
- límite final de source tras medir diagramas grandes;
- forma definitiva del Dockerfile para Dokploy.
