# FinanFlow - Control de Gastos Personales

> **Version:** 0.2.1  
> **Privacidad 100% garantizada** | **Funciona sin conexión** | **Sincronización opcional con Google Cloud**

FinanFlow es una aplicación móvil de control de gastos e ingresos personales, con un diseño sobrio inspirado en iOS. Funciona como **PWA** (Progressive Web App) y como **aplicación nativa Android** mediante [Capacitor](https://capacitorjs.com/).

---

## Qué es FinanFlow

FinanFlow te permite llevar un registro de tus finanzas de forma **rápida, privada y sin complicaciones**. Todos tus datos se guardan localmente en tu dispositivo y, si lo deseas, puedes sincronizarlos con **Google Cloud (Firebase)** para usarlos en cualquier dispositivo.

---

## Características principales

### Registro en segundos
- **Agregar en dos toques:** monto → categoría (cuadrícula con íconos) → Guardar. La app recuerda la última categoría y método usados.
- **Monto con separador de miles** mientras escribes (`3.200.000`).
- **Movimientos recurrentes:** marca un ingreso o gasto como "Repetir cada mes" (salario, arriendo, suscripciones) y se crea solo cada mes.
- **Editar y borrar estilo iOS:** toca un movimiento para editarlo; al borrarlo puedes **Deshacer**.

### Inicio
- **Saldo** y **ingresos / gastos del mes**, con navegación entre meses (‹ ›).
- **Comparativa mensual:** "Gastos 12% menos que en septiembre a esta fecha".
- **Disponible por día:** cuánto puedes gastar al día el resto del mes según tus límites.
- **Gráfico de dona** (Balance, Gastos, Ingresos): toca una categoría para ver sus movimientos.
- **Tendencia** del saldo de los últimos 7 días.

### Límites
- **Límites mensuales por categoría** con barra de progreso y alertas al 80% y al 100%.

### Notificaciones (Android)
- **Recordatorio diario** a la hora que elijas (no suena si ya registraste algo ese día).
- **Alertas de límites** al llegar al 80% y al 100% (una vez por categoría y mes).
- **Resumen semanal** cada domingo.

### Widget y accesos rápidos (Android)
- **Widget de pantalla de inicio:** saldo, ingresos y gastos del mes, y un botón **+** para agregar un gasto.
- **App Shortcuts:** mantén presionado el ícono para Agregar gasto, Ver balance o Ver historial.

### Personalización
- **Tema Automático / Claro / Oscuro.**
- **Monedas:** COP, USD, EUR, MXN, ARS, CLP y PEN.

### Inteligencia Artificial (opcional)
- **FinanBot:** asistente con [Google Gemini](https://aistudio.google.com/app/apikey) que conoce tus números del mes y da consejos de ahorro. Se activa pegando tu API Key en Ajustes.

### Sincronización y respaldo
- **Google Cloud Firebase** (opcional) o **modo local** sin cuenta.
- **Exportar JSON / CSV** y **restaurar respaldo** (con validación del archivo). En Android el archivo se abre en la hoja de compartir (Drive, correo, WhatsApp…).

---

## Cómo funciona

### 1. Desarrollo web
```bash
npm install
npm run dev
```
Abre `http://localhost:5173`.

### 2. Android nativo
```bash
npm install
npx cap sync
npx cap open android
```
En Android Studio, conecta tu celular con **Depuración USB** activada y presiona **Run app** (▶).

---

## Arquitectura técnica

Tecnologías web sin frameworks ni bundler:

- **Frontend:** Vanilla JS (un único script clásico `www/app.js`), HTML5, CSS3
- **Gráficos:** [Chart.js](https://www.chartjs.org/) 4, incluido localmente en `www/vendor/` para funcionar sin conexión
- **Backend/Sync:** [Firebase](https://firebase.google.com/) (Auth + Firestore)
- **IA:** [Google Gemini API](https://aistudio.google.com/app/apikey)
- **Mobile Wrapper:** [Capacitor](https://capacitorjs.com/) 5 con `@capacitor/app`, `@capacitor/haptics`, `@capacitor/local-notifications`, `@capacitor/filesystem`, `@capacitor/share` y `@capacitor-firebase/authentication` (login de Google nativo)
- **Widget Android:** `BalanceWidgetProvider` + plugin local `WidgetBridge` (Java)
- **PWA:** Service Worker + Manifest

---

## Configuración del desarrollador

### Activar Firebase (Sincronización en la nube)
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Agrega una app Web y copia las credenciales.
3. Pégalas en `www/app.js` reemplazando `FIREBASE_CONFIG`.
4. Activa **Firestore Database** y **Authentication** (método Google).
5. **Android:** Google bloquea el login dentro del WebView, así que la app usa Google Sign-In nativo. Agrega una app Android con el paquete `com.finanflow.app`, registra la huella SHA-1 (`cd android && ./gradlew signingReport`; la de debug y la de la llave de release son distintas) y descarga `google-services.json` en `android/app/`. **Sin ese archivo la app Android se cierra al abrir.**

### Activar FinanBot (Asistente de IA)
1. Obtén una API Key gratuita en [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Pégala en **Ajustes → FinanBot** dentro de la app (se guarda solo en el dispositivo).

---

## Roadmap

- [x] App Shortcuts nativos de Android
- [x] Comparativa mensual
- [x] Recordatorios y alertas
- [x] Widget de pantalla de inicio
- [x] Movimientos recurrentes
- [ ] Categorías personalizadas
- [ ] Varias cuentas / billeteras
- [ ] Metas de ahorro
- [ ] Soporte para adjuntar fotos de recibos
- [ ] Exportación a PDF

---

## Licencia

MIT - Libre para usar, modificar y distribuir.

---

**Desarrollado con amor** ❤️  
*Privacidad 100% garantizada. Tus datos son tuyos.*
