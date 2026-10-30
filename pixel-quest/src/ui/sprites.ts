/*
 * Sprites pixel art dessinés en code (grilles de caractères 16×16 + palette).
 * Palette de base : Sweetie 16 (GrafxKid, domaine public).
 * Aucun fichier image : tout est rendu sur <canvas> sans lissage.
 */
import type { ClassId } from "../engine/rules.ts";

export const SIZE = 16;
export type Grid = string[];

export const COLORS: Record<string, string> = {
	O: "#1a1c2c", // contour
	F: "#f2c9a5", // peau
	H: "#566c86", // cheveux
	B: "#333c57", // bottes
	W: "#f4f4f4",
	S: "#94b0c2",
	s: "#566c86",
	n: "#a05a2c", // bois
	Y: "#ffcd75",
	E: "#ef7d57",
	R: "#b13e53",
	P: "#5d275d",
	G: "#a7f070",
	g: "#38b764",
	t: "#257179",
	d: "#29366f",
	b: "#3b5dc9",
	l: "#41a6f6",
	c: "#73eff7",
	k: "#333c57",
};

interface ClassLook {
	a: string; // tenue
	A: string; // tenue sombre
	x: string; // accent
	H: string; // cheveux
}

const LOOKS: Record<ClassId | "none", ClassLook> = {
	batisseur: { a: "#ef7d57", A: "#b13e53", x: "#ffcd75", H: "#5d275d" },
	erudit: { a: "#3b5dc9", A: "#29366f", x: "#ffcd75", H: "#333c57" },
	diplomate: { a: "#38b764", A: "#257179", x: "#ffcd75", H: "#a05a2c" },
	stratege: { a: "#b13e53", A: "#5d275d", x: "#ffcd75", H: "#1a1c2c" },
	sage: { a: "#f4f4f4", A: "#94b0c2", x: "#41a6f6", H: "#94b0c2" },
	none: { a: "#94b0c2", A: "#566c86", x: "#f4f4f4", H: "#566c86" },
};

/* ------------------------------------------------------------------ */
/* Outils de grille                                                    */
/* ------------------------------------------------------------------ */

const blank = (): string[][] => Array.from({ length: SIZE }, () => Array<string>(SIZE).fill("."));

function stamp(grid: string[][], map: readonly string[], x: number, y: number): void {
	map.forEach((row, dy) => {
		[...row].forEach((ch, dx) => {
			const gx = x + dx;
			const gy = y + dy;
			if (ch !== "." && ch !== " " && gx >= 0 && gx < SIZE && gy >= 0 && gy < SIZE) grid[gy]![gx] = ch;
		});
	});
}

function plot(grid: string[][], pixels: readonly (readonly [number, number, string])[]): void {
	for (const [x, y, ch] of pixels) if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y]![x] = ch;
}

const toRows = (grid: string[][]): Grid => grid.map((r) => r.join(""));

/** Duplique une demi-sprite (colonne 0 = bord gauche) pour obtenir une figure symétrique. */
export function mirror(half: readonly string[]): string[] {
	return half.map((row) => row + [...row].reverse().join(""));
}

/** Place un contenu (≤ 14×14) en bas au centre de la grille 16×16 et lui ajoute un contour d'un pixel. */
export function outlined(content: readonly string[]): Grid {
	const h = content.length;
	const w = Math.max(...content.map((r) => r.length));
	const x0 = Math.floor((SIZE - w) / 2);
	const y0 = 14 - h + 1;
	const grid = blank();
	stamp(grid, content, x0, y0);
	const filled = (x: number, y: number): boolean => x >= 0 && x < SIZE && y >= 0 && y < SIZE && grid[y]![x] !== ".";
	const edge: [number, number][] = [];
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			if (grid[y]![x] === "." && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) edge.push([x, y]);
		}
	}
	for (const [x, y] of edge) grid[y]![x] = "O";
	return toRows(grid);
}

/* ------------------------------------------------------------------ */
/* Héros                                                               */
/* ------------------------------------------------------------------ */

