# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

FinanFlow: app de control de gastos personales en Vanilla JS (sin framework ni bundler), servida como PWA y empaquetada para Android con Capacitor 5. Idioma de UI, comentarios y README: español. Diseño inspirado en iOS. Persistencia local en `localStorage`; sincronización opcional con Firebase (Auth Google + Firestore); asistente IA opcional con Gemini (la key la pone el usuario en Ajustes).

## Regla de trabajo obligatoria (`AGENT.md`)

`AGENT.md` define que **no se debe generar, modificar ni eliminar código sin plan aprobado**. Ante cualquier función nueva, refactor o bug, responder primero solo con un "Plan de Acción Propuesto" (Objetivo, Impacto Arquitectónico, Impacto en Datos Financieros, Lista de Ejecución, Riesgos) y preguntar "¿Procedemos con este plan?". Solo tras confirmación del usuario se escribe código, un paso a la vez si es extenso. Principios del mismo archivo: no loguear PII/saldos/tokens, cálculos de dinero deterministas (redondear con `roundMoney`), offline-first con caché local como fuente de verdad, actualizaciones optimistas en la UI.

## Comandos

```bash
npm install            # dependencias (Capacitor + plugins, Chart.js, http-server)
npm run dev            # sirve www/ en http://localhost:5173
npm run build-native   # npx cap sync: copia www/ y registra plugins en android/
npm run open-android   # abre android/ en Android Studio
npm run deploy         # publica www/ en Firebase Hosting y firestore.rules (tras npm run firebase-login)
npm run apk            # APK firmado de release → FinanFlow-<versión>.apk (requiere android/keystore.properties; ver README)
npm run vendor         # regenera la fuente de íconos recortada, Firebase local y los logos de marcas
npm run check-icons    # avisa si un ícono usado no está en la fuente local
cd android && ./gradlew assembleDebug   # compila el APK (JDK 17 + Android SDK)
```

No hay tests ni linter. `node --check www/app.js` valida la sintaxis. Para probar en Android: editar `www/`, `npm run build-native`, ejecutar desde Android Studio (las notificaciones, el widget, el botón Atrás y los shortcuts solo existen en nativo).

## Arquitectura

**Un solo script: `www/app.js`** (clásico, sin módulos), cargado por `www/index.html` junto a `www/vendor/chart.umd.min.js` (Chart.js 4 local para funcionar offline; si se actualiza, copiarlo de `node_modules/chart.js/dist/`) y Firebase compat 10.8.0 local en `www/vendor/firebase/`. La fuente Material Symbols también es local (`www/vendor/fonts/`), **recortada a los íconos usados**: al usar un ícono nuevo, ejecutar `npm run vendor` (regenera fuente y Firebase); `npm run check-icons` avisa si falta alguno. Nada se carga de CDNs, así la app abre sin conexión. Los `onclick` inline del HTML llaman a `window.app` (objeto al final de `app.js`).

