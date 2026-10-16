## Resumen

<!-- Qué cambia y por qué. Enlaza el ID de auditoría (AUD-0XX). -->

## Checklist

- [ ] ID AUD referenciado (`AUD-0XX`) en el título o la descripción
- [ ] Fixture/test que falla antes del cambio y pasa después
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e`
- [ ] Cross-browser (`npm run test:e2e:cross-browser`) si toca render/export
- [ ] Delta de `npm run check:bundle` anotado
- [ ] `docker build` + `npm run check:deployment` si toca deploy
- [ ] Sin `innerHTML` nuevo en `src/`
- [ ] `src/i18n/messages.en.ts` actualizado si hay copy nuevo
- [ ] `AUDIT.md` actualizado
