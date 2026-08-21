# Mermaid Styler — Backlog

Estado: Fase 3 implementada. Las prioridades describen el orden recomendado
para el MVP, no una promesa de fechas. El siguiente corte es la Fase 4:
temas, presets y compatibilidad Mermaid.

## P0 — Camino principal del MVP

| ID | Épica | Trabajo | Resultado esperado | Dependencias |
|---|---|---|---|---|
| MS-001 | Foundation | Crear proyecto Astro + TypeScript con salida estática | Proyecto ejecutable y construible | — |
| MS-002 | Foundation | Configurar linting, formato y tipos | Base consistente para contribuir | MS-001 |
| MS-003 | Render | Implementar `renderMermaid(source, options)` | Motor independiente de la UI | MS-001 |
| MS-004 | Render | Validar input y mapear errores Mermaid | Errores identificables para la interfaz | MS-003 |
| MS-005 | Editor | Crear editor de texto con ejemplo inicial | El usuario puede pegar y editar source | MS-001 |
| MS-006 | Preview | Conectar editor y motor con debounce | Preview automático sin renders obsoletos | MS-003, MS-005 |
| MS-007 | Theme | Definir modelo de opciones y variables Mermaid | Estilos reproducibles entre renders | MS-003 |
| MS-008 | Theme | Implementar presets Light, Dark, Terminal, Paper y Architecture | Cambio de estilo en una acción | MS-007 |
| MS-009 | Theme | Implementar controles de color y tipografía | Ajuste visual directo sobre el preview | MS-007, MS-008 |
| MS-010 | Theme | Implementar transparencia | Preview y exportación sin fondo opaco | MS-007 |
| MS-011 | Export | Descargar SVG sanitizado | SVG utilizable fuera de la aplicación | MS-003, MS-007 |
| MS-012 | Export | Convertir SVG a PNG con canvas escalado | PNG nítido y sin recortes | MS-011 |
| MS-013 | Clipboard | Copiar SVG como texto | SVG disponible en el portapapeles | MS-011 |
| MS-014 | Clipboard | Copiar PNG como imagen con fallback | Imagen disponible donde el navegador lo soporte | MS-012 |
| MS-015 | Safety | Limitar input, sanitizar SVG y bloquear comportamiento activo | Frontera de seguridad documentada | MS-003, MS-011 |
| MS-016 | UX | Diseñar estados vacío, renderizando, válido e inválido | El sistema comunica qué está pasando | MS-004, MS-006 |
| MS-017 | Responsive | Adaptar editor, preview, rail de estilos y acciones a móvil | Flujo completo usable en móvil | MS-005, MS-009 |
| MS-018 | Accessibility | Añadir labels, foco, teclado, contraste y reduced motion | Interfaz operable y legible | MS-016, MS-017 |
| MS-033 | Design system | Crear tokens primitivos, semánticos y de componente en una única fuente | No hay valores visuales mágicos dispersos | MS-001 |
| MS-034 | Components | Extraer botones, campos, estados, editor, stage y rail en componentes reutilizables | No hay patrones visuales duplicados | MS-033, MS-005 |
| MS-035 | i18n | Crear catálogo de mensajes con claves estables y fallback | El copy puede traducirse sin tocar la lógica | MS-034 |
| MS-036 | Typography | Servir fuentes limitadas/locales con `font-display` y fallbacks | La interfaz funciona sin CDN y sin cargar pesos innecesarios | MS-033 |
| MS-037 | Performance | Implementar coordinador de render latest-wins | Como máximo hay un render activo y uno pendiente | MS-006 |
| MS-038 | Performance | Limpiar DOM auxiliar, listeners, canvas y object URLs | Los renders repetidos no acumulan recursos | MS-012, MS-037 |
| MS-039 | Performance | Añadir límite de source y watchdog de render | Diagramas extremos no congelan la interfaz | MS-004, MS-037 |

## P1 — Calidad de lanzamiento

