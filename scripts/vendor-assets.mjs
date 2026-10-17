// Copia local de lo que antes venía de CDNs, para que la app funcione sin conexión:
// - Material Symbols Rounded recortada a los íconos que usa la app.
// - Firebase compat (app, auth, firestore).
// - Logos de marcas (Simple Icons, CC0) en www/vendor/brands.js.
// - Manrope (OFL), variable y solo latín, para títulos y cifras grandes.
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
const SIMPLE_ICONS_VERSION = "16.30.0";

// Marcas que la app reconoce. `slug` = logo de Simple Icons; las que Simple Icons no tiene llevan un
// monograma (`mono`) sobre su color. `keys` = palabras (minúsculas, sin tildes) que la detectan en la nota,
// el comercio o el nombre de la categoría.
const BRANDS = [
  // Suscripciones y entretenimiento
  { slug: "spotify", keys: ["spotify"] },
  { slug: "netflix", keys: ["netflix"] },
  { slug: "youtubemusic", keys: ["youtube music"] },
  { slug: "youtube", keys: ["youtube", "yt premium"] },
  { id: "disneyplus", title: "Disney+", hex: "113CCF", mono: "D+", keys: ["disney"] },
  { id: "primevideo", title: "Prime Video", hex: "00A8E1", mono: "P", keys: ["prime video", "amazon prime"] },
  { slug: "hbomax", keys: ["hbo", "hbo max"] },
  { slug: "paramountplus", keys: ["paramount"] },
  { slug: "crunchyroll", keys: ["crunchyroll"] },
  { slug: "dazn", keys: ["dazn"] },
  { slug: "twitch", keys: ["twitch"] },
  { slug: "deezer", keys: ["deezer"] },
  { slug: "tidal", keys: ["tidal"] },
  { slug: "audible", keys: ["audible"] },
  { slug: "appletv", keys: ["apple tv"] },
  { slug: "applemusic", keys: ["apple music"] },
  { slug: "icloud", keys: ["icloud"] },
  { slug: "apple", keys: ["apple", "app store"] },
  { slug: "googleplay", keys: ["google play"] },
  { slug: "google", keys: ["google", "google one"] },
  { slug: "playstation", keys: ["playstation", "psn", "ps plus"] },
  { id: "xbox", title: "Xbox", hex: "107C10", mono: "X", keys: ["xbox", "game pass"] },
  { slug: "steam", keys: ["steam"] },
  { id: "chatgpt", title: "ChatGPT", hex: "10A37F", mono: "AI", keys: ["chatgpt", "openai"] },
  { slug: "claude", keys: ["claude", "anthropic"] },
  { id: "canva", title: "Canva", hex: "00C4CC", mono: "C", keys: ["canva"] },
  { id: "adobe", title: "Adobe", hex: "FA0F00", mono: "A", keys: ["adobe"] },
  { slug: "duolingo", keys: ["duolingo"] },
  { slug: "dropbox", keys: ["dropbox"] },
  { slug: "notion", keys: ["notion"] },
  { slug: "github", keys: ["github"] },
  { slug: "patreon", keys: ["patreon"] },
  { slug: "tinder", keys: ["tinder"] },
  { slug: "instagram", keys: ["instagram"] },
  { slug: "whatsapp", keys: ["whatsapp"] },
  { slug: "tiktok", keys: ["tiktok"] },
  // Transporte
  { slug: "ubereats", keys: ["uber eats"] },
  { slug: "uber", keys: ["uber"] },
  { id: "didi", title: "DiDi", hex: "FC4C02", mono: "D", keys: ["didi"] },
  { id: "indrive", title: "inDrive", hex: "C1F11D", mono: "iD", keys: ["indrive", "indriver"] },
  { id: "cabify", title: "Cabify", hex: "7145D6", mono: "C", keys: ["cabify"] },
  { slug: "waze", keys: ["waze"] },
  { slug: "shell", keys: ["shell"] },
  { id: "terpel", title: "Terpel", hex: "E30613", mono: "T", keys: ["terpel"] },
  // Comida y mercado
  { id: "rappi", title: "Rappi", hex: "FF441F", mono: "R", keys: ["rappi", "rappicard", "rappipay"] },
  { slug: "mcdonalds", keys: ["mcdonalds", "mcdonald", "mc donalds"] },
  { slug: "starbucks", keys: ["starbucks"] },
  { slug: "burgerking", keys: ["burger king"] },
  { slug: "kfc", keys: ["kfc"] },
  { id: "dominos", title: "Domino's", hex: "006491", mono: "D", keys: ["dominos", "domino s"] },
  { id: "subway", title: "Subway", hex: "008C15", mono: "S", keys: ["subway"] },
  { id: "juanvaldez", title: "Juan Valdez", hex: "8B5A2B", mono: "JV", keys: ["juan valdez"] },
  { id: "exito", title: "Éxito", hex: "FFE000", mono: "É", keys: ["exito"] },
  { id: "d1", title: "D1", hex: "E30613", mono: "D1", keys: ["d1"] },
  { id: "ara", title: "Ara", hex: "E4002B", mono: "A", keys: ["ara"] },
  { id: "mercadolibre", title: "Mercado Libre", hex: "FFE600", mono: "ML", keys: ["mercado libre", "mercadolibre"] },
  { slug: "mercadopago", keys: ["mercado pago", "mercadopago"] },
  { id: "amazon", title: "Amazon", hex: "FF9900", mono: "a", keys: ["amazon"] },
  { slug: "aliexpress", keys: ["aliexpress"] },
  { id: "temu", title: "Temu", hex: "FB7701", mono: "T", keys: ["temu"] },
  { id: "shein", title: "Shein", hex: "000000", mono: "S", keys: ["shein"] },
  { slug: "ikea", keys: ["ikea"] },
  { slug: "zara", keys: ["zara"] },
  { slug: "adidas", keys: ["adidas"] },
  { slug: "nike", keys: ["nike"] },
  { slug: "samsung", keys: ["samsung"] },
  { slug: "airbnb", keys: ["airbnb"] },
  { slug: "bookingdotcom", keys: ["booking"] },
  { id: "smartfit", title: "Smart Fit", hex: "FFC20E", mono: "SF", keys: ["smart fit", "smartfit"] },
  // Telefonía y bancos
  { id: "claro", title: "Claro", hex: "DA291C", mono: "C", keys: ["claro"] },
  { slug: "movistar", keys: ["movistar"] },
  { id: "tigo", title: "Tigo", hex: "00377B", mono: "T", keys: ["tigo"] },
  { slug: "nubank", keys: ["nubank", "nu"] },
  { id: "nequi", title: "Nequi", hex: "DA0081", mono: "N", keys: ["nequi"] },
  { id: "davivienda", title: "Davivienda", hex: "ED1C24", mono: "D", keys: ["davivienda", "daviplata"] },
  { id: "bancolombia", title: "Bancolombia", hex: "FDDA24", mono: "B", keys: ["bancolombia"] },
  { slug: "paypal", keys: ["paypal"] }
];
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
    have = new Set(readFileSync(ICON_LIST, "utf8").split(/\r?\n/).filter(Boolean)); // git puede dejarlo con CRLF
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

  await downloadBrands();
  await downloadManrope();
}

