# Mermaid Styler — MVP

## Objetivo

Entregar una herramienta web estática que convierta código Mermaid generado por una persona o una IA en un diagrama estilizado, visible y exportable, sin login y sin enviar el código a un servicio externo.

## Usuario y tarea principal

Una persona técnica pega Mermaid, verifica el resultado, aplica un preset o ajusta algunos controles y copia o descarga el artefacto final.

La tarea debe poder completarse sin leer documentación y sin crear una cuenta.

## Alcance del MVP

### Incluido

- Editor de texto para Mermaid.
- Ejemplo inicial de diagrama y acción para limpiar/restaurar.
- Renderizado en vivo en el navegador con la librería oficial de Mermaid.
- Preview SVG visible junto al editor en desktop.
- Layout apilado y usable en móvil.
- Presets Light, Dark, Terminal, Paper y Architecture.
- Controles para fondo, cajas, bordes, texto, líneas, énfasis, tipografía, tamaño de texto y transparencia.
- Descarga de SVG.
- Descarga de PNG mediante canvas, con escala de exportación superior a 1x.
- Copiar SVG como texto.
- Copiar PNG como imagen cuando el navegador lo permita.
- Fallback comprensible cuando el portapapeles de imágenes no está disponible.
- Mensajes de error claros ante Mermaid inválido.
- Conservación del último preview válido mientras se muestra un error nuevo.
- Límite de tamaño del input, debounce y protección contra renders obsoletos.
- Sanitización del SVG antes de mostrarlo o descargarlo.
- Sistema de tokens único para colores, tipografía, tamaños, espaciado, bordes, radios, estados y motion.
- Componentes y estilos compartidos sin valores visuales duplicados ni markup de acciones repetido.
- Copy de interfaz separado en un catálogo de mensajes preparado para traducción.
- Fuentes limitadas, preferiblemente locales, con fallback de sistema y sin dependencia de un CDN.
- Cola de renderizado latest-wins con una sola operación activa y como máximo una operación pendiente.
- Limpieza de SVG anterior, contenedores temporales, canvas y object URLs para evitar crecimiento de memoria.
- Documentación de límites de estilo por familia de diagrama Mermaid.
- Matriz de compatibilidad de exportación y portapapeles para navegadores desktop y móvil.
- Fallback de accesibilidad para diagramas exportados, incluyendo título, descripción y source Mermaid.
- Auditoría de requests para confirmar que no salen source, SVG ni eventos analíticos del navegador.
- Revisión de licencias de Mermaid, fuentes y dependencias antes de publicar.
- Despliegue inicial en Dokploy como sitio estático.
- Ausencia de login, persistencia, historial, analytics de contenido o backend.
- README posterior con ejecución, build y despliegue.

### Fuera del MVP

- Endpoint remoto `POST /render`.
- Guardado de diagramas o proyectos.
- Compartir mediante URLs persistentes.
- Editor con syntax highlighting avanzado.
- Colaboración multiusuario.
- Generación o modificación de Mermaid mediante IA.
- Biblioteca de plantillas extensa.
- CSS arbitrario para modificar cualquier nodo.
- Autenticación, base de datos o almacenamiento remoto.

