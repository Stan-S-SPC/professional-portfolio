/*
 * Le « cadre de notes » : où vivent les notes du jeu et comment on lit leurs propriétés.
 * La lecture est volontairement tolérante (accents, casse, liens ou noms simples) car ces notes
 * sont aussi modifiées à la main dans Obsidian, ou par un agent.
 *
 * Les noms de dossiers et fichiers structurants sont en ASCII pour éviter tout souci de
 * normalisation Unicode (NFC/NFD) entre systèmes de fichiers et outils de synchronisation.
 */
import { isKey, toKey } from "../engine/dates.ts";
import type { Period, Quest } from "../engine/progress.ts";
import {
	CLASS_IDS,
	DIFFICULTIES,
	parseClass,
	parseDays,
	parseDifficulty,
	parseSkill,
	type ClassId,
	type DifficultyId,
	type SkillId,
} from "../engine/rules.ts";
import type { NoteFile } from "../game/port.ts";

export const DEFAULT_ROOT = "Pixel Quest";

export interface Paths {
	root: string;
	quests: string;
	journal: string;
	reviews: string;
	templates: string;
	hero: string;
	dashboard: string;
	guide: string;
}

export function pathsFor(rootRaw: string): Paths {
	const root = rootRaw.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || DEFAULT_ROOT;
	return {
		root,
		quests: `${root}/Quetes`,
		journal: `${root}/Journal`,
		reviews: `${root}/Revues`,
		templates: `${root}/Modeles`,
		hero: `${root}/Heros.md`,
		dashboard: `${root}/Tableau de bord.md`,
		guide: `${root}/Guide.md`,
	};
}

export const TYPES = {
	quest: "pq-quete",
	day: "pq-jour",
	hero: "pq-heros",
	review: "pq-revue",
	dashboard: "pq-tableau",
} as const;

export const isUnder = (path: string, folder: string): boolean => path.startsWith(folder + "/");

export function basename(path: string): string {
	const name = path.slice(path.lastIndexOf("/") + 1);
	return name.replace(/\.md$/i, "");
}

export const questPath = (paths: Paths, name: string): string => `${paths.quests}/${name}.md`;
export const journalPath = (paths: Paths, date: string): string => `${paths.journal}/${date}.md`;

/** Nom de fichier sûr sur tous les systèmes (et compatible avec les liens Obsidian). */
export function sanitizeFileName(name: string): string {
	return name
		.replace(/[\\/:*?"<>|#^[\]]/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.trim()
		.slice(0, 80)
		.trim();
}

/* ------------------------------------------------------------------ */
/* Liens                                                               */
/* ------------------------------------------------------------------ */

export const wikilink = (name: string): string => `[[${name}]]`;

/** "[[Dossier/Nom|alias#titre]]", "Nom" ou "Nom.md" → "Nom". */
export function linkTarget(entry: unknown): string | null {
	if (typeof entry !== "string") return null;
	let s = entry.trim();
	const m = /^\[\[([^\]]+)\]\]$/.exec(s);
	if (m?.[1]) s = m[1];
	s = (s.split("|")[0] ?? "").split("#")[0] ?? "";
	s = s.trim().replace(/\.md$/i, "");
	const slash = s.lastIndexOf("/");
	if (slash >= 0) s = s.slice(slash + 1);
	return s.trim() || null;
}

/**
 * Aplatit une valeur de propriété en liste de chaînes. Gère aussi `[[Nom]]` non guillemeté,
 * que YAML lit comme un tableau imbriqué [["Nom"]].
 */
export function flattenStrings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(flattenStrings);
	return [];
}

/* ------------------------------------------------------------------ */
/* Périodes (pauses / reprises d'une quête)                            */
/* ------------------------------------------------------------------ */

const DATE_RE = /\d{4}-\d{2}-\d{2}/g;