const HERO_BASE: readonly string[] = [
	"................",
	".....OOOOOO.....",
	"....OHHHHHHO....",
	"...OHHHHHHHHO...",
	"...OHHFFFFHHO...",
	"...OHFOFFOFHO...",
	"...OFFFFFFFFO...",
	"....OFFFFFFO....",
	"...OOOaaaaOOO...",
	"..OaaaaxxaaaaO..",
	"..OFOaaaaaaOFO..",
	"...OOaaaaaaOO...",
	"....OAAAAAAO....",
	"....OAAOOAAO....",
	"...OBBO..OBBO...",
	"................",
];

/** Objet tenu par chaque classe, posé à droite du héros. */
const ITEMS: Record<ClassId, { x: number; y: number; map: readonly string[] }> = {
	batisseur: { x: 13, y: 7, map: ["SSS", "SsS", "SSS", ".n.", ".n.", ".n.", ".n."] },
	erudit: { x: 13, y: 9, map: ["lll", "lWl", "lWl", "lll"] },
	diplomate: { x: 13, y: 8, map: ["YYY", "WWW", "WRW", "WWW", "YYY"] },
	stratege: { x: 13, y: 5, map: [".W.", ".S.", ".W.", ".S.", ".W.", "YYY", ".n."] },
	sage: { x: 13, y: 5, map: [".c.", "cWc", ".c.", ".n.", ".n.", ".n.", ".n.", ".n."] },
};

export interface SpriteArt {
	grid: Grid;
	colors: Record<string, string>;
	/** étincelles d'aura (calque séparé, animé en CSS) */
	aura: Grid | null;
}

export function heroArt(heroClass: ClassId | null, tier: number): SpriteArt {
	const look = LOOKS[heroClass ?? "none"];
	const colors: Record<string, string> = { ...COLORS, a: look.a, A: look.A, x: look.x, H: look.H };
	const g = blank();

	// derrière le corps : cape (Adepte et au-delà)
	if (tier >= 2) {
		stamp(g, ["AA", "AA", "AA", "AA", "AA", "A."], 1, 9);
		stamp(g, ["AA", "AA", "AA", "AA", "AA", ".A"], 13, 9);
	}
	stamp(g, HERO_BASE, 0, 0);
	if (tier >= 1) plot(g, [[6, 8, "x"], [7, 8, "x"], [8, 8, "x"], [9, 8, "x"], [9, 9, "x"], [9, 10, "x"]]); // écharpe
	if (tier >= 3) plot(g, [[3, 8, "S"], [4, 8, "S"], [11, 8, "S"], [12, 8, "S"], [3, 9, "s"], [12, 9, "s"]]); // épaulières
	if (tier >= 4) {
		// heaume de champion + panache
		for (let x = 4; x <= 11; x++) plot(g, [[x, 3, "S"]]);
		for (let x = 5; x <= 10; x++) plot(g, [[x, 2, "S"]]);
		plot(g, [[7, 1, "R"], [8, 1, "R"], [7, 0, "R"], [8, 0, "R"], [4, 4, "s"], [11, 4, "s"]]);
	}
	if (tier >= 5) {
		// couronne de héros
		plot(g, [[5, 1, "Y"], [6, 1, "Y"], [7, 1, "Y"], [8, 1, "Y"], [9, 1, "Y"], [10, 1, "Y"], [5, 0, "Y"], [7, 0, "Y"], [8, 0, "Y"], [10, 0, "Y"]]);
	}
	if (heroClass) {
		const item = ITEMS[heroClass];
		stamp(g, item.map, item.x, item.y);
	}
	if (tier >= 7) {
		// armure de légende : tenue métallique et or
		colors["a"] = "#94b0c2";
		colors["A"] = "#566c86";
		colors["x"] = "#ffcd75";
	}

	let aura: Grid | null = null;
	if (tier >= 6) {
		const a = blank();
		plot(a, [[1, 3, "c"], [14, 2, "c"], [0, 8, "W"], [15, 9, "c"], [2, 13, "W"], [13, 14, "c"], [1, 5, "W"], [14, 12, "W"]]);
		aura = toRows(a);
	}
	return { grid: toRows(g), colors, aura };
}

