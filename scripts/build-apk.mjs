// Compila el APK firmado de release y lo deja en la raíz como FinanFlow-<versión>.apk.
//   npm run apk
// Requiere android/keystore.properties (ver "APK firmado" en el README) y JDK 17: si JAVA_HOME no
// está definido, usa el que trae Android Studio.
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

if (!existsSync("android/keystore.properties")) {
  console.log("Falta android/keystore.properties con la llave de firma.");
  console.log('Sigue los pasos de "APK firmado" en el README y vuelve a ejecutar: npm run apk');
  process.exitCode = 1;
} else {
  const env = { ...process.env };
  if (!env.JAVA_HOME) {
    const studioJdk = ["C:\\Program Files\\Android\\Android Studio\\jbr", "/Applications/Android Studio.app/Contents/jbr/Contents/Home"].find(existsSync);
    if (studioJdk) env.JAVA_HOME = studioJdk;
  }
  run("npx cap sync android");
  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  run(`${gradlew} assembleRelease`, { cwd: "android", env });

  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const apk = join("android", "app", "build", "outputs", "apk", "release", "app-release.apk");
  const out = `FinanFlow-${version}.apk`;
  copyFileSync(apk, out);
  console.log(`\nListo: ${out}. Pásalo al celular e instálalo (permite "instalar apps desconocidas" la primera vez).`);
}
