# 005 — Tokens de duración, presión uniforme, desenfoque más ligero e interruptor elástico

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: LOW
- **Category**: Cohesion & tokens / Performance / Missed opportunities
- **Estimated scope**: `www/styles.css` (~40 líneas)

## Problem

1. Duraciones escritas a mano en todo el archivo (100, 120, 150, 200, 250, 350, 500, 900 ms).
2. Escalas de presión dispares: `.icon-btn:active { transform: scale(0.94) }` (`www/styles.css:283`), `.nav-add:active { scale(0.92) }` (`:1176`), `.send-btn:active { scale(0.92) }` (`:1625`), `.cat-btn:active { scale(0.95) }`, botones `scale(0.97)`. La guía es 0.95–0.98.
3. Presión simétrica: entra y sale en 120 ms; la salida (soltar) debería ser más lenta para sentirse elástica.
4. `.tab-bar` usa `blur(20px)` persistente sobre contenido que hace scroll (`:1121`): costoso en GPUs de gama media (Lenovo Tab M11).
5. El interruptor no reacciona a la presión (iOS estira la perilla al presionar).

## Target

```css
:root {
  --dur-press: 100ms;   /* al presionar */
  --dur-release: 200ms; /* al soltar */
  --dur-ui: 200ms;
  --dur-sheet: 350ms;
}
```
- Botones de texto/primarios: `scale(0.97)`; botones circulares (`.icon-btn`, `.nav-add`, `.send-btn`) y `.cat-btn`: `scale(0.95)`.
- Patrón asimétrico: regla base `transition: transform var(--dur-release) var(--ease-out)`, y en `:active` `transition-duration: var(--dur-press)`.
- `.tab-bar`: `saturate(180%) blur(12px)`.
- `.switch:active::before { width: 33px; }` y `.switch:checked:active::before { transform: translateX(14px); }` con `transition: transform 200ms var(--ease-out), width 200ms var(--ease-out)` (único caso tolerado de animar `width`: 6 px en un pseudo-elemento de 27 px; no provoca reflow de otros elementos porque está en posición absoluta).

## Repo conventions to follow

- Curvas en `:root` (`--ease-out`, `--ease-in-out`, `--ease-drawer`). Añadir los `--dur-*` junto a ellas.

## Steps

1. Añadir los tokens a `:root`.
2. Unificar escalas y el patrón de presión asimétrica en `.icon-btn`, `.btn-primary`, `.btn-tinted`, `.nav-add`, `.send-btn`, `.cat-btn`.
3. Cambiar el desenfoque de `.tab-bar`.
4. Añadir el estiramiento del interruptor.
5. Sustituir duraciones literales equivalentes por los tokens donde coincidan (200 → `--dur-ui`, 350 → `--dur-sheet`).

## Boundaries

- No cambiar curvas ni la apariencia en reposo.

## Verification

- **Feel check**: presionar y mantener el "+", un ícono y "Guardar": se hunden rápido (100 ms) y vuelven más despacio (200 ms). Presionar un interruptor: la perilla se estira hacia el lado al que va. Hacer scroll rápido en Inicio en la tablet: sin tirones bajo la barra.
- **Done when**: no queda ninguna escala de presión fuera de 0.95/0.97.
