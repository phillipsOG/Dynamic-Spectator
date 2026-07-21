// @ts-check
/**
 * esbuild bundler for the Dynamic Spectator module.
 *
 * Foundry loads a single ESM entry point declared in module.json (`esmodules`).
 * We bundle `src/module.ts` and all of its imports into `dist/dynamic-spectator.js`.
 *
 * Type-checking is handled separately by `tsc --noEmit` (see the `build` script)
 * so that esbuild stays fast and the type layer can be as strict as we like without
 * slowing bundling.
 */
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/module.ts"],
  outfile: "dist/dynamic-spectator.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "browser",
  sourcemap: true,
  legalComments: "none",
  logLevel: "info",
  // Foundry ships its own PIXI + Handlebars on the global scope. Never bundle them.
  external: ["pixi.js", "handlebars"],
  banner: {
    js: "/* Dynamic Spectator — bundled by esbuild. Source: https://github.com/phillipsOG/Dynamic-Spectator */"
  }
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("[dynamic-spectator] watching for changes…");
} else {
  await esbuild.build(options);
  console.log("[dynamic-spectator] build complete → dist/dynamic-spectator.js");
}
