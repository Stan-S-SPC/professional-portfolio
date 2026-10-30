// Build du plugin : bundle JS (esbuild) + feuille de style avec la police pixel embarquée.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
mkdirSync(out, { recursive: true });

export function buildStyles() {
	const font = readFileSync(join(root, "node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2")).toString("base64");
	const face = `/* Police « Press Start 2P » (SIL OFL 1.1) — voir OFL.txt */
@font-face { font-family: "Press Start 2P"; font-style: normal; font-weight: 400; font-display: swap;
  src: url(data:font/woff2;base64,${font}) format("woff2"); }`;
	return readFileSync(join(root, "src/styles.css"), "utf8").replace("/*__FONT_FACE__*/", face);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await build({
		entryPoints: [join(root, "src/main.ts")],
		bundle: true,
		outfile: join(out, "main.js"),
		format: "cjs",
		target: "es2020",
		platform: "browser",
		external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
		sourcemap: false,
		minify: false,
		logLevel: "info",
		legalComments: "none",
	});
	writeFileSync(join(out, "styles.css"), buildStyles());
	writeFileSync(join(out, "manifest.json"), readFileSync(join(root, "manifest.json")));
	console.log("→ dist/main.js, dist/styles.css, dist/manifest.json");
}
