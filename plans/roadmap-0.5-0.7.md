# Hoja de ruta FinanFlow 0.4.1 → 0.7.0

Estado: **propuesto, sin aprobar** (regla de `AGENT.md`: se ejecuta por fases y se confirma antes de cada una).
Base: commit `fce6e2f` (rama `feat/v0.2.0`, versión 0.4.0).
Restricción: **costo $0**. Todo funciona en el plan Spark de Firebase; nada usa Cloud Functions, Storage ni servicios de pago.

| Fase | Versión | Contenido | Tamaño |
|---|---|---|---|
| A | 0.4.1 | Correcciones: borrar datos en la nube, íconos y Firebase sin conexión, `main` al día | Pequeña |
| B | 0.5.0 | Cuentas, tarjeta de crédito con deuda y fecha de pago, transferencias | Grande |
| C | 0.5.1 | Metas de ahorro (sobre el modelo de cuentas) | Mediana |
| D | 0.6.0 | Recurrentes quincenales y semanales, "Próximos pagos", ocultar categorías base | Mediana |
| E | 0.6.1 | Resumen anual, búsqueda por rango de fechas, exportar lo filtrado | Mediana |
| F | 0.7.0 | Bloqueo con huella o PIN del celular y APK firmado (solo Android) | Mediana |

---

## Fase A — Correcciones (0.4.1)

**A1. "Borrar todos los datos" también en la nube.**
- Hoy, con sesión iniciada, solo limpia el teléfono y la nube los devuelve.
- Con sesión: borrar `users/{uid}/{transactions,budgets,categories}` en lotes (`db.batch()`, máx. 500 por lote). El Hogar **no** se toca, porque es compartido; el diálogo lo dice.
- El texto del diálogo cambia según el modo: "de este dispositivo" o "de tu cuenta en la nube".

**A2. Funcionar sin conexión de verdad.**
- Material Symbols: descargar la fuente recortada a los íconos que usa la app (Google Fonts acepta `&icon_names=`). Va en `www/vendor/fonts/` con su `@font-face` en `styles.css`, y se quita el `<link>` a Google Fonts.
- Firebase compat (`app`, `auth`, `firestore` 10.8.0): copiar los 3 archivos a `www/vendor/firebase/` y cargarlos de ahí.
- Agregar fuente y Firebase a `ASSETS` en `sw.js`.
- Comprobación: script `npm run check-icons` que busca en `app.js` e `index.html` los íconos usados y avisa si alguno no está en la fuente recortada. Así, al agregar un ícono nuevo, sabes que hay que regenerarla.

**A3. Llevar el trabajo a `main`.**
- PR `feat/v0.2.0 → main` en GitHub.
- Solo se hace merge con tu confirmación.

---

## Fase B — Cuentas y tarjeta de crédito (0.5.0)

**Idea:** el "Método" de cada movimiento pasa a ser una **cuenta**. Las cuentas son opcionales: mientras no actives ninguna, la app se comporta exactamente como hoy.

**Modelo de datos**
- Subcolección `accounts` por espacio. Las reglas actuales ya la cubren.
- Campos: `{ ref, id, name, kind: "cash" | "bank" | "card", icon, color, startDate, startBalance, cutoffDay?, dueDay?, creditLimit? }`.
- El `id` de una cuenta es el texto que ya se guarda en `tx.method` ("Efectivo", "Tarjeta de Crédito"…) o el nombre de una cuenta nueva. **Los movimientos existentes no se migran.**
- Saldo de una cuenta = `startBalance` + movimientos con `method === id` y fecha ≥ `startDate`. Así, las compras viejas con tarjeta no aparecen de golpe como deuda.
- **Transferencia:** un movimiento con `kind: "transfer"`, `from` y `to`. `countsAsMoney()` la excluye, igual que hoy a "Saldar cuentas".
  - Pagar la tarjeta es una transferencia de "Cuenta bancaria" a "Visa". Baja el banco, baja la deuda y no es un gasto.
  - Reemplaza el truco de la categoría "Tarjeta de crédito" con "No sumar en totales", que sigue funcionando para quien prefiera usarlo.

**Interfaz**
- **Ajustes → Cuentas:** activar una cuenta base o crear una nueva, con saldo inicial (o deuda actual), día de corte y día de pago.
- **Hoja de movimiento:** el selector "Método" muestra las cuentas. Un tercer segmento **"Transferir"** ofrece De → A y el monto.
- **Inicio:** el "Saldo" total no cambia (ingresos − gastos), y debajo aparece el desglose "Disponible $X · Tarjetas −$Y".
- **Tarjeta de cada tarjeta:**
  - "Debes $X · paga antes del 5 de nov".
  - Barra de cupo usado si definiste un cupo.
- **Aviso nativo** (Android, ids 400+): 3 días antes y el mismo día del pago, si la tarjeta tiene deuda. En el iPhone no hay avisos, porque la web instalada no puede programarlos sin servidor.