/** "2026-10-26 → 2026-11-10", "2026-11-20 →" : le dernier jour n'est pas inclus. */
export function parsePeriods(value: unknown): Period[] {
	const out: Period[] = [];
	for (const raw of flattenStrings(value)) {
		const dates = raw.match(DATE_RE)?.filter(isKey) ?? [];
		const from = dates[0];
		if (!from) continue;
		const to = dates[1] ?? null;
		if (to !== null && to < from) continue;
		out.push({ from, to });
	}
	return out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

export function formatPeriods(periods: readonly Period[]): string[] {
	return periods.map((p) => (p.to ? `${p.from} → ${p.to}` : `${p.from} →`));
}

/* ------------------------------------------------------------------ */
/* Lecture des notes                                                   */
/* ------------------------------------------------------------------ */

const ymd = (ms: number): string => toKey(new Date(ms));

/** Une note du dossier des quêtes devient une quête, avec des valeurs par défaut raisonnables. */
export function parseQuestNote(file: NoteFile, props: Record<string, unknown>): Quest | null {
	const type = props["type"];
	if (typeof type === "string" && type !== TYPES.quest) return null;
	const name = basename(file.path);
	if (!name) return null;

	let periods = parsePeriods(props["periodes"]);
	if (!periods.length) {
		const debut = flattenStrings(props["debut"]).find(isKey);
		periods = [{ from: debut ?? ymd(file.ctime), to: null }];
	}
	const icon = typeof props["icone"] === "string" && props["icone"].trim() ? Array.from(props["icone"].trim()).slice(0, 4).join("") : "⚔️";
	return {
		id: name,
		name,
		icon,
		skill: parseSkill(props["competence"]) ?? "methode",
		difficulty: parseDifficulty(props["difficulte"]) ?? "moyen",
		days: parseDays(props["jours"]) ?? [1, 2, 3, 4, 5],
		periods,
	};
}

export interface JournalEntry {
	date: string;
	quests: string[];
	rest: boolean;
}

/** Seules les notes nommées AAAA-MM-JJ.md comptent comme journées. */
export function parseJournalNote(path: string, props: Record<string, unknown>): JournalEntry | null {
	const date = basename(path);
	if (!isKey(date)) return null;
	const ids = new Set<string>();
	for (const entry of flattenStrings(props["quetes"])) {
		const id = linkTarget(entry);
		if (id) ids.add(id);
	}
	const rest = props["repos"] === true || props["repos"] === "true" || props["repos"] === "oui";
	return { date, quests: [...ids], rest };
}

export interface HeroNote {
	exists: boolean;
	name: string;
	heroClass: ClassId | null;
	badges: Record<string, string>;
}

export const emptyHero = (): HeroNote => ({ exists: false, name: "", heroClass: null, badges: {} });

export function parseHeroNote(props: Record<string, unknown>): HeroNote {
	const badges: Record<string, string> = {};
	const raw = props["succes"];
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		for (const [id, date] of Object.entries(raw as Record<string, unknown>)) {
			const key = date instanceof Date ? toKey(date) : typeof date === "string" ? date.slice(0, 10) : "";
			if (isKey(key)) badges[id] = key;
		}
	}
	return {
		exists: true,
		name: typeof props["nom"] === "string" ? props["nom"].trim().slice(0, 40) : "",
		heroClass: parseClass(props["classe"]),
		badges,
	};
}

/* ------------------------------------------------------------------ */
/* Écriture des propriétés                                             */
/* ------------------------------------------------------------------ */

export interface QuestDraft {
	name: string;
	icon: string;
	skill: SkillId;
	difficulty: DifficultyId;
	days: number[];
}

export function difficultyLabel(id: DifficultyId): string {
	return DIFFICULTIES[id].label;
}

export const isClassId = (value: unknown): value is ClassId => (CLASS_IDS as readonly string[]).includes(value as string);

/** Assemble une note : propriétés YAML + corps. */
export function composeNote(yaml: string, body: string): string {
	const props = yaml.endsWith("\n") ? yaml : yaml + "\n";
	return `---\n${props}---\n${body}`;
}