| ID | Épica | Trabajo | Resultado esperado | Dependencias |
|---|---|---|---|---|
| MS-019 | QA | Crear matriz de diagramas flowchart, sequence, class, state y ER | Se conocen las diferencias de themeVariables | MS-008 |
| MS-020 | QA | Probar exportación con diagramas grandes, largos y transparentes | Se reducen recortes y PNG defectuosos | MS-011, MS-012 |
| MS-021 | QA | Probar navegadores modernos de desktop y móvil | Limitaciones documentadas | MS-014, MS-017 |
| MS-022 | Privacy | Verificar requests y ausencia de persistencia | El comportamiento local está comprobado | MS-015 |
| MS-023 | Docs | Escribir README de ejecución, build y despliegue | Otra persona puede levantar el proyecto | MS-001, MS-018 |
| MS-024 | Docs | Documentar límites de estilos por tipo de diagrama | Expectativas del usuario son realistas | MS-019 |
| MS-025 | Release | Configurar Dokploy para servir el build estático y publicar una demo | La comunidad puede probar la herramienta en el destino elegido | MS-023 |
| MS-026 | Release | Añadir guía de contribución e issues | El proyecto puede recibir mejoras | MS-023, MS-025 |
| MS-040 | QA | Ejecutar prueba de 20 renders consecutivos y revisar memoria/DOM | Se verifica ausencia de crecimiento sostenido | MS-037, MS-038, MS-039 |
| MS-041 | QA | Probar copy con expansión 30–40%, caracteres Unicode y RTL | La futura traducción no rompe el layout | MS-035, MS-034 |
| MS-042 | QA | Auditar bundle, listeners, object URLs y requests | El presupuesto de recursos queda medido | MS-036, MS-038 |
| MS-043 | QA | Crear matriz por familia Mermaid y documentar variables parciales | Los controles no prometen compatibilidad universal | MS-019, MS-024 |
| MS-044 | Performance | Probar diagramas grandes, source con Unicode y texto largo | Los límites y watchdog degradan de forma controlada | MS-039 |
| MS-045 | Security | Probar sanitización con `foreignObject`, enlaces, IDs y SVG activo | El export conserva lo necesario sin contenido ejecutable | MS-015, MS-011 |
| MS-046 | Clipboard | Probar copy SVG/PNG en navegadores desktop y móvil | Cada navegador tiene fallback documentado | MS-013, MS-014, MS-021 |
| MS-047 | Privacy | Auditar Network, analytics, fuentes y recursos externos | Se confirma que el source permanece local | MS-022 |
| MS-048 | Persistence | Probar restauración automática de formularios tras recarga | La promesa de pérdida de contenido se cumple | MS-022 |
| MS-049 | Accessibility | Añadir nombre, descripción y source alternativo al export | El diagrama no depende solo de la imagen | MS-018, MS-011 |
| MS-050 | Legal | Revisar licencias de Mermaid, fuentes, iconos y dependencias | La publicación comunitaria tiene atribuciones correctas | MS-023 |
| MS-051 | Typography | Comparar fuentes seguras frente a subset embebido en SVG | Se decide el equilibrio entre fidelidad y peso | MS-036, MS-011 |
| MS-052 | Deploy | Documentar build, output, puerto y health check de Dokploy | El despliegue es reproducible y estático | MS-025 |

## P2 — Después del MVP

| ID | Épica | Trabajo | Resultado esperado |
|---|---|---|---|
| MS-027 | Offline | Convertir la herramienta en PWA opcional | Uso repetido con menor dependencia de red |
| MS-028 | Share | Crear URLs de estado no persistentes o exportables | Compartir una configuración sin servidor propio |
| MS-029 | API | Evaluar endpoint stateless `POST /render` separado del sitio | Integración con agentes y automatizaciones |
| MS-030 | API | Añadir límites, timeout y sanitización server-side si se aprueba el endpoint | Servicio remoto seguro y sin almacenamiento |
| MS-031 | Presets | Permitir exportar/importar presets locales como JSON | Reutilización manual sin base de datos |
| MS-032 | Diagrams | Ampliar cobertura de tipos y variables por diagrama | Estilos más predecibles en Mermaid avanzado |

## Decisiones de priorización

- El camino paste → render → style → export tiene prioridad absoluta.
- El endpoint no debe retrasar el sitio estático.
- Los controles se consideran terminados solo si sus límites se explican cuando Mermaid no los aplica uniformemente.
- El acabado de SVG y PNG es una característica principal, no una tarea secundaria.
- No se añade persistencia para resolver problemas de comodidad que contradigan la promesa de privacidad.
- La compatibilidad se declara con honestidad por tipo de diagrama y navegador.
- La privacidad se verifica observando la red, no solo leyendo el código.
- Dokploy sirve el artefacto estático; no se introduce backend por conveniencia de despliegue.
