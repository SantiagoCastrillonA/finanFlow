// Copia local de lo que antes venía de CDNs, para que la app funcione sin conexión:
// - Material Symbols Rounded recortada a los íconos que usa la app.
// - Firebase compat (app, auth, firestore).
//
//   node scripts/vendor-assets.mjs           descarga todo de nuevo
//   node scripts/vendor-assets.mjs --check   solo avisa si falta algún ícono en la fuente local
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const FIREBASE_VERSION = "10.8.0";
const FIREBASE_FILES = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];
const CODEPOINTS_URL =
  "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints";
// Google Fonts entrega woff2 solo a navegadores modernos.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FONT_DIR = "www/vendor/fonts";
const ICON_LIST = `${FONT_DIR}/icons.txt`;

async function get(url, as = "text") {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} al descargar ${url}`);
  return as === "buffer" ? Buffer.from(await res.arrayBuffer()) : res.text();
}

/** Íconos usados: textos de <span class="ms">…</span> y literales de JS que sean un nombre de ícono. */
function usedIcons(valid) {
  const sources = ["www/app.js", "www/index.html"].map((f) => readFileSync(f, "utf8"));
  const found = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(/class="[^"]*\bms\b[^"]*"[^>]*>([a-z0-9_]+)</g)) found.add(m[1]);
    for (const m of src.matchAll(/["'`]([a-z0-9_]{2,40})["'`]/g)) found.add(m[1]);
  }
  return [...found].filter((n) => valid.has(n)).sort();
}

const codepoints = await get(CODEPOINTS_URL);
const valid = new Set(codepoints.split("\n").map((l) => l.split(" ")[0]).filter(Boolean));
const icons = usedIcons(valid);

// process.exitCode en vez de process.exit(): en Windows, salir con una descarga aún abierta hace fallar a Node.
if (process.argv.includes("--check")) {
  let have = new Set();
  try {
    have = new Set(readFileSync(ICON_LIST, "utf8").split("\n").filter(Boolean));
  } catch {}
  const missing = icons.filter((i) => !have.has(i));
  if (missing.length) {
    console.log(`Faltan ${missing.length} íconos en la fuente local: ${missing.join(", ")}`);
    console.log("Ejecuta: npm run vendor");
    process.exitCode = 1;
  } else {
    console.log(`Fuente de íconos al día (${icons.length} íconos).`);
  }
} else {
  await download();
}

async function download() {
  mkdirSync(FONT_DIR, { recursive: true });
  const css = await get(
    `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${icons.join(",")}&display=block`
  );
  const fontUrl = (css.match(/url\((https:[^)]+)\)\s*format\(['"]woff2['"]\)/) || [])[1];
  if (!fontUrl) throw new Error("Google Fonts no devolvió una fuente woff2");
  const font = await get(fontUrl, "buffer");
  writeFileSync(`${FONT_DIR}/material-symbols-rounded.woff2`, font);
  writeFileSync(ICON_LIST, icons.join("\n") + "\n");
  console.log(`Íconos: ${icons.length} (${Math.round(font.length / 1024)} KB)`);

  mkdirSync("www/vendor/firebase", { recursive: true });
  for (const file of FIREBASE_FILES) {
    const js = await get(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/${file}`);
    writeFileSync(`www/vendor/firebase/${file}`, js);
    console.log(`Firebase: ${file} (${Math.round(js.length / 1024)} KB)`);
  }
}
