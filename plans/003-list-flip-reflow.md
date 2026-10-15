# 003 — Reacomodo FLIP de las listas al agregar y borrar

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: MEDIUM
- **Category**: Missed opportunities (spatial consistency)
- **Estimated scope**: `www/app.js` (~35 líneas)

## Problem

Al borrar un movimiento, su fila se desvanece (`.is-removing`, 150 ms), pero después `render()` reconstruye la lista y las filas de abajo **saltan** a su nueva posición. Al agregar pasa lo mismo: la fila nueva entra animada (`.is-new`), pero las demás se desplazan de golpe.

```js
/* www/app.js:1220 — deleteTransaction: anima la fila y luego re-renderiza todo */
document.querySelectorAll(`.tx-row[data-id="${CSS.escape(id)}"]`).forEach((r) => r.classList.add("is-removing"));
```

## Target

Técnica FLIP con WAAPI:
- `captureRowPositions()` → `Map<id, top>` de cada `.tx-row[data-id]` visible (`getBoundingClientRect().top`) en `#recent-transactions-list` y `#all-transactions-list`.
- `playRowFlip(before)` tras el render: para cada fila con el mismo `data-id` y `delta = antes - ahora ≠ 0` (|delta| < 400 px), `el.animate([{ transform: translateY(delta px) }, { transform: "none" }], { duration: 250, easing: "cubic-bezier(0.23, 1, 0.32, 1)" })`.
- Se envuelve el render en `commit()`: capturar antes de `render()` y reproducir después.
- Con movimiento reducido no se hace FLIP.

## Repo conventions to follow

- `commit()` (`www/app.js`, sección Estado) es el punto único tras un cambio de datos; `reduceMotion` está disponible.
- Las filas ya tienen `data-id` (`txRow`).

## Steps

1. Añadir `captureRowPositions` y `playRowFlip` en la sección Render.
2. En `commit()`: `const before = captureRowPositions(); … render(); playRowFlip(before);`.
3. Lo mismo en el callback del snapshot de Firestore (`onData` dentro de `syncWithFirestore`).

## Boundaries

- Solo filas `.tx-row`. Sin cambios de marcado ni CSS. No animar cuando cambia el filtro o la pestaña (solo pasa por `commit`/snapshot).

## Verification

- **Mechanical**: `node --check www/app.js`.
- **Feel check**: con 6+ movimientos, borrar el segundo: las filas inferiores suben deslizándose en 250 ms en vez de saltar. Agregar uno con fecha de hoy: las demás bajan suavemente mientras la nueva entra. Probar al 10%.
- **Done when**: no hay saltos visibles al agregar, borrar ni deshacer.
