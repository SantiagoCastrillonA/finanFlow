# 006 — Chat con entrada de burbujas, indicador "escribiendo" y estados de carga

- **Status**: DONE
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Feedback
- **Estimated scope**: `www/app.js` (~40 líneas), `www/styles.css` (~50 líneas)

## Problem

- Las burbujas de FinanBot aparecen de golpe (`appendMessage`, `www/app.js:1847`).
- Mientras espera la respuesta (1–5 s) se ve una burbuja fija con "…" (`www/app.js:1814`).
- El login con Google (`loginWithGoogle`, `www/app.js:1490`) y la primera sincronización no muestran nada durante 2–10 s.

## Target

- **Burbujas**: `.ai-message` entra con `@starting-style { opacity: 0; transform: translateY(8px) scale(0.98) }` y `transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out)`; la del usuario con `transform-origin: bottom right`, la del bot `bottom left`.
- **Escribiendo**: burbuja con tres puntos de 7 px; cada uno con `animation: typing-dot 1.2s ease-in-out infinite` desfasados 0/150/300 ms. `@keyframes typing-dot { 0%, 60%, 100% { transform: translateY(0); opacity: .4 } 30% { transform: translateY(-4px); opacity: 1 } }`. Movimiento reducido: solo opacidad (`translateY(0)` en todos los pasos).
- **Spinner** reutilizable `.spinner`: 16 px, borde de 2 px `currentColor` con un cuarto transparente, `animation: spin 0.8s linear infinite` (movimiento constante = `linear`). Movimiento reducido: `animation: pulse 1s ease-in-out infinite` sobre opacidad.
- **Login**: al tocar "Continuar con Google", el botón `#firebase-action-btn` muestra spinner y "Conectando…", y queda `disabled` hasta que termina (éxito, error o cancelación). Estado en `state.cloudStatus = "connecting" | "syncing" | null`.
- **Primera sincronización**: tras iniciar sesión y hasta el primer snapshot de transacciones, el subtítulo de la nube muestra spinner y "Sincronizando…".

## Repo conventions to follow

- `updateFirebaseStatusUI()` pinta la fila de la nube; `syncWithFirestore()` tiene los listeners.
- Entradas con `@starting-style` como `.tx-row.is-new` (`www/styles.css:737`).

## Steps

1. CSS: `.spinner`, `@keyframes spin`, `.typing-dots`, `@keyframes typing-dot`, entrada de `.ai-message`; variantes en el bloque de movimiento reducido.
2. `sendAIMessage`: la burbuja de espera usa `<span class="typing-dots"><i></i><i></i><i></i></span>` (marcar con `aria-label="FinanBot está escribiendo"`).
3. `loginWithGoogle`: `state.cloudStatus = "connecting"`, `updateFirebaseStatusUI()`; en `finally`, si no hay usuario, volver a `null`.
4. `handleAuthStateChange(user)`: si hay usuario, `state.cloudStatus = "syncing"`; en el primer snapshot de transacciones, `null`.
5. `updateFirebaseStatusUI`: pintar spinner y textos según `state.cloudStatus`.

## Boundaries

- No cambiar la lógica de autenticación ni de Firestore.

## Verification

- **Mechanical**: `node --check www/app.js`.
- **Feel check**: abrir FinanBot y enviar un mensaje: la burbuja del usuario sube desde su esquina, aparecen los tres puntos ondulando y la respuesta entra suave. Con DevTools en "Slow 3G", conectar Google: el botón muestra el spinner y no admite doble toque. Con movimiento reducido, los puntos solo parpadean.
- **Done when**: no queda la burbuja fija "…" y ambos estados de la nube son visibles.