**Datos financieros:** los totales mensuales, los gráficos y los límites no cambian. Solo se agregan los saldos por cuenta. Las transferencias nunca suman como gasto ni como ingreso.

---

## Fase C — Metas de ahorro (0.5.1)

- Una meta es una cuenta con `kind: "goal"`, más `target` y `deadline?`.
- Aportar es una transferencia de una cuenta a la meta, y retirar es lo contrario. Así se reutiliza todo lo de la Fase B, sin cálculos nuevos.
- **Inicio:** tarjeta "Metas" con barra de avance y "Aparta $X al mes para llegar a tiempo", que se calcula como restante ÷ meses que faltan.
- **En el Hogar:** metas compartidas, donde ambos aportan y cada aporte muestra quién lo hizo.
- El desglose del saldo agrega "Ahorrado en metas $Z".

---

## Fase D — Recurrentes y próximos pagos (0.6.0)

**D1. Frecuencias.** `recurring` acepta tres valores; los movimientos ya guardados como `"monthly"` siguen igual.

| Valor | Cuándo se crea | Id de cada copia |
|---|---|---|
| `"monthly"` | Una vez al mes | `${id}-${YYYY-MM}` |
| `"biweekly"` | Quincenal: día 15 y último día del mes | `${id}-${YYYY-MM}-q1` / `-q2` |
| `"weekly"` | Cada semana | `${id}-${YYYY-MM-DD}` |

- Las copias son idempotentes.
- `skipMonths` pasa a `skipKeys`, que guarda el sufijo de cada copia. Se sigue leyendo `skipMonths` de las plantillas viejas.

**D2. "Próximos pagos" en Inicio:**
- Muestra los próximos 7 días: recurrentes por crearse y fechas de pago de tarjetas.
- Al tocar uno, se abre para registrarlo o editarlo.

**D3. Ocultar categorías base.**
- En Ajustes → Categorías también aparecen las categorías base, con un interruptor "Mostrar". "Otros" no se puede ocultar.
- Se guarda como `{ ref: "base-<id>", id, type, hidden: true }` en la misma subcolección `categories`.
- Ocultar solo la quita de la cuadrícula: los movimientos viejos siguen mostrando su nombre e ícono.

---

## Fase E — Resumen y búsqueda (0.6.1)

**E1. Resumen del año:** una hoja que se abre desde Inicio con "Ver resumen". Se calcula con `monthStats` y no requiere datos nuevos.
- Barras de ingresos y gastos de los últimos 12 meses (Chart.js).
- Promedio mensual de gasto.
- Top 5 categorías del año.
- Categoría que más creció contra el mes anterior.

**E2. Rango de fechas en el Historial:** chip "Rango…", que abre una hoja con Desde y Hasta. Filtro `r:YYYY-MM-DD:YYYY-MM-DD`.

**E3. Exportar lo filtrado:** botón "Exportar estos movimientos (CSV)" en el Historial, que respeta los filtros y la búsqueda.

---

## Fase F — Android: bloqueo y APK firmado (0.7.0)

**F1. Bloqueo al abrir.**
- Usa la huella, la cara o el PIN del celular, mediante un plugin de biometría compatible con Capacitor 5. Antes de instalarlo hay que verificar la versión exacta y que no tenga costo.
- La app no guarda ningún PIN propio.
- Pide desbloquear al abrir y al volver después de más de 1 minuto en segundo plano.
- Interruptor en Ajustes. En la PWA del iPhone no aparece.

**F2. APK firmado (sin Play Store, gratis).**
- Llave de firma creada con `keytool` (JDK 17) **fuera del repositorio**. Las contraseñas van en `android/keystore.properties`, que se agrega a `.gitignore`.
- `signingConfig` de release en `android/app/build.gradle` y script `npm run apk` (`cap sync` + `assembleRelease`).
- **Tú:** registrar la huella SHA-1 de la llave de release en la consola de Firebase y volver a descargar `google-services.json`. Sin eso, el login con Google falla en el APK de release.
- **Tú:** guardar una copia de la llave (por ejemplo en Drive). Si se pierde, para actualizar habría que desinstalar la app. Los datos de la nube no se pierden; los que estén solo en el teléfono, sí.

---

## Riesgos generales

- **La Fase B es la más grande.** Cambia la hoja de movimiento y el Inicio. Las cuentas son opcionales para que nadie vea números distintos sin haberlas activado.
- **iPhone:** no recibe avisos de pago de tarjeta (limitación de la web instalada; resolverlo requeriría servidor, es decir, Blaze). Todo lo demás funciona igual.
- **Fuente de íconos recortada:** si se agrega un ícono que no está en la fuente, se ve como texto. `npm run check-icons` lo detecta.
- **Plugin de biometría:** es una dependencia de terceros. Si no hay una versión estable para Capacitor 5, se pospone F1 sin afectar lo demás.
- **Pruebas:** la lógica de dinero (saldos por cuenta, transferencias, copias recurrentes) se prueba en el navegador con datos de demostración. El bloqueo, los avisos y el APK se prueban en tu Android.