/** www/vendor/fonts/manrope.woff2: Manrope variable (500–800), solo el bloque latino (incluye á, ñ, ¿, ¡). */
async function downloadManrope() {
  const css = await get("https://fonts.googleapis.com/css2?family=Manrope:wght@500..800&display=swap");
  const latin = css.split("/* latin */")[1];
  const fontUrl = latin && (latin.match(/url\((https:[^)]+)\)\s*format\(['"]woff2['"]\)/) || [])[1];
  if (!fontUrl) throw new Error("Google Fonts no devolvió Manrope latín en woff2");
  const font = await get(fontUrl, "buffer");
  writeFileSync(`${FONT_DIR}/manrope.woff2`, font);
  console.log(`Manrope: ${Math.round(font.length / 1024)} KB`);
}

/** www/vendor/brands.js: window.BRANDS = [{ id, title, hex, path | mono, keys }]. */
async function downloadBrands() {
  const base = `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}`;
  const data = JSON.parse(await get(`${base}/data/simple-icons.json`));
  const list = Array.isArray(data) ? data : data.icons;
  const out = [];
  for (const b of BRANDS) {
    if (!b.slug) {
      out.push({ id: b.id, title: b.title, hex: b.hex, mono: b.mono, keys: b.keys });
      continue;
    }
    const info = list.find((i) => i.slug === b.slug);
    if (!info) throw new Error(`Simple Icons ya no tiene "${b.slug}"`);
    const svg = await get(`${base}/icons/${b.slug}.svg`);
    const path = (svg.match(/<path d="([^"]+)"/) || [])[1];
    if (!path) throw new Error(`Sin path en ${b.slug}.svg`);
    out.push({ id: b.slug, title: info.title, hex: info.hex, path, keys: b.keys });
  }
  const js =
    `// Generado por scripts/vendor-assets.mjs (npm run vendor). Logos de Simple Icons ${SIMPLE_ICONS_VERSION} (CC0);\n` +
    "// las marcas son de sus dueños y se muestran solo para reconocer el gasto.\n" +
    `window.BRANDS = ${JSON.stringify(out)};\n`;
  writeFileSync("www/vendor/brands.js", js);
  console.log(`Marcas: ${out.length} (${Math.round(js.length / 1024)} KB)`);
}
