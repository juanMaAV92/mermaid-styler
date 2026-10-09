# Mermaid Styler

<div align="center">

### De código Mermaid generado por IA a un diagrama listo para compartir.

Herramienta local-first para pegar Mermaid, visualizarlo, aplicar estilo y exportar
un artefacto presentable para Jira, documentación, presentaciones o pull requests.

<img alt="Status: MVP deployed" src="https://img.shields.io/badge/status-MVP%20deployed-2EA44F.svg">
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

## Demo pública

[Abrir Mermaid Styler](https://mermaid-styler.duckdns.org/)

## Estado del proyecto

**MVP desplegado en producción.** El render Mermaid local, los estilos, zoom/pan,
sanitización, exportación SVG/PNG, clipboard y navegación responsive están
implementados y validados. La aplicación está publicada como sitio estático en
Dokploy.

## Alcance del MVP

- Editor para pegar y editar código Mermaid.
- Preview renderizado en el navegador con la librería oficial de Mermaid.
- Presets Light, Dark, Terminal, Paper y Architecture.
- Controles para fondo, cajas, bordes, texto, líneas, énfasis, tipografía, tamaño y transparencia.
- Descarga de SVG y PNG.
- Copiar SVG y copiar la imagen cuando el navegador lo permita.
- SVG con título y descripción accesibles; el source Mermaid solo se incluye si se activa explícitamente antes de exportar.
- Mensajes claros para código inválido, límites de entrada y timeouts.
- Renderizado local, cola de renders latest-wins y límites de recursos para evitar trabajo acumulado.
- Exportación PNG con presupuesto de memoria adaptativo y aviso si se reduce la resolución.
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
| Build | Railpack · salida estática en `dist/` |
| Deploy | Dokploy · HTTPS con Let’s Encrypt |

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

- Node.js `>=22.19.0` (baseline de Astro y sus dependencias; ver `.nvmrc`).
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
npm run test       # unitarias + E2E en Chromium sobre dist/
npm run test:e2e:cross-browser # smoke E2E en Firefox y WebKit (tras instalarlos)
npm run check:bundle # presupuesto de JavaScript generado
```

## QA automatizado

La suite cubre renderizado de flowchart, sequence, class, state y ER; PNG con
Unicode, etiquetas largas y transparencia; clipboard; navegación del preview; y
20 renders consecutivos con verificación de DOM, SVG y canvas temporales. Las
E2E sirven el directorio `dist/` en un puerto aislado, por lo que no reutilizan
ni validan accidentalmente un servidor de desarrollo local.

```bash
npm run typecheck
npm run test
npm run test:e2e:cross-browser
npm run build
npm run check:bundle
```

GitHub Actions valida cada cambio a `main` con Chromium, presupuesto de bundle
y un smoke test en Firefox y WebKit. También se revisaron en producción los
diagramas principales, errores de sintaxis, exportaciones, clipboard, navegación,
responsive y compatibilidad manual en los dispositivos disponibles.

## Despliegue en Dokploy

Mermaid Styler se publica como sitio estático. El build produce el directorio
`dist/`, que Dokploy sirve detrás de Traefik.

La configuración reproducible está en `Dockerfile` y `deploy/nginx.conf`.
Para adoptarla en Dokploy:

```bash
# Build Type: Dockerfile
# Dockerfile: Dockerfile
# Build Path: /
# Domain port: 80
# Health check: GET /healthz
```

El despliegue existente usa Railpack hasta cambiar el Build Type en Dokploy.
La imagen nueva incluye headers CSP, caché y Nginx; publica únicamente `dist/`.
Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para migración, validación y rollback.

El repositorio `main` está conectado a Dokploy con despliegue automático por push.
La demo pública utiliza HTTPS gestionado por Let’s Encrypt.

## Privacidad y límites

- El código Mermaid permanece en el navegador durante el flujo normal.
- La aplicación no crea cuentas ni almacena diagramas después de recargar.
- La primera versión no incluye backend ni endpoint remoto.
- El renderizado se limita a una operación activa y un render pendiente como máximo.
- El input se limita a 50.000 caracteres, 2.000 líneas y 1.200 conexiones estimadas para proteger el navegador.
- Los SVG se sanitizan antes de mostrarse, copiarse o descargarse.
- El source Mermaid no se incrusta en SVG por defecto; activar la opción de exportación solo si compartir el código es seguro.
- El PNG ajusta su presupuesto de píxeles según la memoria disponible del navegador para proteger dispositivos con menos recursos.
- Las diferencias de soporte de estilos entre familias de diagramas Mermaid se documentarán como parte del MVP.

## Documentación

- [Definición de producto](PRODUCT.md)
- [MVP y criterios de aceptación](MVP.md)
- [Especificación técnica](SPEC.md)
- [Identidad visual y diseño](DESIGN.md)
- [Backlog](BACKLOG.md)
- [Plan de implementación](PLAN.md)
- [Avisos de terceros](THIRD_PARTY_NOTICES.md)
- [Auditoría técnica](AUDIT.md)
- [Despliegue reproducible](DEPLOYMENT.md)
- [Contribuciones](CONTRIBUTING.md)
- [Reportes de seguridad](SECURITY.md)

## Licencia

El código propio de Mermaid Styler se distribuye bajo [MIT](LICENSE).

Mermaid Styler utiliza [Mermaid](https://github.com/mermaid-js/mermaid), que se
distribuye bajo licencia MIT. El texto de esa licencia está disponible en
[`LICENSES/MERMAID-MIT.txt`](LICENSES/MERMAID-MIT.txt).

Mermaid Styler es un proyecto independiente y no es un producto oficial de
Mermaid. Las licencias de Mermaid, Astro, fuentes, iconos y demás dependencias
se mantienen documentadas en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Git flow

El trabajo se organiza en ramas con prefijo `feature/` y commits pequeños que
representan una unidad de cambio. La rama `main` debe mantenerse desplegable.
