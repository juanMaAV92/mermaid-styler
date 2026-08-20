# Mermaid Styler — Visual Design

> Estado: dirección visual aprobada para especificación; implementación pendiente.

## Dirección

### Proof Bench

Mermaid Styler se comporta como una mesa de pruebas de impresión para artefactos técnicos: el código aparece como materia prima, el preview como una prueba visual y los estilos como herramientas de registro y acabado.

La interfaz no intenta parecer un editor de diagramas completo, una terminal retro ni una app marina. Su mundo visual nace de la mezcla entre código fuente, pruebas de impresión, documentación técnica y exportación de artefactos.

**Modo:** Operate.

**Semilla de dirección de Impeccable:** `32d896a2`, dirección asignada `4`, modo `operate`.

## Contrato de diseño

- **THESIS:** convertir sintaxis en un artefacto listo para compartir; se rechaza el layout de dashboard genérico con tarjetas decorativas.
- **OWN-WORLD:** chrome de taller técnico oscuro, superficie de preview tipo papel, reglas finas, etiquetas compactas y un acento cyan de registro.
- **STORY:** la persona pega código, ve el resultado, lo ajusta y exporta; cada estado explica en qué etapa está el artefacto.
- **FIRST VIEWPORT:** barra de acciones arriba; editor de source a la izquierda; preview dominante al centro; rail de estilos a la derecha; el primer ejemplo visible desde la carga.
- **FORM:** mesa de pruebas de impresión técnica, dirección asignada por la semilla `32d896a2`.
- **FINISH:** un build futuro termina con la revisión de acabado, el veredicto y la documentación de `DESIGN.md`: “unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md”.

## Paleta

La estrategia es `Restrained`: neutros de trabajo más un acento de señal. El usuario llega a operar la herramienta; el color no debe competir con el diagrama.

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#0B0F14` | Fondo principal y chrome profundo |
| `--graphite` | `#151C24` | Editor, rail y superficies técnicas |
| `--paper` | `#F4F1E8` | Superficie principal del preview |
| `--signal-cyan` | `#69E6F7` | Foco, estado activo, registro y acción primaria |
| `--ember` | `#FF6B57` | Error, advertencia y estado de atención |
| `--steel` | `#8B98A8` | Texto secundario y metadatos |
| `--line` | `#2A3542` | Divisores y bordes de baja intensidad |

El cyan no debe convertirse en un glow permanente. Se usa como tinta de registro: una señal precisa que indica foco o cambio.

El fondo transparente se representa con un checkerboard sobrio dentro del stage, nunca con una etiqueta ambigua.

## Sistema de tokens

Los valores de este documento deben implementarse como tokens, no copiarse directamente en componentes. La fuente única recomendada es `src/styles/tokens.css`, con un segundo archivo para tokens de tema o preset si resulta necesario.

### Capas

1. **Primitivos:** colores, escala tipográfica, pesos, espacios, radios, bordes, elevación, breakpoints y motion.
2. **Semánticos:** `surface-app`, `surface-editor`, `surface-preview`, `text-primary`, `text-secondary`, `border-subtle`, `focus-ring`, `status-error` y `status-success`.
3. **Componentes:** tokens para `action-button`, `editor`, `artifact-stage`, `style-rail`, `preset-option`, `field` y `error-tray`.

Los componentes solo consumen tokens semánticos o de componente. Quedan prohibidos los colores hexadecimales, tamaños y espaciados aislados dentro de hojas de estilo de componentes, salvo excepciones documentadas para el SVG generado por Mermaid.

Escala de referencia:

| Familia | Valores iniciales |
|---|---|
| Espacio | 4, 8, 12, 16, 24, 32, 48px |
| Texto UI | 11, 13, 15, 18, 28px |
| Peso | 400, 500, 600 |
| Radio | 0, 4, 8px |
| Borde | 1px, 2px para foco |
| Motion | 160ms, 220ms, 320ms |

Los nombres de tokens deben describir intención, no ubicación: `--text-muted` es preferible a `--gray-500` y `--space-panel` a `--left-padding`.

## Arquitectura de componentes

La interfaz debe tener límites claros y componentes reutilizables:

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
  styles/
    tokens.css
    themes.css
    global.css
  i18n/
    messages.en.ts
