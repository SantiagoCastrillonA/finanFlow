# Hoja de ruta: identidad "Moneda de oro" (0.11 → 0.14)

Estado: **propuesto** (2026-10-16). Nada implementado todavía.
Base: versión 0.10.3 (commit `7ed4086`, publicada en finanflow-32cae.web.app).
Origen: revisión UI/UX hecha con el usuario. El usuario eligió el ícono **A1 · Moneda de oro**: una moneda dorada que se llena con una ola sobre fondo verde azulado.
Referencia visual: lienzo de diseño "FinanFlow · Rediseño" en claude.ai, con un tablero por pantalla. El usuario puede pasar capturas si hace falta.
Regla de trabajo: `AGENT.md` sigue mandando. Cada fase empieza con su propio **Plan de Acción Propuesto**, y no se escribe código hasta que el usuario lo apruebe. Si una fase es grande, se hace por pasos.
Restricción: costo $0 y sin conexión. No se usan CDNs, y las fuentes e íconos van locales en `www/vendor/`.

## Decisiones ya tomadas

- **Concepto de marca:** "dinero en calma". El dinero fluye como una corriente tranquila; la app ordena, no regaña.
- **Color de marca:** Marea, el verde azulado actual (`--accent`: #0E8A7E claro / #11A08F oscuro). **Se elimina todo el violeta** (#5E5CE6, #8E8CFF): era la marca anterior.
- **Segundo color de marca:** **Oro** (#F2B544, suave #FBE7B5). Se usa poco: ícono, metas de ahorro, logros y la "moneda que se llena". Nunca se usa para alertas, porque el ámbar `--warning` ya cumple esa función.
- **Semántica de colores (se mantiene):** ingresos en verde, gastos en azul suave `--spend`, y rojo `--expense` solo para deudas, saldo negativo y límites superados.
- **Vidrio con propósito** (elegido por el usuario en el mockup "Inicio · vidrio"): vidrio real (con `backdrop-filter`) solo en la tarjeta del saldo, que va sobre una moneda de oro grande de fondo, y en lo que flota: barra inferior, botón de FinanBot, hojas, avisos y barra de escribir de FinanBot. Las demás tarjetas son sólidas.
- **Paleta descartada: Wine Ash + Turquoise** (#32292F / #99E1D9). Se probó en el mockup "Inicio · oscuro Wine Ash + Turquoise" y el usuario prefirió la actual: tema oscuro #0A1414 con Marea y Oro. No usar esos colores.
- **Los colores de categorías no son marca.** `CATEGORIES`, `CATEGORY_COLORS` y los colores de las cuentas base se quedan como están.

## Resumen

| Fase | Versión | Contenido | Tamaño |
|---|---|---|---|
| A | 0.11.0 | Limpieza de color: fuera violeta, tokens Oro, interruptores, Límites por estado, saldo neutro | Pequeña · **Hecha** |
| A2 | 0.11.0 | Accesibilidad: contraste de tokens, tamaños táctiles, texto grande, gráficas | Pequeña · **Hecha** |
| B | 0.11.1 | Ícono Moneda de oro en Android, PWA, splash y notificación | Mediana · **Hecha** |
| C | 0.12.0 | Inicio: etiquetas, flechas, comparativa, alertas y neto | Mediana · **Hecha** |
| C2 | 0.12.0 | Vidrio: moneda de fondo, saldo en vidrio, barra inferior flotante | Mediana |
| D | 0.12.1 | Registrar movimiento: monto, un solo Guardar, fecha rápida, selección | Mediana |
| E | 0.13.0 | Tipografía propia (Manrope local) | Pequeña |
| F | 0.13.1 | Firma visual (moneda que se llena) y voz | Mediana |
| H | 0.13.2 | Onboarding de 3 pantallas | Mediana |
| I | 0.13.3 | Hogar compartido con la nueva marca | Mediana |
| J | 0.13.4 | Tablet: barra lateral y vidrio | Pequeña |
| K | 0.13.5 | Widget y notificaciones de Android | Pequeña |
| G | 0.14.0 | Mascota: **primero diseño con el usuario**, código después | Por definir |

Orden recomendado: A + A2 → B → C → C2 → D → E → F → H → I → J → K → G. Las fases A y B no dependen entre sí, y la F usa la geometría del ícono de la B. Cada fase sube la versión en los mismos sitios de siempre (`package.json`, `manifest.json`, `sw.js` `CACHE_NAME`, `README.md` y el texto de Ajustes en `index.html`), y en la B también `versionCode`.

---

## Fase A — Limpieza de color (0.11.0) — HECHA

**Problema.** Conviven tres marcas y quedan restos del violeta. La interfaz copia la paleta de Ajustes de iOS, y el mismo verde se usa para el saldo, los ingresos, la comparativa y los interruptores.

**Cambios:**

1. **Tokens nuevos** en `www/styles.css`, en ambos temas:
   - `--gold`: #F2B544 en claro, #F5C35B en oscuro.
   - `--gold-soft`: #FBE7B5 en claro, rgba(245, 195, 91, 0.18) en oscuro.
   - `--brand-icon-bg`: un tinte de Marea para los cuadros de Ajustes, que puede ser `var(--accent-tint)`.
2. **Interruptores:** en `.switch:checked`, cambiar `background: var(--income)` por `var(--accent)`.
3. **Avisos (toast):** en `.toast-info .toast-icon` y `.toast-action`, cambiar `#8E8CFF` por un token de acento con contraste ≥ 4.5:1 sobre el fondo del aviso en cada tema. Hay dos bloques `.toast`, uno por tema; en el oscuro probablemente haga falta un acento más claro, como #2ED3BE. Hay que comprobar el contraste.
4. **Cuadros de Ajustes** (`.setting-icon` con `style="background:#…"` en `index.html`, líneas ~257–417, y en `app.js` ~3576–3601 del Hogar):
   - Quitar los colores sueltos y dar a todos un solo estilo: ícono en `--accent` sobre `--accent-tint`. Mejor con una clase que con estilos en línea.
   - Excepciones: la fila de huella/bloqueo puede seguir igual, y lo destructivo sigue en rojo.
5. **Categoría nueva:** `NEW_CATEGORY_COLOR` (`app.js:72`) pasa de "#5E5CE6" a "#0E8A7E". El violeta sigue disponible en la paleta de categorías como opción del usuario.
6. **Saldo en neutro:** `.balance-amount.positive` usa `var(--text)`, no `--income`. `.negative` sigue en `--expense`.
7. **Límites por estado, no por categoría:** en `renderBudgetsList` (`app.js` ~1704–1724), `row.style.setProperty("--c", info.color)` pinta la barra con el color de la categoría. Por eso Compras (rosado) o Salud (rojo) parecen en peligro aunque vayan al 50%.
   - La barra debe usar el estado: `--accent` por debajo del 80%, `--warning` entre 80 y 100%, y `--expense` por encima del 100%.
   - El color de la categoría queda solo en su ícono, que necesitará su propia variable.
   - Un límite superado puede llevar además borde `--expense`.
8. **Metas de ahorro:** la barra de avance de las metas pasa a `--gold`. Es el primer uso del color Oro en la interfaz.

9. **Logos de marcas en las listas.** En Historial y Recientes, los logos de `brands.js` (DiDi, Netflix, Spotify…) salen con sus colores de marca y rompen la paleta. Mostrarlos sobre el mismo recuadro neutro de las categorías: logo monocromo en el color de texto, sobre `--fill`. Que sea una opción en Ajustes → Categorías si el usuario prefiere los colores originales.
10. **Avisos encima de las hojas.** Con una hoja abierta, el aviso se dibuja encima y tapa botones (pasó con "Nueva meta" en Cuentas y tarjetas). Con una hoja abierta, el aviso debe subir por encima del borde de la hoja o esperar a que se cierre.

**Impacto en datos financieros:** ninguno; solo presentación.

**Verificación:** `node --check www/app.js`. Revisar Inicio, Límites, Ajustes, Categorías y un aviso en ambos temas con `demo/finanflow-demo.json`. Con `grep -n "5E5CE6\|8E8CFF"` sobre `www/` solo deben quedar apariciones en la paleta de categorías (`CATEGORY_COLORS`, la categoría base Suscripciones y Nequi/Daviplata).

---

## Fase A2 — Accesibilidad (0.11.0, junto con A) — HECHA

> Pendiente: probar en el teléfono con la letra del sistema en "Muy grande" (punto 2 de "Otros puntos") y, si hace falta, aplicar `textZoom` en `MainActivity`. Tampoco se probó con TalkBack.

Auditoría hecha sobre los tokens de `styles.css` 0.10.3 (WCAG 2.1 AA: texto normal ≥ 4.5:1, texto grande ≥ 3:1).

**Contraste medido hoy:**

| Par | Contraste | Estado |
|---|---|---|
| `--text-secondary` claro (rgba(60,60,67,.6)) sobre `--bg` / tarjeta | 3,3 / 3,4 | Falla: se usa en casi todos los textos de 13 px |
| `--text-tertiary` claro sobre tarjeta | 1,7 | Falla: se usa como texto en `.chart-empty`, `.row-badge`, `.app-version`, `.dialog-note` y en el 0 del monto |
| `--text-tertiary` oscuro sobre tarjeta | 2,5 | Falla en los mismos sitios |
| `--accent` claro #0E8A7E sobre blanco / `--bg` | 4,2 / 3,8 | Falla para enlaces de 17 px no negrita ("Resumen del año", "Ver todo") |
| Blanco sobre `--accent` (botones) | 4,2 claro / 3,3 oscuro | Falla: el texto de 17 px en negrita no cuenta como "grande" |
| `--income` claro #16A34A sobre blanco | 3,3 | Falla |
| `--warning` claro #D97706 sobre blanco | 3,2 | Falla |
| `--expense` claro sobre `--bg` | 4,2 | Falla fuera de tarjetas (en tarjeta blanca da 4,7) |
| Aviso: #8E8CFF sobre blanco (tema claro) | 2,9 | Falla (se elimina en la Fase A) |
| `--text-secondary`, `--income`, `--spend`, `--expense` en oscuro | 5,9–9,5 | OK |

**Cambios de tokens** (todos ya verificados):

- **Tema claro:**
  - `--text-secondary`: #556664 (5,4 sobre `--bg`, 6,0 sobre blanco).
  - `--text-tertiary` solo para íconos decorativos y chevrones. Donde hoy es texto, pasar a `--text-secondary`.
  - Nuevo `--accent-strong`: #0B766C (5,5 sobre blanco) para enlaces y para el fondo de los botones primarios con texto blanco. `--accent` #0E8A7E se queda para íconos, rellenos e indicadores.
  - `--income`: #15803D (5,0 sobre blanco).
  - Texto de advertencia: #B45309 (5,0); la barra puede seguir en #D97706.
- **Tema oscuro:**
  - Botones primarios con texto oscuro #0B1F1D sobre #11A08F (5,3), o texto blanco sobre #0B766C.
  - Enlaces en #3FD6C2 (9,2 sobre tarjeta).
  - `--text-tertiary` solo decorativo, igual que en claro.

**Otros puntos:**

1. **Tamaños táctiles.**
   - `.icon-btn` mide 40 px: debe ser ≥ 44 px (Android recomienda 48 dp). Puede quedar visualmente en 40 px si se amplía el área táctil con un `::before` transparente.
   - Las pastillas (`min-height: 34px`) también necesitan área de 44 px.
2. **Texto grande del sistema.**
   - Todo el CSS usa `px` (ningún `rem`). Comprobar en Android con la letra del sistema en "Muy grande": hay que ver si el WebView de Capacitor escala el texto (`textZoom`) y si algo se corta, en especial el saldo de 40 px, las filas con montos largos y la barra inferior.
   - Si no escala, aplicar `textZoom` según `fontScale` desde `MainActivity`, con un tope razonable.
3. **Texto mínimo.** `.nav-label` mide 10 px y `.bell-badge` 11 px. Subir las etiquetas de la barra a 11–12 px.
4. **Gráficas.**
   - Los `<canvas>` tienen `aria-label` fijo ("Distribución del mes"), pero un lector de pantalla no recibe los números.
   - Añadir un resumen en texto oculto visualmente pero legible por lector de pantalla, junto a cada gráfica. Ejemplo: "Ingresos $ 4.350.000, gastos $ 3.534.800, te quedan $ 815.200".
5. **No depender solo del color.** En Límites, el estado ya va en texto ("Pasaste el límite por…"); mantenerlo. En las barras de quién pagó del Hogar, acompañar el color con el nombre.
6. **Ya está bien y hay que conservarlo:**
   - `lang="es"`
   - zoom permitido en el viewport
   - `:focus-visible`
   - `aria-live` en avisos, mes y FinanBot
   - bloque `prefers-reduced-motion`
   - `prefers-reduced-transparency`

**Verificación:** recalcular los contrastes con los valores finales, con un script o con el skill `design:accessibility-review`. Probar con TalkBack en Android: Inicio, Registrar y Límites se tienen que poder recorrer y entender sin ver la pantalla.

---

## Fase B — Ícono "Moneda de oro" (0.11.1) — HECHA

Sustituye por completo el ícono "Barras" del plan 009 y sigue sus mismos pasos y archivos.

**Geometría de referencia** (viewBox 108×108, la del ícono adaptativo; la zona segura es el círculo de 66 dp centrado, y la moneda ocupa r = 28.5 con el borde):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#13A595"/><stop offset="1" stop-color="#0B766C"/>
    </linearGradient>
    <clipPath id="coin"><circle cx="54" cy="54" r="27"/></clipPath>
  </defs>
  <rect width="108" height="108" fill="url(#bg)"/>
  <circle cx="54" cy="54" r="27" fill="#FBE7B5"/>
  <path clip-path="url(#coin)" fill="#F2B544" d="M26 62 C34 55 41 55 48 59 S62 63 70 55 S79 49 82 50 V82 H26 Z"/>
  <circle cx="54" cy="54" r="27" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="3"/>
</svg>
```

**Recursos:**

- `assets/icon.svg`: la fuente de arriba, con esquinas redondeadas `rx="24"` en el rect para documentación. También `assets/icon-foreground.svg` (sin fondo) e `icon-round.svg`.
- **Android 8+:**
  - `ic_launcher_background`: Marea. Puede ser un vector con el degradado #13A595 → #0B766C (API 24+, `aapt:attr` gradient) o el color plano #0E8A7E si el degradado complica. Actualizar `values/ic_launcher_background.xml`.
  - `drawable/ic_launcher_foreground.xml`: la moneda en vector (disco #FBE7B5, ola #F2B544 recortada con `<clip-path>`, borde blanco).
  - `drawable/ic_launcher_monochrome.xml`: misma silueta en negro opaco. El disco al 45% de opacidad, la ola y el borde al 100%.
- **Android 5–7:** los PNG `mipmap-*/ic_launcher.png` e `ic_launcher_round.png`.
- **Notificación:** `drawable/ic_stat_finanflow.xml` en silueta blanca: anillo (trazo 6) y la parte de abajo llena hasta la ola; la parte de arriba vacía.
- **Splash:** todos los `splash.png` con fondo Marea y la moneda centrada, manteniendo el tamaño de cada archivo actual.
- **PWA:**
  - `www/icons/icon-192.png`, `icon-512.png` y `apple-touch-icon.png` a sangre completa.
  - `manifest.json` sigue con `"purpose": "any maskable"`.
- **Widget:** ya usa Marea (`widget_accent`); solo revisar que el botón "+" combine.
- `www/icons/iconoFinanFlow.png`: es un logo antiguo con el símbolo ¢ que no está referenciado en `www/`. Borrado en la 0.11.1 (aprobado por el usuario).
- **Documentación:** actualizar la sección "Ícono" de `CLAUDE.md` y el plan 009 (marcarlo como reemplazado por esta fase).

**Pasos:** los mismos del plan 009. Generar los PNG con `@resvg/resvg-js` instalado en una carpeta de borrador, no en el proyecto. Luego `npm run build-native` y `cd android && ./gradlew assembleDebug`. Subir `versionCode`.

**Verificación:**

- `BUILD SUCCESSFUL`.
- Revisar los PNG generados a 48 px.
- En el celular: el ícono se ve con máscara circular, el ícono temático de Android 13 se tiñe, y la notificación y el splash muestran la moneda.
- No queda ningún recurso con las barras violetas.

---

## Fase C — Inicio (0.12.0) — HECHA (sin los puntos opcionales 5 y 7, que piden preguntar)

1. **Etiqueta del saldo.** En el mes actual y sin cuentas activas, `balance-label` dice "Saldo", pero muestra el acumulado (`app.js` ~1277–1283), mientras que Ingresos y Gastos son del mes. Cambiar a "Saldo total". Los demás textos ("Saldo en tus cuentas", "Saldo al cierre de…") están bien.
2. **Flechas.**
   - Hoy Ingresos usa `arrow_downward` y Gastos `arrow_upward` (`index.html:82` y `:89`), y muchos lo leen al revés.
   - Usar `south_west` para entrada y `north_east` para salida.
   - Íconos nuevos: correr `npm run vendor` y `npm run check-icons`.
3. **Comparativa** (`#month-compare`, `.compare`). Convertirla en una pastilla pequeña: texto en `--text-secondary`, y solo el porcentaje y la flecha en color (`.good` / `.bad`). Debe caber en una línea a 390 px.
4. **Alertas de límites** (`renderBudgetAlerts`, `app.js` ~1412). Con 2 o más alertas, mostrar una sola fila: "2 límites necesitan atención", con el ícono del nivel más grave, que abre la pestaña Límites. Con una sola alerta, se queda como está.
5. **Neto de la dona.**
   - El centro usa `formatCompact` (`app.js:1058` y `:1066`) y da "+$815,2 K", un formato que ninguna otra cifra usa. Usar `formatMoney`.
   - `formatCompact` se queda solo para los ejes de los gráficos.
   - Opcional, preguntar al usuario: en modo Balance, cambiar la dona por dos barras horizontales comparadas, porque ingresos y gastos no son partes de un todo.
6. **Resumen del año sin meses vacíos.** La gráfica de "Últimos 12 meses" muestra barras vacías antes del primer mes con datos (en la demo, de noviembre a junio). Debe empezar en el primer mes con movimientos, con un mínimo de 3 meses visibles.
7. **Opcional, preguntar:** cambiar el título grande "Inicio" por el logotipo pequeño (la moneda) más el selector de mes, y que el botón de FinanBot use la moneda en lugar del destello genérico de IA.

**Impacto en datos financieros:** ninguno; mismos cálculos, otra presentación.

---

## Fase C2 — Vidrio con propósito (0.12.0, junto con C)

Referencia visual: mockup "Inicio · vidrio", en claro y en oscuro, del lienzo de diseño "FinanFlow · Rediseño".

**Hoy:**
- `.card` usa `--glass` (`styles.css` ~562), que es translúcido pero sin desenfoque. Sobre un fondo de un solo color se ve igual que una tarjeta sólida y le quita contraste a las cifras.
- La barra inferior sí desenfoca, con `saturate(180%) blur(12px)` (~1534).
- Ya existe la alternativa para `prefers-reduced-transparency` (~1662).

**Cambios:**

1. **Moneda de fondo en Inicio.**
   - Un SVG decorativo (`aria-hidden="true"`) detrás del encabezado y del saldo, que se mueve con el scroll y no queda fijo:
     - una moneda grande, r ≈ 150 px y centrada hacia la derecha (~x 300, y 215 en un ancho de 390), con disco `--gold-soft`, ola `--gold` y borde blanco;
     - un círculo Marea al 40–55% de opacidad abajo a la izquierda.
   - Es la misma geometría del ícono de la Fase B.
   - En oscuro, el oro baja de opacidad (disco ~30%, ola ~60%).
   - Solo en Inicio, en ambos espacios (Personal y Hogar); no en las demás pestañas.
2. **Tarjeta del saldo en vidrio real.**
   - `#balance-card` con estos valores:
     - fondo `rgba(255,255,255,0.52)` en claro y `rgba(255,255,255,0.08)` en oscuro;
     - `backdrop-filter: blur(24px) saturate(180%)` (más `-webkit-`);
     - borde de 1 px `--glass-edge`;
     - sombra interior arriba con `--glass-glint`, más una sombra suave.
   - La pastilla de la comparativa va sobre blanco semitransparente.
   - Comprobar el contraste ≥ 4.5:1 del texto secundario sobre el vidrio en ambos temas, con la moneda detrás: ese es el peor caso.
3. **Las demás tarjetas, sólidas.** `.card` pasa a `--card`, sin transparencia: alertas, Próximos, Metas, Este mes, Recientes y las de las otras pestañas. Las tarjetas que ya usan `--surface` (listas) también se revisan para que sean sólidas.
4. **Barra inferior flotante.**
   - La `.tab-bar` del celular deja de ir pegada al borde: `left/right: 12px`, `bottom: calc(12px + var(--safe-bottom))`, `height: ~68px`, `border-radius: 34px`, vidrio con `blur(20px) saturate(180%)`, borde `--glass-edge` y sombra.
   - El "+" va dentro de la barra, de 52 px, con una sombra Marea suave.
   - Ajustar el padding inferior de `.app-content` para que el último elemento no quede tapado.
   - En tablet (sección "Tablet y horizontal") la barra lateral sigue igual, sólida.
5. **Otros elementos flotantes con el mismo vidrio:**
   - el botón de FinanBot del encabezado
   - el encabezado al hacer scroll (si se hace pegajoso)
   - las hojas `.sheet`
   - los avisos `.toast`
   - la barra de escribir de FinanBot
6. **Alternativas:**
   - `@media (prefers-reduced-transparency: reduce)` → todo sólido; la regla actual ya existe, hay que ampliarla a los elementos nuevos.
   - `@supports not (backdrop-filter: blur(1px))` → fondos sólidos.
7. **Rendimiento.** Como máximo unas 3 superficies con `backdrop-filter` visibles a la vez. Probar el scroll de Inicio en un Android de gama baja o media. Si se traba, bajar el blur a 16 px antes de quitar el efecto.

**Impacto en datos financieros:** ninguno.

**Verificación:**
- Inicio en claro y oscuro con los datos demo: la moneda se ve borrosa detrás del saldo y las cifras se leen bien.
- Con "reducir transparencia" activado en el sistema, todo queda sólido.
- La barra flotante no tapa la última fila de Recientes.

---

## Fase D — Registrar movimiento (0.12.1)

1. **Monto agrupado.**
   - El "$" sale pegado a la izquierda y el 0 centrado.
   - `.amount-field input` tiene `width: 100%` junto con `field-sizing: content` (`styles.css` ~1734): el ancho fijo anula el ajuste al contenido. Comprobar en el WebView de Android.
   - Objetivo: símbolo y cifra centrados juntos.
   - Al escribir, la cifra puede tomar el color del tipo: `--spend` para gasto, `--income` para ingreso, `--accent` para transferencia.
2. **Un solo Guardar.**
   - Las hojas de movimiento y de límite tienen Guardar arriba (`index.html:464` y `:577`) y abajo (`:562` y `:595`).
   - Dejar solo el de abajo, que queda en la zona del pulgar; arriba solo Cancelar.
   - Revisar las demás hojas para que todas sigan el mismo patrón.
3. **Fecha rápida.**
   - Sobre `#tx-date`, poner las pastillas "Hoy · Ayer · Otra"; Otra abre el selector nativo.
   - Mostrar la fecha como "Hoy, 16 oct" (`es-CO`), no `mm/dd/aaaa`.
   - Mantener `todayISO()` y `toISODate()`; nunca usar `toISOString()`.
4. **Selección de categoría.** Cambiar el rectángulo gris detrás de la categoría elegida por un anillo `--accent` de 2–3 px alrededor del círculo, con el texto en negrita.

**Impacto en datos financieros:** la fecha guardada sigue siendo "YYYY-MM-DD" local; solo cambia cómo se elige.

---

## Fase E — Tipografía propia (0.13.0)

- **Manrope** (licencia OFL), variable, recortada a latín, en `www/vendor/fonts/manrope.woff2`.
  - Ampliar `scripts/vendor-assets.mjs` para descargarla de Google Fonts `css2`, como ya hace con Material Symbols.
  - Agregarla a `ASSETS` en `sw.js`.
- Token nuevo `--font-display: "Manrope", var(--font)`, aplicado a:
  - `.large-title`
  - `.balance-amount`
  - los títulos de sección
  - las cifras grandes: totales y montos de la hoja
- El texto de lectura sigue con `--font`, la del sistema.
- Mantener `font-variant-numeric: tabular-nums` en las cifras; ya está en 9 reglas.
- Revisar que `setAnimatedText` no salte de ancho con la fuente nueva.

---

## Fase F — Firma visual y voz (0.13.1)

1. **La moneda que se llena** como motivo propio, en un componente pequeño SVG reutilizable:
   - **Estados vacíos** (Recientes, Historial, Límites, Metas): la moneda en contorno, vacía.
   - **Al guardar un movimiento:** la ola sube dentro de la moneda en ~600 ms con `--ease-out`, por WAAPI y solo con `transform`. Va en el aviso de confirmación.
   - **Meta de ahorro cumplida:** la moneda se llena por completo en Oro.
   - Respetar `prefers-reduced-motion`: menos movimiento, no cero, como el resto de la app.
2. **Voz:** frases cortas, en "tú", que acompañan en vez de juzgar. Revisar con el usuario:
   - estados vacíos ("Aún no hay movimientos. Registra el primero con +")
   - alertas ("Ocio pasó su límite por $68.100")
   - onboarding
   - saludo de FinanBot
   - Llevar "Tus datos son tuyos" también a la pantalla de Nube.

---

## Fase H — Onboarding (0.13.2)

Hoy no hay primer uso: la app abre en Inicio vacío. Referencia: tableros "Onboarding 1–3" del lienzo de diseño.

1. **Bienvenida.**
   - Mitad superior Marea con la mascota y el logotipo.
   - "Tu dinero, en calma" y una línea de texto.
   - Botón "Empezar" y enlace "Ya tengo un respaldo", que abre Restaurar respaldo.
2. **Tus datos son tuyos.** Dos opciones como tarjetas seleccionables:
   - "Solo en este celular" (por defecto)
   - "Sincronizar con Google" (abre el inicio de sesión existente)
   - Nota: "Puedes cambiarlo cuando quieras en Ajustes → Nube".
3. **Lo básico.**
   - Moneda en pastillas (COP preseleccionado según `navigator.language`), tema y recordatorio diario (solo en nativo).
   - Botones "Anotar mi primer gasto" (abre la hoja de movimiento) y "Explorar con datos de ejemplo" (carga `demo/finanflow-demo.json` y muestra un aviso para borrarlos después).

**Reglas:**
- Se muestra solo si no hay `finanflow_state` ni sesión, y se marca como visto en `localStorage` (`finanflow_onboarded`).
- Botón Atrás y Escape usan la pila de modales.
- Los datos de ejemplo deben poder borrarse de un toque: Ajustes → "Quitar datos de ejemplo".

**Impacto en datos financieros:** cargar la demo escribe movimientos. Hay que marcarlos (por ejemplo, id con prefijo `demo-`, como ya tiene el JSON) para borrarlos sin tocar los del usuario.

---

## Fase I — Hogar compartido (0.13.3)

Referencia: tableros "Hogar · Inicio", "Hogar · gasto compartido" y "Hogar · actividad".

1. **Selector de espacio** con ícono y el nombre del Hogar (`households/{id}`), no solo "Hogar".
2. **Tarjeta "Entre ustedes"** (`#household-balance`; "Camila" es un nombre de ejemplo del mockup):
   - Las iniciales de los dos superpuestas, "Camila te debe" y la cifra grande en `--font-display`.
   - Debajo, "Por N gastos compartidos de [mes]".
   - Botón Saldar como primario Marea, no tintado.
3. **"Gastado en [mes]"** con una barra dividida de quién pagó: tú en Marea, la pareja en Oro, con nombres y montos. No usar solo el color (ver Fase A2).
4. **Meta compartida:** la de la Fase C, con "Tú aportaste $X · [pareja] $Y".
5. **Filas del Hogar:** la inicial de quien pagó como insignia sobre el ícono de la categoría. En la segunda línea, "Pagó Camila · 50/50 · tu parte $ 207.500".
6. **Hoja de gasto compartido:**
   - "¿Quién pagó?" como dos tarjetas con avatar, en lugar del `<select id="tx-paidby">`.
   - "¿Cómo lo dividen?" como pastillas: "Mitad y mitad", "Solo de quien pagó", "Todo del otro" y "Otro %". Mismos valores que `tx-split`: 50 / 100 / 0 / custom.
   - Una barra que muestre en vivo cuánto pone cada uno.
7. **Actividad:**
   - Agrupar por "Hoy" y "Esta semana".
   - Avatar con color por persona (tú Marea, pareja Oro) y fondo suave en las no vistas.
   - El monto de "registró un pago para saldar" en verde.

**Impacto en datos financieros:** ninguno. `paidBy`, `payerShare` y `householdBalance()` no cambian; solo la presentación y la forma de elegir.

---

## Fase J — Tablet (0.13.4)

Referencia: tablero "Tablet horizontal".

- **Barra lateral** (`min-width: 900px`):
  - logotipo arriba
  - "Nuevo movimiento" como botón primario
  - navegación con fondo `--accent-tint` en la pestaña activa
  - abajo, una tarjeta de FinanBot con la mascota
- **Inicio en dos columnas:**
  - a la izquierda, saldo en vidrio sobre la moneda de fondo, alertas y próximos
  - a la derecha, Este mes, metas y recientes
- La barra lateral es sólida, porque no flota sobre nada. El vidrio queda solo en el saldo y en las hojas centradas.

---

## Fase K — Widget y notificaciones de Android (0.13.5)

Referencia: tablero "Widget y notificaciones".

1. **Widget grande** (`widget_balance.xml`):
   - fondo degradado Marea (`widget_bg`)
   - la moneda pequeña y "Saldo total · [mes]"
   - el botón "+" en Oro suave con el ícono oscuro
   - ingresos y gastos abajo, en blanco al 82%
2. **Widget pequeño nuevo (2×2), opcional:** la moneda y "Disponible hoy $ 43.325". El valor ya se calcula en `renderAllowance` y se enviaría por `WidgetBridge`.
3. **Ícono de notificación:** la silueta de la Fase B.
4. **Textos con la voz nueva** (en `app.js`: `refreshScheduledNotifications` para el recordatorio y el resumen semanal, y `checkBudgetAlerts` para los límites):

| Aviso | Hoy | Propuesta |
|---|---|---|
| Recordatorio | "FinanFlow" / "¿Registraste tus gastos de hoy? Toma 5 segundos." | "¿Ya anotaste lo de hoy?" / "Toma 5 segundos. Toca para registrar." |
| Límite al 100% | "Superaste el límite de Ocio" | "Ocio pasó su límite" / "Llevas $X de $Y. Aún puedes cuidar el resto del mes." |
| Límite al 80% | "Ocio: cerca del límite" | "Ocio va en 80%" / "Te quedan $Z para el resto del mes." |
| Resumen semanal | "Tu resumen semanal" | "Tu semana en FinanFlow" / "Gastaste N% menos que la semana pasada. Donde más: Comida." (requiere comparar con la semana anterior) |
| Hogar (nuevo, opcional) | — | "Camila agregó Mercado Carulla" / "$ 415.000 · mitad y mitad. Tu parte: $ 207.500." (solo si la app está en segundo plano y hay sincronización; sin servidor no hay push real, así que se evalúa su viabilidad) |

---

## Fase G — Mascota (0.14.0, exploración)

Idea del usuario: un personaje que represente la marca. **No se programa nada hasta que el diseño esté aprobado en el lienzo de diseño.**

- **Base:** la propia moneda de oro, con una expresión mínima (ojos y boca simples). Así la mascota y el ícono son la misma cosa, y cada aparición refuerza el reconocimiento.
- **Dónde aparece:**
  - avatar de FinanBot (su lugar natural)
  - onboarding
  - estados vacíos
  - celebraciones (meta cumplida, mes bajo presupuesto)
- **Dónde no:**
  - listas y cifras (Historial, Límites)
  - avisos de deuda o error, donde debe hablar el dato y no un personaje
- **Reglas:** máximo una aparición por pantalla. Pocas expresiones (contenta, pensativa, celebrando) dibujadas como SVG, sin imágenes rasterizadas. Nombre a decidir con el usuario.

## Riesgos generales

- **Ícono:** el degradado en el vector de Android es opcional; si da problemas, se usa color plano. Probar siempre a 48 px y con el ícono temático.
- **Íconos de Material Symbols nuevos** (fases C y D): si no se regenera la fuente, se ven como texto. Correr `npm run check-icons`.
- **Vidrio:** `backdrop-filter` es costoso en WebView de gama baja; se limita a pocas superficies y tiene alternativa sólida.
- **Fuente nueva:** suma unos 30–60 KB al caché del Service Worker; aceptable.
- **iPhone (PWA):** no muestra el splash nativo ni el ícono temático; todo lo demás aplica igual.
