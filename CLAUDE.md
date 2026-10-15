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
cd android && ./gradlew assembleDebug   # compila el APK (JDK 17 + Android SDK)
```

No hay tests ni linter. `node --check www/app.js` valida la sintaxis. Para probar en Android: editar `www/`, `npm run build-native`, ejecutar desde Android Studio (las notificaciones, el widget, el botón Atrás y los shortcuts solo existen en nativo).

## Arquitectura

**Un solo script: `www/app.js`** (clásico, sin módulos), cargado por `www/index.html` junto a `www/vendor/chart.umd.min.js` (Chart.js 4 local para funcionar offline; si se actualiza, copiarlo de `node_modules/chart.js/dist/`) y Firebase compat por CDN (si no carga, la app sigue en modo local). Los `onclick` inline del HTML llaman a `window.app` (objeto al final de `app.js`).

Flujo de datos:
- `state` global único. `saveState()` persiste en `localStorage` (`finanflow_state`). **Todo cambio de datos pasa por `commit()`** (guardar → `render()` → alertas de límites → reprogramar notificaciones → `syncWidget()`).
- La capa `upsertTransaction / removeTransaction / upsertBudget / removeBudget` decide local vs nube (`isCloud()`). En la nube se escribe sin `await`: la caché offline de Firestore dispara el snapshot al instante y el listener actualiza `state`.
- Fechas siempre como `"YYYY-MM-DD"` en hora **local** (`todayISO()`, `toISODate()`; nunca `toISOString()`, que es UTC). Pertenecer a un mes es un prefijo (`isInMonth`).
- `monthStats(ym)` calcula los agregados del mes una vez por render; `state.viewMonth` es el mes que se ve en Inicio y Límites.
- Recurrentes: una transacción con `recurring: "monthly"` es plantilla; `materializeRecurring()` crea copias con id determinista `${id}-${YYYY-MM}` y `recurringOf`. Borrar una copia agrega el mes a `skipMonths` de la plantilla para que no se regenere.
- Los ids de `CATEGORIES` se guardan en cada transacción: no renombrarlos (sí se puede cambiar `label`, `icon`, `color`).
- **Espacios:** `state.space` es `"personal"` o `"household"`; `state.transactions/budgets` son siempre los del espacio activo y el otro vive en `spaceCache`. `switchSpace()` los intercambia. Solo el espacio personal se guarda en `localStorage` (`personalData()`). La nube escucha ambos espacios (`listenSpace`) más la membresía del Hogar (`households` con `members array-contains uid`) y la actividad.
- **Firestore:** `users/{uid}/{transactions,budgets}` (personal), `households/{id}` (`members`, `memberInfo`) con `transactions`, `budgets` y `activity`, e `invites/{código}` (un solo uso, 48 h). Las reglas viven en `firestore.rules` y se publican con `npm run deploy` (requiere `npm run firebase-login` una vez). Cualquier colección nueva necesita su regla.
- **Hogar:** cada movimiento tiene `createdBy`/`updatedBy`, `paidBy` y `payerShare` (parte de quien pagó, 0–100). `householdBalance()` calcula cuánto le debe la pareja; "Saldar" crea un movimiento con `kind: "settlement"`, que `countsAsMoney()` excluye de totales y gráficos.
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
- Notificaciones locales: ids 100–106 recordatorio (7 avisos sueltos, se reprograman al abrir/guardar), 200+ alertas de límites (`state.notified` evita repetir), 300 resumen semanal. Ícono `ic_stat_finanflow`.

Service Worker (`www/sw.js`): red primero y caché como respaldo. Subir `CACHE_NAME` al publicar y mantener la versión alineada en `package.json`, `manifest.json`, `sw.js`, `README.md` y el texto de versión de Ajustes en `index.html`.

## Repositorio

`capacitor.config.json` usa `webDir: "www"`, `appId: com.finanflow.app`. Parte de `node_modules/` está versionada en git (artefactos de build de `@capacitor/android`); no depender de ello ni añadir más.
