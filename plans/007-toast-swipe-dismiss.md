# 007 — Deslizar un aviso hacia abajo para cerrarlo

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: LOW
- **Category**: Missed opportunities / Interruptibility
- **Estimated scope**: `www/app.js` (~30 líneas), `www/styles.css` (~4 líneas)

## Problem

Los avisos (`showToast`, `www/app.js:365`) solo desaparecen por tiempo; un aviso de 5 s con "Deshacer" tapa contenido y no se puede apartar.

## Target

- Pointer events en cada `.toast`: seguir al dedo solo hacia abajo (`translateY(dy)`, `opacity = 1 - dy/120`), con resistencia hacia arriba `dy * 0.2`.
- Cerrar si `dy > 40` o velocidad > 0.11 px/ms: sale por el mismo camino (abajo) con la transición existente (`translateY(100%)`, 200 ms).
- Si no, vuelve con 200 ms `var(--ease-out)`.
- Mientras se arrastra, se pausa el temporizador; al soltar sin cerrar, se reanuda con el tiempo restante.
- `.toast.dragging { transition: none; }` y `touch-action: none` en el aviso. El botón "Deshacer" sigue funcionando (ignorar el gesto si `dy < 6`).

## Repo conventions to follow

- Mismo modelo que `setupSheetGesture` (umbral de distancia o velocidad).

## Steps

1. En `showToast`, tras crear el aviso, añadir los listeners `pointerdown/move/up/cancel` con `setPointerCapture`.
2. Refactorizar `dismiss` para aceptar el estado arrastrado (limpiar `style.transform` y `opacity` en línea antes de quitar `.show`).
3. CSS: `.toast { touch-action: none; }`, `.toast.dragging { transition: none; }`.

## Boundaries

- No cambiar duraciones por defecto ni el apilado.

## Verification

- **Feel check**: mostrar un aviso con Deshacer (borrar un movimiento). Arrastrarlo poco y soltar → vuelve. Deslizarlo rápido hacia abajo → desaparece. Tocar "Deshacer" sigue restaurando.
- **Done when**: los tres casos funcionan con dedo y con mouse.