## Requisitos funcionales

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| MVP-01 | Pegar Mermaid | Al pegar un diagrama válido, el preview aparece automáticamente. |
| MVP-02 | Editar Mermaid | Cada cambio válido actualiza el preview después de un debounce breve. |
| MVP-03 | Aplicar preset | Seleccionar un preset actualiza colores, fondo, tipografía y contraste del preview. |
| MVP-04 | Ajustar estilos | Cambiar un control visual actualiza el preview sin recargar la página. |
| MVP-05 | Transparencia | El usuario puede alternar entre fondo transparente y opaco. |
| MVP-06 | Descargar SVG | El archivo descargado contiene el SVG con los estilos aplicados. |
| MVP-07 | Descargar PNG | El PNG se descarga sin recortes, con buena nitidez y transparencia correcta. |
| MVP-08 | Copiar SVG | El SVG se copia como texto al portapapeles o se informa del fallback disponible. |
| MVP-09 | Copiar imagen | El PNG se copia como imagen cuando la API del navegador lo admite. |
| MVP-10 | Mermaid inválido | El usuario ve qué ocurrió y una indicación útil para corregirlo. |
| MVP-11 | Privacidad | No existe una petición de red que envíe el código Mermaid del usuario. |
| MVP-12 | Recarga | Al recargar, no se recupera el código anterior desde almacenamiento local. |
| MVP-13 | Responsive | El flujo completo funciona en desktop y en una pantalla móvil. |
| MVP-14 | Compatibilidad Mermaid | La interfaz explica que algunos controles dependen del tipo de diagrama y la matriz de pruebas cubre las familias principales. |
| MVP-15 | Complejidad | Un source demasiado grande o un render que excede el watchdog recibe un mensaje claro y no congela la interfaz. |
| MVP-16 | Clipboard | La aplicación detecta capacidades y ofrece descarga o copia de SVG cuando copiar PNG no es posible. |
| MVP-17 | Privacidad | DevTools confirma que no hay requests con source, SVG, telemetría de contenido ni fuentes remotas obligatorias. |
| MVP-18 | Accesibilidad del export | El preview y el SVG incluyen nombre/descripcion cuando sea posible y ofrecen el source como alternativa. |
| MVP-19 | Licencias | Las licencias y atribuciones necesarias están revisadas y documentadas antes del release. |
| MVP-20 | Dokploy | El build estático se sirve correctamente desde Dokploy con health check y configuración documentada. |

## Contrato técnico mínimo

La interfaz no debe contener la lógica de Mermaid directamente. El motor debe exponer una función reutilizable similar a:

```ts
renderMermaid(source, options): Promise<string>
```

La función debe:

- validar y renderizar el source;
- recibir opciones de tema y exportación;
- devolver SVG sanitizable;
- lanzar errores identificables;
- no modificar el DOM de la aplicación ni conocer componentes de UI.

El mapa de estilos debe usar `themeVariables` como mecanismo principal. Variables como `primaryColor`, `primaryTextColor`, `primaryBorderColor`, `lineColor`, `background` y `fontFamily` deben tener equivalentes claros. El color de énfasis puede usar variables secundarias o terciarias según el tipo de diagrama.

No todos los diagramas Mermaid usan las variables de la misma manera. El motor debe devolver o acompañar metadatos de compatibilidad cuando sea útil para que la UI pueda comunicar `supported`, `partial` o `not-applicable` sin prometer un resultado uniforme.

## Sistema de tokens y componentes

El sistema visual debe tener una única fuente de verdad, por ejemplo `src/styles/tokens.css` o un módulo equivalente. Los componentes no pueden introducir colores, tamaños, espaciados, radios o duraciones arbitrarias.

Se deben distinguir:

- tokens primitivos: valores de color, escala de espacio, tamaños de fuente y pesos;
- tokens semánticos: `surface-app`, `surface-editor`, `surface-preview`, `text-primary`, `text-muted`, `focus-ring`, `status-error`;
- tokens de componente: reglas específicas para botones, campos, paneles, rail, preview y estados.

Los componentes compartidos deben vivir en una estructura estable, por ejemplo `src/components/ui/` y `src/components/mermaid/`. La interfaz no debe tener botones, mensajes de error, controles de color o estados duplicados con pequeñas variaciones locales.

La escala inicial debe cubrir, como mínimo:

- colores y estados;
- tipografía, tamaños y pesos;
- espaciado;
- radios y bordes;
- sombras o elevación, si se usan;
- z-index;
- breakpoints;
- duraciones y curvas de movimiento.

## Copy e internacionalización futura

Todo copy de la interfaz debe usar claves estables, por ejemplo `actions.exportPng`, `errors.invalidMermaid` y `status.rendered`, en lugar de strings escritos dentro de los componentes.

La primera lengua puede ser inglés por el público developer, pero la estructura debe permitir añadir español sin cambiar la lógica. Los layouts deben reservar aproximadamente 30–40% de espacio adicional para traducciones largas, usar propiedades CSS lógicas y soportar texto RTL en la interfaz.

El source Mermaid se trata como contenido del usuario: no se traduce, no se reescribe y no se usa como clave de traducción.

## Requisitos no funcionales

