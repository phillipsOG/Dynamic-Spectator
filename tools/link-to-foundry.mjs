// @ts-check
/**
 * Dev helper: symlink (or copy, on failure) this repo into your Foundry
 * `Data/modules/dynamic-spectator` so you can iterate without re-installing.
 *
 * Usage:
 *   FOUNDRY_DATA="C:/Users/you/AppData/Local/FoundryVTT/Data" npm run link
 *   # or pass the path directly:
 *   node tools/link-to-foundry.mjs "C:/Users/you/AppData/Local/FoundryVTT/Data"
 *
 * The module's manifest points `esmodules` at `dist/dynamic-spectator.js`, so run
 * `npm run build` (or `npm run watch`) alongside this.
 */
import { existsSync, mkdirSync, symlinkSync, rmSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";

const MODULE_ID = "dynamic-spectator";

const dataPath = process.argv[2] ?? process.env.FOUNDRY_DATA;
if (!dataPath) {
  console.error(
    "No Foundry data path given. Pass it as an argument or set FOUNDRY_DATA.\n" +
      'e.g. node tools/link-to-foundry.mjs "C:/Users/you/AppData/Local/FoundryVTT/Data"'
  );
  process.exit(1);
}

const modulesDir = join(dataPath, "modules");
if (!existsSync(modulesDir)) {
  console.error(`Modules directory not found: ${modulesDir}`);
  process.exit(1);
}

const source = resolve(process.cwd());
const target = join(modulesDir, MODULE_ID);

if (existsSync(target)) {
  console.log(`Removing existing ${target}`);
  rmSync(target, { recursive: true, force: true });
}

try {
  symlinkSync(source, target, "junction"); // "junction" works without admin on Windows
  console.log(`Linked ${source} → ${target}`);
} catch (err) {
  console.warn("Symlink failed, copying instead:", err instanceof Error ? err.message : err);
  mkdirSync(target, { recursive: true });
  for (const dir of ["dist", "styles", "templates", "lang", "assets"]) {
    const from = join(source, dir);
    if (existsSync(from)) cpSync(from, join(target, dir), { recursive: true });
  }
  cpSync(join(source, "module.json"), join(target, "module.json"));
  console.log(`Copied module files → ${target}`);
}
console.log("Done. Enable 'Dynamic Spectator' in Foundry's module manager.");