Flujo de datos:
- `state` global único. `saveState()` persiste en `localStorage` (`finanflow_state`). **Todo cambio de datos pasa por `commit()`** (guardar → `render()` → alertas de límites → reprogramar notificaciones → `syncWidget()`).
- La capa `upsertTransaction / removeTransaction / upsertBudget / removeBudget` decide local vs nube (`isCloud()`). En la nube se escribe sin `await`: la caché offline de Firestore dispara el snapshot al instante y el listener actualiza `state`.
- Fechas siempre como `"YYYY-MM-DD"` en hora **local** (`todayISO()`, `toISODate()`; nunca `toISOString()`, que es UTC). Pertenecer a un mes es un prefijo (`isInMonth`).
- `monthStats(ym)` calcula los agregados del mes una vez por render; `state.viewMonth` es el mes que se ve en Inicio y Límites.
- Recurrentes: una transacción con `recurring: "monthly" | "biweekly" | "weekly"` es plantilla; `recurringDates()` calcula las fechas y `materializeRecurring()` crea copias con id determinista `${id}-${clave}` (mensual `YYYY-MM`, quincenal `YYYY-MM-q1|q2` = día 15 y último, semanal `YYYY-MM-DD`) y `recurringOf`. Borrar una copia agrega su clave a `skipMonths` de la plantilla para que no se regenere. "Próximos 7 días" (`upcomingItems()`) usa las mismas fechas.
- Ocultar o recolorear una categoría base = marcador con su mismo `id` entre las propias (`{ id, hidden, color }`, ref `hide-<tipo>-<hash>`; `color: ""` = el de siempre); `categoriesFor(type, custom, true)` las incluye (para movimientos viejos, filtro y nombres reservados).
- Los ids de `CATEGORIES` se guardan en cada transacción: no renombrarlos (sí se puede cambiar `label`, `icon`, `color`).
- **Categorías propias:** `state.categories = { expense, income }` por espacio (`{ ref, id, type, label, icon, color, brand, excluded }`). Usar siempre `categoriesFor(type)` / `getCategoryInfo()` (base + propias, "Otros" al final), nunca `CATEGORIES` directo. El `id` es el nombre con que se creó y no cambia al renombrar, así un movimiento de una categoría borrada sigue mostrando su nombre. `excluded` ("No sumar en totales") hace que `countsAsMoney()` la ignore. En Firestore el id de un límite pasa por `budgetDocId()` (escapa "/").
- **Marcas:** `www/vendor/brands.js` (`window.BRANDS`, generado por `npm run vendor` desde Simple Icons; las que no están llevan monograma `mono`). `brandFor(texto)` busca palabras de `keys` en la nota o el comercio; `cat.brand` fija el logo de una categoría. Pintar íconos de fila con `rowIcon(cat, brand)` / `brandChip()`.
- **Cuentas, tarjetas y metas:** `state.accounts` por espacio (subcolección `accounts`). El `id` de una cuenta es lo que guarda `tx.method` (las base de `BASE_ACCOUNTS` son los métodos de siempre). Solo se sigue el saldo de las activadas, desde `startDate`/`startedAt` con `startBalance` (tarjeta: negativo = deuda). Una meta es una cuenta `kind: "goal"`. Mover dinero entre cuentas es un movimiento `kind: "transfer"` con `from`/`to` (`type: "expense"` por compatibilidad), que `countsAsMoney()` excluye. Usar `accountsFor()`, `goalsFor()`, `accountInfo()` y `accountBalance()`. Las base se pueden renombrar (el nombre guardado manda; el `id` no cambia). `monthlyPayment` ("Cuota del mes") de una tarjeta: `cardPayment()` resta lo transferido a ella desde la fecha de pago anterior y lo usan Próximos 7 días, la fila y el aviso. Con cuentas activas, el Saldo del mes actual en Inicio es la suma de las cuentas (`personalBalance()`).
- **Espacios:** `state.space` es `"personal"` o `"household"`; `state.transactions/budgets/categories/accounts` son siempre los del espacio activo y el otro vive en `spaceCache`. `switchSpace()` los intercambia. Solo el espacio personal se guarda en `localStorage` (`personalData()`). La nube escucha ambos espacios (`listenSpace`) más la membresía del Hogar (`households` con `members array-contains uid`) y la actividad.
- **Firestore:** `users/{uid}/{transactions,budgets,categories,accounts}` (personal), `households/{id}` (`members`, `memberInfo`) con `transactions`, `budgets`, `categories`, `accounts` y `activity`, e `invites/{código}` (un solo uso, 48 h). Las reglas viven en `firestore.rules` y se publican con `npm run deploy` (requiere `npm run firebase-login` una vez). Cualquier colección nueva necesita su regla.
- **Hogar:** cada movimiento tiene `createdBy`/`updatedBy`, `paidBy` y `payerShare` (parte de quien pagó, 0–100). `householdBalance()` calcula cuánto le debe la pareja; "Saldar" crea un movimiento con `kind: "settlement"`, que `countsAsMoney()` excluye de totales y gráficos. Un gasto del Hogar pagado por ti con "Salió de" crea en tu espacio personal un reflejo `kind: "household"` con id `hogar-<id>` (`syncHouseholdMirror`, escrito con `personalWrite` aunque estés en el Hogar): mueve `accountBalance()` pero `countsAsMoney()` lo excluye; se actualiza o borra con el gasto. `moveTransaction()` pasa movimientos sueltos entre espacios conservando el saldo de las cuentas.
- **Errores de nube:** las escrituras pasan por `cloudWrite()`; `cloudError()` agrupa por código (un solo aviso por tipo) y la pastilla `#sync-pill` muestra el estado hasta que se resuelve.

UI:
- Modales con `openModal(id)` / `closeModal(id)` y una pila (`modalStack`) que usan Escape y el botón Atrás de Android. Hojas inferiores `.sheet` con gesto de arrastrar para cerrar (`setupSheetGesture`).
- Controles segmentados con `setupSegmented` / `setSegmented` (el indicador se mueve con `transform` directo en el elemento).
- Movimiento: tokens `--ease-out`, `--ease-in-out`, `--ease-drawer` y `--dur-*` en `styles.css`; solo `transform`/`opacity`; entradas con `@starting-style`; animaciones dinámicas con WAAPI (`setAnimatedText` para cifras, FLIP de filas en `commit()` con `captureRowPositions`/`playRowFlip`); bloque `prefers-reduced-motion` al final del CSS (menos movimiento, no cero). No usar `transition: all` ni rebotes. Los planes de mejora de movimiento y layout viven en `plans/` (formato del skill improve-animations).
- Layout responsive en la sección "Tablet y horizontal" de `styles.css`: celular horizontal (`max-height: 500px`) compacto; `min-width: 700px` hojas como ventanas centradas (sin gesto de arrastre, ver `centeredSheets` en `app.js`); `min-width: 900px` barra lateral estilo iPad e Inicio en dos columnas (`.dash-col-left`, `.chart-row`, `.dash-full`).
- Ícono: fuente en `assets/icon.svg`; Android usa vectores (`drawable/ic_launcher_foreground.xml`, `ic_launcher_monochrome.xml`) sobre `#5E5CE6`. Los PNG de respaldo, `splash.png` e íconos PWA se generaron desde esa geometría.
- `demo/finanflow-demo.json`: respaldo de demostración (jul–oct 2026) para probar con "Restaurar respaldo".
- Tema: preferencia `dark | light | system` en `finanflow_theme`; `data-theme` en `<html>` se fija también con un script inline en `<head>` para evitar destellos.

