# 002 — Transición de mes direccional y cifras que cambian con suavidad

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Cohesion
- **Estimated scope**: `www/app.js` (~40 líneas), `www/styles.css` (~20 líneas)

## Problem

Al cambiar de mes, toda la tarjeta de saldo parpadea con un `opacity 0.4 → 1` y la curva débil `ease-out` nativa; no indica hacia dónde se navegó. Cuando un número cambia (guardar un gasto, cambiar de mes) el texto se reemplaza de golpe.

```js
/* www/app.js:1100 — actual */
if (!reduceMotion.matches) {
  $("balance-card").animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
}
```

## Target

- **Etiqueta del mes**: con WAAPI, entra desde `translateX(±12px)` y `opacity 0` en 200 ms `cubic-bezier(0.23, 1, 0.32, 1)`. `+12px` al ir hacia atrás (viene de la izquierda) y `-12px`... la dirección sigue a la flecha pulsada: a la anterior entra desde la izquierda (`-12px → 0`), a la siguiente desde la derecha (`12px → 0`).
- **Cifras** (`#total-balance`, `#total-incomes`, `#total-expenses`, `.allowance-value`): helper `setAnimatedText(el, text)`. Si el texto cambia y no hay movimiento reducido, anima `opacity 0 → 1`, `translateY(6px) → 0` y `filter: blur(2px) → blur(0)` en 220 ms con `cubic-bezier(0.23, 1, 0.32, 1)`. El desenfoque de 2 px disimula el cruce entre las dos cifras. Con movimiento reducido: solo `opacity 0.5 → 1` en 150 ms.
- Se borra el parpadeo de toda la tarjeta.

## Repo conventions to follow

- WAAPI ya se usa en `changeMonth` (`www/app.js:1094`); `reduceMotion` está en `www/app.js:85`.

## Steps

1. Añadir `setAnimatedText(el, text)` junto a las utilidades de render.
2. En `renderDashboard` usar `setAnimatedText` para saldo, ingresos y gastos; en `renderAllowance` para el valor.
3. En `changeMonth(delta)`: tras `render()`, animar `#month-label` según `delta`; quitar el parpadeo de `balance-card`.

## Boundaries

- No animar el primer render (si el texto anterior es el placeholder `$ 0` o está vacío, sin animación). No tocar gráficos ni listas.

## Verification

- **Mechanical**: `node --check www/app.js`.
- **Feel check**: tocar ‹ y › varias veces seguidas. El mes entra desde el lado correcto, las cifras se cruzan sin parpadear la tarjeta, y spamear no acumula saltos (WAAPI cancela la animación previa). Revisar al 10% en el panel Animations.
- **Done when**: no queda ningún `opacity: 0.4` en `changeMonth` y las cuatro cifras usan el helper.
