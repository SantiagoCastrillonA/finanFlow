# 001 — Cerrar hojas por velocidad y con salida proporcional al gesto

- **Status**: DONE
- **Commit**: 20d9993 (con cambios sin commit de la v0.2.1 en `www/app.js`)
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 1 archivo JS (~25 líneas), 1 archivo CSS (~3 líneas)

## Problem

El gesto de arrastrar para cerrar las hojas exige 0.5 px/ms para cerrar por velocidad, así que un deslizón corto y normal la devuelve arriba. Al soltar, siempre anima 250 ms aunque el dedo venga rápido: la hoja "frena" en vez de seguir el impulso. La resistencia hacia arriba es lineal (`dy * 0.3`).

```js
/* www/app.js:501 — actual */
sheet.style.transform = `translateY(${dy > 0 ? dy : dy * 0.3}px)`;
/* www/app.js:515 — actual */
if (dy > sheet.offsetHeight * 0.25 || velocity > 0.5) {
```

## Target

- Cerrar si `dy > 25%` de la altura **o** la velocidad hacia abajo supera **0.11 px/ms** (con `dy > 10`, para que un toque no la cierre).
- La velocidad se suaviza: `velocity = 0.8 * instantánea + 0.2 * anterior`.
- Salida con duración proporcional: `ms = clamp(distanciaRestante / max(velocity, 0.5), 150, 300)`, aplicada como `transition-duration` en línea antes de quitar `.open`, con la curva `var(--ease-drawer)`; se limpia en `transitionend`.
- Resistencia hacia arriba creciente: `-(1 - 1 / (1 + |dy| / 120)) * 60` px (máximo ~60 px).
- Volver a su sitio sin cerrar: 250 ms `var(--ease-drawer)` (la transición CSS actual).

## Repo conventions to follow

- Curvas en `:root` de `www/styles.css`: `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);`
- `closeModal(id)` (`www/app.js:424`) quita `.open` y limpia `style.transform`.

## Steps

1. En `setupSheetGesture` (`www/app.js:454`): guardar `velocity` suavizada; aplicar la resistencia creciente para `dy < 0`.
2. En `end()`: calcular `shouldClose`; si cierra, `sheet.style.transitionDuration = ms + "ms"`, llamar `closeModal`, y en `transitionend` (o `setTimeout(ms + 50)`) limpiar `transitionDuration`.
3. En `closeModal`, no tocar la duración (la hoja usa la en línea si existe).

## Boundaries

- No cambiar el marcado ni otras hojas o diálogos. No añadir dependencias.

## Verification

- **Mechanical**: `node --check www/app.js` sin errores.
- **Feel check** (DevTools en modo táctil o dispositivo real):
  - Un deslizón corto y rápido cierra la hoja; arrastrar lento menos de 25% y soltar la devuelve.
  - Un deslizón rápido sale en ~150 ms; uno lento cerca del umbral, en ~300 ms.
  - Arrastrar hacia arriba ofrece cada vez más resistencia y nunca pasa de ~60 px.
- **Done when**: los tres comportamientos se cumplen en el celular.