/* ------------------------------------------------------------------ */
/* Boss                                                                */
/* ------------------------------------------------------------------ */

const BOSS_CONTENT: Record<string, { half: readonly string[]; extra?: readonly (readonly [number, number, string])[] }> = {
	// enveloppe en colère
	gobelin: {
		half: [
			"SSSSSSS",
			"WSSSSSS",
			"WWSSRRS",
			"WWWSRRS",
			"WWWWSSS",
			"WWWWWSS",
			"WWWWWWS",
			"WWWWWWW",
			"WWWWkkk",
			"WWWWWWW",
			"WWWWWWW",
			".kk..kk",
			".kk..kk",
		],
	},
	// golem de pierre avec une horloge sur le torse
	golem: {
		half: [
			".SSSSSS",
			".SSSSSS",
			".SYYSSS",
			".SSSSSS",
			"..SSSSS",
			"sssssss",
			"sSSSSSS",
			"sSSSSWW",
			"sSSSWWk",
			"sSSSWWW",
			"sSSSSWW",
			".sSSSSS",
			"..SSsss",
			"..SS..s",
		],
	},
	// blob violet aux multiples yeux
	hydre: {
		half: [
			".....PP",
			"...PPPP",
			"..PPPPP",
			".PPWWPP",
			".PPWkPW",
			"PPPPPPW",
			"PPWWPPP",
			"PPWkPPP",
			"PPPPPPP",
			"PPPPkkk",
			"PPPPPPP",
			".PP.PP.",
			"..P..P.",
		],
	},
	// spectre à la pastille de notification
	spectre: {
		half: [
			"...WWWW",
			"..WWWWW",
			".WWWWWW",
			".WWkkWW",
			".WWkkWW",
			"WWWWWWW",
			"WWWWWkk",
			"WWWWWkk",
			"WWWWWWW",
			"WWWWWWW",
			"WWWWWWW",
			"WW.WW.W",
			"W.WW.WW",
		],
		extra: [[11, 3, "R"], [12, 3, "R"], [11, 4, "R"], [12, 4, "R"]],
	},
	// dragon rouge qui crache du feu
	dragon: {
		half: [
			".W.....",
			".WW....",
			"..RRRRR",
			".RRRRRR",
			".RYkRRR",
			".RRRRRR",
			"RRRRRRs",
			".RRRRRR",
			".RRWRWR",
			"..RRRRR",
			"...EEEE",
			"..EEYYY",
			"...EEYY",
		],
	},
};

export function bossArt(bossId: string): SpriteArt {
	const def = BOSS_CONTENT[bossId] ?? BOSS_CONTENT["gobelin"]!;
	const grid = outlined(mirror(def.half));
	if (def.extra) {
		const g = grid.map((r) => [...r]);
		// les pixels « extra » sont donnés dans le repère de la grille finale
		plot(g, def.extra);
		return { grid: toRows(g), colors: COLORS, aura: null };
	}
	return { grid, colors: COLORS, aura: null };
}

export const BOSS_IDS = Object.keys(BOSS_CONTENT);

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

export function drawGrid(canvas: HTMLCanvasElement, grid: Grid, colors: Record<string, string>): void {
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.clearRect(0, 0, SIZE, SIZE);
	grid.forEach((row, y) => {
		[...row].forEach((ch, x) => {
			const color = colors[ch];
			if (ch === "." || !color) return;
			ctx.fillStyle = color;
			ctx.fillRect(x, y, 1, 1);
		});
	});
}

/** Crée un élément sprite (canvas net, mise à l'échelle par CSS en multiple entier). */
export function spriteElement(art: SpriteArt, className = ""): HTMLElement {
	const wrap = document.createElement("span");
	wrap.className = `pq-sprite ${className}`.trim();
	if (art.aura) {
		const aura = document.createElement("canvas");
		aura.className = "pq-sprite-aura";
		drawGrid(aura, art.aura, art.colors);
		wrap.append(aura);
	}
	const body = document.createElement("canvas");
	body.className = "pq-sprite-body";
	drawGrid(body, art.grid, art.colors);
	wrap.append(body);
	return wrap;
}
