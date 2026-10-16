# 008 — Layout para tablet (Lenovo Tab M11) y celular en horizontal

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: HIGH
- **Category**: Layout (fuera del catálogo de animación; pedido por el usuario)
- **Estimated scope**: `www/styles.css` (~150 líneas), `www/index.html` (~10 líneas), `www/app.js` (~10 líneas), `www/manifest.json` (1 línea)

## Problem

```css
/* www/styles.css:140 — actual */
.app { position: fixed; inset: 0; max-width: 520px; margin: 0 auto; }
@media (min-width: 560px) { .app { inset: 24px 0; border-radius: 32px; border: 1px solid var(--separator); } }
```
En la Tab M11 (viewport ≈ 800×1280 vertical, 1280×800 horizontal) la app es una columna de celular de 520 px con un marco y márgenes negros enormes (comprobado a 1280×800). En un celular horizontal (≈ 850×390) el título de 34 px, el selector de mes y la barra de 56 px dejan ~250 px de contenido. `www/manifest.json` fija `"orientation": "portrait"` para la PWA.

## Target

**Tablet o ventana ancha (`min-width: 900px`) — estilo iPad con barra lateral:**
- `.app` ocupa toda la pantalla (`max-width: none; inset: 0; border: 0; border-radius: 0`) con `display: grid; grid-template-columns: 260px 1fr`.
- `.tab-bar` pasa a ser una barra lateral: posición estática, columna 1 a toda la altura, `flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 4px; padding: calc(16px + var(--safe-top)) 12px 16px; border-top: 0; border-right: 0.5px solid var(--separator); background: var(--card)` (sin desenfoque). Cada `.nav-item` es una fila: ícono + texto en horizontal, `height: 44px; padding: 0 12px; border-radius: 10px; justify-content: flex-start; gap: 12px; flex: none`; activa con `background: var(--accent-tint)`. El "+" va primero en la barra lateral como botón ancho "Nuevo movimiento" (`order: -1`, `width: 100%`, `border-radius: 12px`, `height: 44px`, texto visible con `.nav-add-label`).
- Encabezado y contenido en la columna 2; `.app-content` centrado con `max-width: 980px` y padding inferior normal (ya no hay barra abajo).
- **Inicio en dos columnas** (`#tab-dashboard` con `display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 0 16px; align-items: start`): selector de mes, saldo y alertas a la izquierda; gráficos a la derecha; Recientes a todo el ancho. Clases nuevas en `index.html`: `.dash-col-left` y `.dash-col-right`, y `.dash-full` para Recientes.
- **Historial, Límites y Ajustes**: `max-width: 720px; margin: 0 auto`.
- **Hojas → ventanas tipo iPad**: `.modal` centra (`align-items: center`); `.sheet` con `width: min(560px, 100% - 48px)`, `border-radius: 16px`, `max-height: min(760px, 100% - 48px)` y entrada `opacity 0 + translateY(24px) + scale(0.98)` → reposo en 300 ms `var(--ease-out)` (salida 200 ms). La manija `.sheet-handle` se oculta. `.sheet.tall` usa `height: min(760px, 100% - 48px)`.
- Toasts: `left: calc(50% + 130px)` para centrarse en el área de contenido.
- Gráficos: `.chart-wrapper` 240 px, `.trend` 200 px.

**Tablet vertical (`min-width: 700px` y `max-width: 899px`):**
- `.app` a pantalla completa sin marco (`max-width: none; inset: 0; border-radius: 0; border: 0`); barra inferior normal.
- `.app-content` y `.app-header` con `max-width: 720px; margin: 0 auto; width: 100%`.
- Las dos tarjetas de gráficos lado a lado (`.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }`).
- Hojas como en tablet horizontal (ventana centrada).

**Celular horizontal (`orientation: landscape` y `max-height: 500px`):**
- `.large-title` 22 px; `.app-header` con padding `calc(6px + var(--safe-top)) max(var(--gutter), env(safe-area-inset-left)) 4px`.
- `--tab-h: 48px`; `.nav-label` oculto; `.nav-add` 40 px.
- `.balance-amount` 32 px; `.chart-wrapper` 170 px; `.trend` 150 px.
- Hojas: `max-height: calc(100% - 8px)`; `.amount-field input` 36 px; `.category-grid` con `minmax(64px, 1fr)`.
- Respetar notch lateral: `padding-left/right: max(var(--gutter), env(safe-area-inset-left/right))` en `.app-content`.

**Otros:**
- Quitar el marco de escritorio de 560 px (lo sustituyen las reglas de tablet).
- `www/manifest.json`: `"orientation": "any"`.
- `www/app.js`: Chart.js ya es `responsive`; tras cambiar de orientación, nada más. El gesto de arrastrar la hoja se desactiva en ventanas centradas (`window.matchMedia("(min-width: 700px)")` → no iniciar el arrastre).

## Repo conventions to follow

- Tokens en `:root` (`--gutter`, `--tab-h`, `--radius`, curvas). Todo el CSS va en `www/styles.css`; los media queries de layout se agrupan en una sección nueva "Tablet y horizontal" antes del bloque de movimiento reducido.

## Steps

1. `index.html`: envolver los bloques del Inicio en `.dash-col-left` / `.dash-col-right` / `.dash-full`, envolver las dos tarjetas de gráficos en `.chart-row`, añadir `<span class="nav-add-label">Nuevo movimiento</span>` dentro de `.nav-add`.
2. `styles.css`: quitar la regla `@media (min-width: 560px)`, ocultar `.nav-add-label` por defecto y añadir la sección con los tres media queries.
3. `app.js`: en `setupSheetGesture`, salir si `matchMedia("(min-width: 700px)").matches`.
4. `manifest.json`: `"orientation": "any"`.

## Boundaries

- No cambiar la lógica, solo layout. En celular vertical todo debe verse exactamente igual que antes.

## Verification

- **Mechanical**: `node --check www/app.js`.
- **Visual** en el navegador integrado: 375×812 (igual que antes), 812×375 (horizontal compacto), 800×1280 (tablet vertical, contenido centrado, gráficos lado a lado), 1280×800 (barra lateral, Inicio en dos columnas, hojas centradas).
- **Feel check**: en tablet, abrir "Nuevo movimiento": la ventana aparece centrada con un fundido y un pequeño desplazamiento. Girar la tablet con la hoja abierta: se reacomoda sin cerrarse.
- **Done when**: los cuatro tamaños se ven bien y la Tab M11 rota libremente.
