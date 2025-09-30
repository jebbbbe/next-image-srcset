import esbuild from "esbuild";
import pkg from "./package.json" with { type: "json" };

const externals = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {})
];

for (const format of ["esm", "cjs"]) {
  esbuild.build({
    entryPoints: ["src/node/index.js"],
    platform: "node",
    bundle: true,
    format,
    outfile: `dist/node/index.${format === "esm" ? "mjs" : "cjs"}`,
    external: externals,
  }).catch(() => process.exit(1));
}
