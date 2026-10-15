# 004 — Movimiento reducido sin perder la retroalimentación

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: `www/styles.css` (~12 líneas)

## Problem

Con `prefers-reduced-motion`, el interruptor y el control segmentado cambian de golpe: se eliminó toda la transición, no solo el desplazamiento.

```css
/* www/styles.css:1743 — actual */
.seg-thumb,
.switch::before {
  transition-duration: 0ms;
}
```

## Target

Movimiento reducido significa menos y más suave, **no cero**:
- `.seg-thumb`: sin desplazamiento visible; el cambio se marca con un fundido. Se mantiene `transform` instantáneo y se añade `animation: seg-fade 150ms ease` al botón activo (`.segmented button.active { animation: … }` con `@keyframes seg-fade { from { opacity: .4 } }`).
- `.switch::before`: la perilla salta, pero el fondo del interruptor conserva `transition: background-color 150ms ease`.

## Repo conventions to follow

- Bloque `@media (prefers-reduced-motion: reduce)` al final de `www/styles.css` (línea 1721).

## Steps

1. Reemplazar la regla `transition-duration: 0ms` por: `.seg-thumb, .switch::before { transition: none; }` y `.switch { transition: background-color 150ms ease; }`.
2. Añadir `@keyframes seg-fade` y `.segmented button.active { animation: seg-fade 150ms ease; }` dentro del bloque reducido.

## Boundaries

- Solo el bloque de movimiento reducido.

## Verification

- **Feel check**: en DevTools → Rendering → "Emulate prefers-reduced-motion: reduce". El interruptor cambia de color con un fundido; el segmento activo aparece con fundido; nada se desliza.
- **Done when**: ninguna regla del bloque usa `transition-duration: 0ms`.