- Build estático con Astro.
- TypeScript estricto donde sea razonable.
- Sin frameworks de componentes en la primera versión.
- Sin fuentes remotas obligatorias.
- Una única fuente de tokens y componentes compartidos; no se aceptan valores visuales mágicos dispersos.
- Catálogo de copy separado del código de interacción.
- Estados de foco visibles y controles navegables por teclado.
- Contraste suficiente para texto, errores y acciones.
- Respeto de `prefers-reduced-motion`.
- Renderizado controlado para evitar condiciones de carrera durante la escritura.
- SVG seguro para preview, descarga y copia.

## Presupuesto de recursos y renders

El objetivo no es establecer un número universal de MB de RAM —varía por navegador y dispositivo—, sino impedir crecimiento no acotado y trabajo duplicado.

- Cargar Mermaid de forma diferida respecto al shell visual cuando sea posible, sin bloquear la primera pintura de la interfaz.
- No añadir Monaco, CodeMirror ni otra dependencia pesada al MVP solo para colorear el editor.
- Mantener una sola instancia/módulo de Mermaid y serializar sus renders.
- Aplicar debounce de aproximadamente 250–350 ms a cambios de source y una actualización más corta para controles visuales, siempre limitada por la cola.
- Si llega un cambio nuevo, reemplazar el render pendiente y descartar resultados cuyo identificador ya no sea el actual.
- No iniciar un tercer render mientras exista uno activo y otro pendiente.
- Limitar el source a un máximo configurable, inicialmente objetivo de 100.000 caracteres, y rechazarlo con un mensaje claro si se supera.
- Aplicar un watchdog de render y mostrar timeout sin congelar la interfaz.
- Mantener un solo SVG de preview en el DOM; limpiar contenedores auxiliares de Mermaid después de cada operación.
- Revocar cada `URL.createObjectURL()` después de descargar o decodificar el recurso.
- Liberar el canvas temporal de PNG después de exportar y no conservar bitmaps históricos.
- No registrar en memoria el historial completo de sources ni de SVGs.
- Usar `contain` o límites equivalentes en las regiones editor, preview y rail cuando ayude a reducir recálculos.

La validación de rendimiento debe incluir una sesión de al menos 20 cambios consecutivos sobre un diagrama mediano y comprobar que no crece el número de nodos, listeners, object URLs, canvas ni renders concurrentes.

También debe incluir un diagrama grande, un source con Unicode/emoji y un source con texto largo para comprobar que los límites, el wrapping y el timeout degradan de forma controlada.

## Exportación, navegadores y fidelidad

- Probar SVG y PNG en los navegadores objetivo y documentar diferencias.
- Decidir antes del release entre fuentes seguras del sistema y un subconjunto local embebido; medir el impacto de peso del SVG.
- No asumir que `ClipboardItem` está disponible: ofrecer descarga y copia de SVG como fallback.
- Probar transparencia, texto largo, `foreignObject`, enlaces y diagramas con múltiples subgrafos después de sanitizar.
- No incluir en el SVG exportado scripts, event handlers ni requests externos.

## Accesibilidad del artefacto

El preview debe exponer un nombre y una descripción accesibles cuando sea posible. El usuario debe poder abrir o copiar el source Mermaid como alternativa textual del diagrama, ya que la imagen SVG no comunica por sí sola toda la estructura a tecnologías de asistencia.

## Privacidad y licencias

La comprobación de privacidad debe inspeccionar la pestaña Network con un diagrama sensible y confirmar que el único tráfico corresponde a recursos propios necesarios para cargar la aplicación. No se deben añadir analytics de contenido, fuentes remotas o servicios de render.

Antes del despliegue público, documentar las licencias de Mermaid, fuentes, iconos, snippets y dependencias incluidas en el bundle.

## Despliegue

Dokploy es el destino inicial. El repositorio debe producir un artefacto estático y ofrecer una configuración reproducible para que Dokploy lo sirva, incluyendo comando de build, directorio de salida, puerto y health check. El despliegue no debe introducir un backend ni cambiar la promesa de procesamiento local.

## Criterio de salida

El MVP está listo cuando una persona nueva puede abrir la aplicación, pegar un flowchart y un sequence diagram, aplicar un preset, ajustar un color, descargar SVG y PNG, y entender un error de sintaxis sin asistencia. También debe superar las pruebas de memoria, compatibilidad, privacidad, accesibilidad, licencias y despliegue en Dokploy.

Antes de publicar se debe comprobar al menos un caso válido y uno inválido en desktop y móvil, además de verificar que el código no sale del navegador.