```

La estructura es orientativa, pero la regla es obligatoria: una acción o patrón visual compartido se implementa una vez. No debe haber botones con estilos paralelos, mensajes de error duplicados ni valores visuales regados entre scripts y plantillas.

La lógica de renderizado queda en `src/lib/mermaid/` y no se mezcla con los componentes visuales.

## Tipografía

- **Interfaz:** `IBM Plex Sans`, con fallback `ui-sans-serif, system-ui, sans-serif`.
- **Código y metadatos:** `IBM Plex Mono`, con fallback `ui-monospace, SFMono-Regular, monospace`.

IBM Plex se elige porque sus variantes sans y mono comparten carácter y métricas suficientemente compatibles para que los paneles densos mantengan alineación al alternar entre source, controles y estados. Las fuentes deben servirse localmente o tener un fallback completo; no se debe depender de un CDN.

Se cargarán únicamente los pesos realmente usados, con `font-display: swap` u `optional`, y con subset Latin inicialmente. Si se añade soporte CJK, árabe u otros alfabetos, sus fuentes se incorporarán como recursos separados y bajo demanda. La interfaz debe conservar una composición funcional con fuentes del sistema.

Escala inicial:

- 11px: labels y estados auxiliares.
- 13px: controles y metadatos.
- 15px: texto de interfaz.
- 18px: títulos de panel.
- 28px: nombre del producto o estado principal en espacios amplios.

## Composición

Desktop amplio:

```text
┌──────────────────────────────────────────────────────────────┐
│ MERMAID STYLER                 PRESET  COPY  EXPORT          │
├───────────────────────┬─────────────────────┬───────────────┤
│ SOURCE                │ ARTIFACT STAGE      │ STYLE         │
│ editor monoespaciado  │ SVG sobre papel     │ presets        │
│                       │ estado de render    │ controles      │
└───────────────────────┴─────────────────────┴───────────────┘
```

- Editor: aproximadamente 36% del ancho.
- Preview: aproximadamente 44% del ancho y mayor peso visual.
- Rail de estilos: aproximadamente 20%, colapsable en pantallas menores.
- Barra superior: acciones principales visibles, sin esconder exportación en un menú secundario.
- Bordes: 1px y discretos; el layout se organiza por reglas y espacio, no por sombras.
- Radios: pequeños y funcionales; evitar una colección de pills y tarjetas flotantes.

En móvil, el orden es source → preview → style. El estado del preview y las acciones de exportación deben seguir siendo visibles después de editar.

## Componentes y lenguaje

### Barra superior

Incluye el wordmark, estado del render, preset actual, copiar y exportar. La acción primaria debe ser textual y concreta: `Export SVG`, `Export PNG`, `Copy SVG`.

### Editor

Superficie graphite, numeración opcional y texto monoespaciado. No necesita syntax highlighting completo en el MVP. El placeholder debe enseñar un ejemplo real, no texto promocional.

### Artifact stage

Superficie paper con padding generoso. El diagrama es el protagonista. Debe existir una etiqueta discreta de estado: `Rendered`, `Rendering`, `Invalid Mermaid` o `Preview from last valid source`.

### Style rail

Agrupa controles en `Preset`, `Color`, `Type` y `Background`. Los swatches deben mostrar el valor actual. Al modificar un preset, el nombre cambia a `Custom`.

### Errores

El error aparece cerca del editor y conserva el preview válido anterior. Debe incluir una explicación corta y, cuando Mermaid dé información suficiente, la ubicación o el fragmento problemático.

## Interacción y movimiento

La única firma de movimiento es una “registration pass”: al terminar un render válido, una línea cyan muy breve recorre el borde del artifact stage y el estado cambia a `Rendered`.

- Duración objetivo: 160–220ms.
- No animar cada control por separado.
- No usar glow continuo, partículas ni fondos animados.
- Con `prefers-reduced-motion`, eliminar el recorrido y conservar únicamente el cambio de estado.
- Los renders deben mostrar feedback inmediato aunque el resultado tarde más en llegar.

## Voz y copy

La interfaz usa verbos concretos y lenguaje de herramienta:

- `Paste Mermaid`
- `Style diagram`
- `Reset styles`
- `Copy SVG`
- `Export PNG`
- `Invalid Mermaid`
- `Fix the source and render again`

Evitar frases de marketing, metáforas marinas y mensajes vagos como `Something went wrong`.

El copy no debe estar escrito directamente dentro de componentes. Usar claves de mensajes con una lengua base y fallbacks claros:

```ts
messages.en = {
  'actions.exportPng': 'Export PNG',
  'actions.copySvg': 'Copy SVG',
  'errors.invalidMermaid': 'Invalid Mermaid',
  'errors.fixSource': 'Fix the source and render again',
  'status.rendered': 'Rendered'
};
```

Las claves deben mantenerse estables para permitir traducciones futuras. Los botones deben crecer con el contenido, sin anchos fijos, y el layout debe reservar espacio para traducciones 30–40% más largas. Usar propiedades CSS lógicas (`margin-inline`, `padding-inline`, `border-inline`) para no bloquear una futura interfaz RTL.

## Accesibilidad

- Todos los controles tienen label visible o accesible.
- El foco de teclado se distingue con cyan y un contorno adicional.
- El color nunca es el único indicador de estado.
- El texto secundario debe conservar contraste suficiente sobre graphite.
- El checkerboard de transparencia debe incluir una etiqueta textual.
- Los mensajes de error deben anunciarse de forma accesible sin robar el foco.
- El layout no debe depender de hover.

## Reglas de responsive

- No reducir el editor hasta volverlo incómodo: pasar el rail a un drawer o bloque inferior antes de comprimirlo.
- Mantener las acciones de exportación accesibles con pulgar en móvil.
- Permitir scroll horizontal controlado únicamente dentro del editor cuando el código lo requiera.
- El preview debe poder ampliarse sin romper el layout.
- Evitar modales para tareas frecuentes.

## Rendimiento y memoria

El renderizado debe seguir una política `latest-wins`: una operación Mermaid activa y como máximo una pendiente. Un cambio nuevo reemplaza la operación pendiente; los resultados con un identificador antiguo se ignoran.

- Debounce de 250–350ms para escritura y actualización acotada para cambios de estilo.
- No crear una instancia o listener nuevo por cada render.
- Limpiar SVGs, nodos auxiliares y listeners al terminar cada operación.
- Revocar object URLs de descargas e imágenes.
- Destruir o liberar el canvas temporal de exportación PNG.
- Mantener un solo SVG visible en el stage.
- Limitar el source y mostrar timeout si el render excede el umbral definido.
- Evitar dependencias pesadas de editor y animaciones que produzcan layout.
- Medir una sesión de 20 renders y comprobar ausencia de crecimiento sostenido de DOM, listeners, object URLs, canvas o renders concurrentes.

El preview debe usar contención CSS cuando sea compatible y las animaciones deben limitarse a `transform` y `opacity` cuando exista movimiento.

## Compatibilidad y degradación

Los controles de estilo se deben presentar como capacidades graduadas por familia de diagrama:

- `Supported`: el control tiene efecto verificable.
- `Partial`: el efecto aplica solo a algunos elementos.
- `Not applicable`: el tipo de diagrama no usa esa variable.

La UI nunca debe sugerir que todas las cajas, líneas o etiquetas cambiarán de forma uniforme. Cuando un control es parcial, el estado debe ser visible sin convertir la interfaz en una tabla técnica.

El preview y la exportación deben probarse con flowchart, sequence, class, state, ER y un diagrama grande. Unicode, emoji, labels largos y subgrafos forman parte del contenido de prueba.

## Exportación y fuentes

El SVG debe conservar estilos, dimensiones, `viewBox` y transparencia sin introducir scripts, event handlers ni requests externos. La sanitización puede alterar funciones avanzadas; cualquier limitación debe comunicarse antes de exportar.

La decisión de fuentes tiene dos opciones:

- fuentes seguras/locales: archivo ligero y mayor compatibilidad operativa, con posible variación entre equipos;
- subset embebido: mayor fidelidad del artefacto, con SVG más pesado y complejidad de licencia.

El backlog debe medir ambas opciones antes de cerrar la implementación. Mientras no haya medición, la interfaz debe funcionar correctamente con el fallback del sistema.

## Clipboard y fallback

Las acciones de clipboard deben detectar soporte en runtime. Si el navegador no permite copiar PNG, la interfaz ofrece `Copy SVG` y descarga directa sin presentar el fallback como un error inesperado.

El copy de interfaz debe explicar el resultado: `PNG copied`, `SVG copied` o `Download SVG instead`.

## Accesibilidad del diagrama

El artifact stage debe tener nombre y estado accesible. El SVG exportado debe incorporar título y descripción cuando el pipeline lo permita, y la interfaz debe conservar una acción para copiar el source Mermaid como representación textual alternativa.

El SVG visual no se considera suficiente por sí solo para lectores de pantalla.

## Privacidad, recursos y despliegue

La identidad de producto incluye procesamiento local, por lo que no se deben cargar fuentes, analytics o servicios de render externos sin una decisión explícita. La verificación debe hacerse desde Network, no solo desde el código fuente.

El destino inicial es Dokploy. La estética no debe depender del proveedor: Dokploy sirve el build estático con un flujo reproducible, output y health check documentados.

La ausencia de persistencia también debe verificarse contra la restauración automática de formularios de cada navegador. El source se pierde al recargar por diseño.

## Anti-patrones explícitos

- No usar gradientes decorativos como fondo principal.
- No usar una cuadrícula de tarjetas de dashboard.
- No usar iconos ambiguos sin texto en acciones críticas.
- No hacer que el preview parezca una miniatura secundaria.
- No representar Mermaid literalmente con una sirena o elementos acuáticos.
- No convertir la terminal preset en la identidad completa de la aplicación.
