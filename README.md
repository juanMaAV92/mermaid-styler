# Mermaid Styler

<div align="center">

### De código Mermaid generado por IA a un diagrama listo para compartir.

Herramienta local-first para pegar Mermaid, visualizarlo, aplicar estilo y exportar
un artefacto presentable para Jira, documentación, presentaciones o pull requests.

<img alt="Status: WIP" src="https://img.shields.io/badge/status-WIP-orange.svg">
<img alt="Built with Astro" src="https://img.shields.io/badge/built%20with-Astro-BC52EE.svg">
<img alt="Mermaid" src="https://img.shields.io/badge/renderer-Mermaid-FF3670.svg">
<img alt="Static site" src="https://img.shields.io/badge/deployment-static-2EA44F.svg">

</div>

---

## ¿Qué es Mermaid Styler?

Mermaid Styler es una capa de presentación para código Mermaid. No pretende ser
otro editor completo de diagramas ni guardar proyectos: resuelve una tarea puntual
en pocos segundos.

```text
pegar Mermaid → visualizar → aplicar estilo → copiar o exportar
```

Todo el procesamiento de la primera versión ocurre en el navegador. No hay login,
base de datos, historial, persistencia ni envío del código Mermaid a un servicio
externo.

## Estado del proyecto

**WIP — flujo principal implementado.** El render Mermaid local, los estilos,
zoom/pan, sanitización, exportación SVG/PNG y clipboard ya funcionan. Quedan el
hardening de compatibilidad, la matriz por familia de diagrama y el despliegue
final en Dokploy.

## Alcance del MVP

- Editor para pegar y editar código Mermaid.
- Preview renderizado en el navegador con la librería oficial de Mermaid.
- Presets Light, Dark, Terminal, Paper y Architecture.
- Controles para fondo, cajas, bordes, texto, líneas, énfasis, tipografía, tamaño y transparencia.
- Descarga de SVG y PNG.
- Copiar SVG y copiar la imagen cuando el navegador lo permita.
- Mensajes claros para código inválido, límites de entrada y timeouts.
- Renderizado local, cola de renders latest-wins y límites de recursos para evitar trabajo acumulado.
- Diseño usable en desktop y móvil.
- Sitio estático desplegable en Dokploy.

El endpoint remoto `POST /render`, el guardado de proyectos, la colaboración y la
generación de Mermaid con IA están fuera del MVP.

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Astro 7 · TypeScript |
| Render | Mermaid 11, ejecutado en el navegador |
| UI | HTML, CSS y scripts vanilla; sin React, Vue ni Svelte |
| Estilos | Sistema de tokens CSS y componentes Astro reutilizables |
| Build | Sitio estático con salida en `dist/` |
| Deploy | Dokploy como destino inicial |

## Mapa del repo

```text
mermaid-styler/
├── src/
│   ├── components/       # Componentes UI y del workbench Mermaid
│   ├── i18n/             # Catálogo de copy preparado para traducción
│   ├── pages/             # Páginas Astro
│   ├── scripts/           # Interacción cliente vanilla
│   └── styles/            # Tokens, temas y estilos globales
├── PRODUCT.md             # Definición de producto y posicionamiento
├── MVP.md                 # Alcance y criterios de aceptación del MVP
├── SPEC.md                # Especificación técnica
├── DESIGN.md              # Identidad visual y sistema de diseño
├── BACKLOG.md             # Trabajo priorizado
├── PLAN.md                # Plan de implementación por fases
├── THIRD_PARTY_NOTICES.md # Licencias y atribuciones de terceros
└── LICENSES/              # Textos de licencias de dependencias relevantes
```

## Levantar en local

### Requisitos

- Node.js compatible con Astro 7.
- npm.

### Pasos

```bash
git clone https://github.com/juanMaAV92/mermaid-styler.git
cd mermaid-styler
npm install
npm run dev
```

La aplicación queda disponible en la URL local que indique Astro, normalmente
`http://localhost:4321`.

## Comandos

```bash
npm run dev       # servidor de desarrollo
npm run typecheck # validación de TypeScript
npm run build     # build estático en dist/
npm run preview   # sirve localmente el build generado
```

## Despliegue en Dokploy

Mermaid Styler se publica como sitio estático. El build produce el directorio
`dist/`, que debe ser servido por el runtime estático configurado en Dokploy.

El flujo previsto es:

```bash
npm install
npm run build
# servir dist/ con el runtime estático de Dokploy
```

La configuración final de build, puerto y health check se cerrará durante la fase
de release y quedará documentada aquí antes de publicar la demo.

## Privacidad y límites

- El código Mermaid permanece en el navegador durante el flujo normal.
- La aplicación no crea cuentas ni almacena diagramas después de recargar.
- La primera versión no incluye backend ni endpoint remoto.
- El renderizado se limita a una operación activa y un render pendiente como máximo.
- Los SVG se sanitizan antes de mostrarse, copiarse o descargarse.
- Las diferencias de soporte de estilos entre familias de diagramas Mermaid se documentarán como parte del MVP.

## Documentación

- [Definición de producto](PRODUCT.md)
- [MVP y criterios de aceptación](MVP.md)
- [Especificación técnica](SPEC.md)
- [Identidad visual y diseño](DESIGN.md)
- [Backlog](BACKLOG.md)
- [Plan de implementación](PLAN.md)
- [Avisos de terceros](THIRD_PARTY_NOTICES.md)

## Licencia

Mermaid Styler utiliza [Mermaid](https://github.com/mermaid-js/mermaid), que se
distribuye bajo licencia MIT. El texto de esa licencia está disponible en
[`LICENSES/MERMAID-MIT.txt`](LICENSES/MERMAID-MIT.txt).

Mermaid Styler es un proyecto independiente y no es un producto oficial de
Mermaid. Las licencias de Mermaid, Astro, fuentes, iconos y demás dependencias
deben mantenerse revisadas en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
antes del primer release público.

## Git flow

El trabajo se organiza en ramas con prefijo `feature/` y commits pequeños que
representan una unidad de cambio. La rama `main` debe mantenerse desplegable.