Nativo (Android, `android/`):
- Plugins Capacitor accedidos sin bundler vía `window.Capacitor.Plugins.X` (`plugin("App")`, `Haptics`, `LocalNotifications`); en la PWA son `undefined` y todo se degrada.
- Deep links `finanflow://action/{add-expense|view-balance|view-history}` (App Shortcuts en `res/xml/shortcuts.xml` y botón "+" del widget) se procesan en `handleDeepLink` vía `App.getLaunchUrl()` / `appUrlOpen`. En la PWA, `?action=...` (shortcuts del manifest).
- Widget: `BalanceWidgetProvider.java` lee el resumen (JSON con montos ya formateados) que JS envía con el plugin local `WidgetBridgePlugin.java` (registrado en `MainActivity`), guardado en `SharedPreferences("finanflow_widget")`.
- Notificaciones locales: ids 100–106 recordatorio (7 avisos sueltos, se reprograman al abrir/guardar), 200–279 alertas de límites (`state.notified` evita repetir), 300 resumen semanal, 400–439 pago de tarjetas, 500–549 pagos detectados (nativas). Ícono `ic_stat_finanflow`.
- Pagos detectados: `PaymentListenerService` (NotificationListener) lee solo Wallet/Nu/Rappi/Davivienda/Nequi; `PaymentParser` (Java puro, probable con `javac` fuera de Android) saca monto, comercio y cuenta; `PaymentStore` guarda la cola, tarjeta → cuenta y comercio → categoría en `SharedPreferences("finanflow_payments")` (nunca en la nube). `PaymentPromptActivity` es la tarjeta flotante (vidrio con `setBackgroundBlurRadius` en Android 12+, animaciones `res/anim/prompt_*`); sin permiso de superposición o con pantalla bloqueada, notificación con botones (`PaymentActionReceiver`, ids 500–549, canal `finanflow_pagos`). Plugin `PaymentInbox`: JS envía el contexto en `syncWidget()` (`paymentContext`), registra los confirmados en `loadInbox()` con id `auto-<id>` y muestra "Por confirmar"; `finanflow://action/review?id=` abre la hoja pre-llenada. `PaymentInbox.test()` (sin botón; `app.testPaymentPrompt()` desde `chrome://inspect`) mete un pago de ejemplo con `test: true` e id `test-…`: no se une con pagos reales, no aprende tarjeta ni comercio y JS nunca lo registra (`finishTestItem`).
- Aviso de versión nueva: `checkForUpdate()` consulta `api.github.com/.../releases/latest` (como mucho cada 12 h, al abrir y al volver; `checkForUpdate(true)` desde Ajustes → Buscar actualizaciones) y compara el `tag_name` con `App.getInfo().version`. Estado por dispositivo en `localStorage` (`finanflow_update`: `checkedAt`, `latest`, `dismissed`). "Descargar" abre el APK del release en el navegador. Por eso cada release debe llevar el tag `v<versión>` y el `FinanFlow-<versión>.apk` adjunto.
- Bloqueo con huella/PIN: plugin `@capgo/capacitor-native-biometric` (`plugin("NativeBiometric")`), preferencia por dispositivo en `localStorage` (`finanflow_lock`). `#lock-screen` tapa la app al pasar a segundo plano y pide autenticarse al abrir o tras más de 1 minuto (`initLock`); mientras el diálogo del sistema está abierto (`lock.authing`) se ignoran los cambios de estado de la app.
- APK de release: firma con `android/keystore.properties` (gitignored; la llave `.jks` va fuera del repo) y `npm run apk`. Subir `versionCode` en `android/app/build.gradle` en cada APK.

Service Worker (`www/sw.js`): red primero y caché como respaldo. Subir `CACHE_NAME` al publicar y mantener la versión alineada en `package.json`, `manifest.json`, `sw.js`, `README.md` y el texto de versión de Ajustes en `index.html`.

## Repositorio

`capacitor.config.json` usa `webDir: "www"`, `appId: com.finanflow.app`. Parte de `node_modules/` está versionada en git (artefactos de build de `@capacitor/android`); no depender de ello ni añadir más.
