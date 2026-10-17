# 009 — Ícono "Barras" en Android, notificaciones, pantalla de carga y PWA

- **Status**: REEMPLAZADO por la Fase B de `plans/roadmap-identidad.md` (ícono "Moneda de oro", 0.11.1)
- **Commit**: 20d9993 (+ cambios v0.2.1 sin commit)
- **Severity**: MEDIUM
- **Category**: Marca (fuera del catálogo de animación; pedido por el usuario)
- **Estimated scope**: recursos de Android y PWA; ~25 archivos generados

## Problem

El ícono actual es el de la plantilla anterior. El usuario eligió el concepto C: tres barras redondeadas blancas, de altura creciente y con opacidad 0.6 / 0.8 / 1, sobre índigo `#5E5CE6`.

## Target

Geometría de referencia (viewBox 108×108, la del ícono adaptativo; zona segura = círculo de 66 dp centrado):
```svg
<rect x="31" y="56" width="11" height="22" rx="5.5" fill="#fff" fill-opacity="0.6"/>
<rect x="48.5" y="44" width="11" height="34" rx="5.5" fill="#fff" fill-opacity="0.8"/>
<rect x="66" y="30" width="11" height="48" rx="5.5" fill="#fff"/>
```
- `assets/icon.svg`: fuente con fondo índigo de esquinas redondeadas (para documentación y generar PNG).
- Android 8+: `res/drawable/ic_launcher_foreground.xml` (vector con las barras), `values/ic_launcher_background.xml` = `#5E5CE6`, `mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml` con `background`, `foreground` y `monochrome` (`@drawable/ic_launcher_monochrome`, las barras en negro opaco).
- Borrar `drawable-v24/ic_launcher_foreground.xml` y `mipmap-*/ic_launcher_foreground.png` (sustituidos por el vector).
- Android 5–7: PNG `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png` (48/72/96/144/192 px, cuadrado redondeado) e `ic_launcher_round.png` (círculo).
- Notificación: `drawable/ic_stat_finanflow.xml` con la silueta de las tres barras en blanco.
- Pantalla de carga: `splash.png` (todas las densidades y orientaciones) regenerados con fondo `#5E5CE6` y las barras centradas, manteniendo el tamaño de cada archivo actual.
- PWA: `www/icons/icon-192.png` y `icon-512.png` a sangre completa (sin esquinas: el sistema aplica la máscara), y en `manifest.json` `"purpose": "any maskable"`.

## Steps

1. Escribir `assets/icon.svg`, `assets/icon-foreground.svg` y `assets/icon-round.svg`.
2. Escribir los XML de Android.
3. Generar los PNG con un script de Node en la carpeta de borrador usando `@resvg/resvg-js` (instalado ahí, no en el proyecto), leyendo los tamaños de los `splash.png` existentes.
4. `npx cap sync android` y `./gradlew assembleDebug`.

## Boundaries

- No cambiar el nombre de la app ni el `appId`.

## Verification

- **Mechanical**: `assembleDebug` termina con `BUILD SUCCESSFUL`.
- **Visual**: abrir los PNG generados; en el celular, el ícono aparece índigo con barras, el ícono temático de Android 13 se tiñe, y la notificación muestra las barras.
- **Done when**: no queda ningún recurso con el ícono anterior.
