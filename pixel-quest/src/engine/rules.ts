/* Règles du jeu : compétences, classes, difficultés, titres, boss. Aucune dépendance à Obsidian. */

export type SkillId = "savoir" | "charisme" | "concentration" | "vitalite" | "ambition" | "methode";
export type ClassId = "batisseur" | "erudit" | "diplomate" | "stratege" | "sage";
export type DifficultyId = "facile" | "moyen" | "difficile";

export const SKILL_IDS: readonly SkillId[] = ["savoir", "charisme", "concentration", "vitalite", "ambition", "methode"];
export const CLASS_IDS: readonly ClassId[] = ["batisseur", "erudit", "diplomate", "stratege", "sage"];
export const DIFFICULTY_IDS: readonly DifficultyId[] = ["facile", "moyen", "difficile"];

export interface SkillDef {
	label: string;
	emoji: string;
	blurb: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
	savoir: { label: "Savoir", emoji: "📚", blurb: "Apprendre, lire, se former, faire de la veille." },
	charisme: { label: "Charisme", emoji: "🤝", blurb: "Réseau, communication, feedback, relations." },
	concentration: { label: "Concentration", emoji: "🎯", blurb: "Travail en profondeur, focus, livrables." },
	vitalite: { label: "Vitalité", emoji: "🌿", blurb: "Énergie, pauses, sommeil, équilibre." },
	ambition: { label: "Ambition", emoji: "🚀", blurb: "Carrière, visibilité, objectifs à long terme." },
	methode: { label: "Méthode", emoji: "🗂️", blurb: "Organisation, planification, revues." },
};

export interface ClassDef {
	label: string;
	blurb: string;
	/** Compétences qui rapportent +25 % d'XP à cette classe. */
	favored: readonly [SkillId, SkillId];
}

export const CLASSES: Record<ClassId, ClassDef> = {
	batisseur: { label: "Bâtisseur", blurb: "Pose des fondations solides : on livre, proprement et à l'heure.", favored: ["concentration", "methode"] },
	erudit: { label: "Érudit", blurb: "Avance par la connaissance : toujours un livre ou une idée d'avance.", favored: ["savoir", "concentration"] },
	diplomate: { label: "Diplomate", blurb: "Gagne par les alliances : un réseau vivant ouvre toutes les portes.", favored: ["charisme", "ambition"] },
	stratege: { label: "Stratège", blurb: "Pense long terme : chaque action sert une trajectoire de carrière.", favored: ["ambition", "methode"] },
	sage: { label: "Sage", blurb: "Tient la distance : l'énergie et la curiosité avant tout.", favored: ["vitalite", "savoir"] },
};

export const CLASS_BONUS = 1.25;

export interface DifficultyDef {
	label: string;
	xp: number;
	stars: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
	facile: { label: "Facile", xp: 10, stars: 1 },
	moyen: { label: "Moyen", xp: 20, stars: 2 },
	difficile: { label: "Difficile", xp: 40, stars: 3 },
};

export const PERFECT_DAY_BONUS = 15;
export const BOSS_BONUS = 50;
/** Part des quêtes prévues de la semaine à valider pour vaincre le boss. */
export const BOSS_THRESHOLD = 0.8;
/** En dessous, la semaine est trop légère pour un boss. */
export const BOSS_MIN_SLOTS = 5;

/** Du palier le plus haut au plus bas : série (en jours prévus) → multiplicateur d'XP. */
export const STREAK_TIERS: readonly { min: number; mult: number }[] = [
	{ min: 30, mult: 2 },
	{ min: 14, mult: 1.5 },
	{ min: 7, mult: 1.25 },
];

export const HERO_TITLES: readonly { from: number; title: string; gear: string }[] = [
	{ from: 1, title: "Novice", gear: "Tenue de voyage" },
	{ from: 3, title: "Initié", gear: "Écharpe d'initié" },
	{ from: 6, title: "Adepte", gear: "Cape d'adepte" },
	{ from: 10, title: "Vétéran", gear: "Épaulières de vétéran" },
	{ from: 15, title: "Champion", gear: "Heaume de champion" },
	{ from: 20, title: "Héros", gear: "Couronne de héros" },
	{ from: 30, title: "Mythe", gear: "Aura de mythe" },
	{ from: 40, title: "Légende", gear: "Armure de légende" },
];

export const SKILL_RANKS: readonly { from: number; rank: string }[] = [
	{ from: 1, rank: "Novice" },
	{ from: 3, rank: "Initié" },
	{ from: 5, rank: "Adepte" },
	{ from: 8, rank: "Expert" },
	{ from: 12, rank: "Maître" },
	{ from: 20, rank: "Grand maître" },
];

export interface BossDef {
	id: string;
	name: string;
	blurb: string;
}

export const BOSSES: readonly BossDef[] = [
	{ id: "gobelin", name: "Le Gobelin des Mails", blurb: "Il se multiplie dès que tu tournes le dos à ta boîte de réception." },
	{ id: "golem", name: "Le Golem des Réunions", blurb: "Massif, lent, et il avale des heures entières de ton agenda." },
	{ id: "hydre", name: "L'Hydre du Backlog", blurb: "Tranche une tête, deux repoussent. Reste méthodique." },
	{ id: "spectre", name: "Le Spectre des Notifications", blurb: "Il te souffle à l'oreille pour casser ta concentration." },
	{ id: "dragon", name: "Le Dragon de la Deadline", blurb: "Il crache le feu sur ceux qui remettent à demain." },
];

export function parseSkill(value: unknown): SkillId | null {
	if (typeof value !== "string") return null;
	const norm = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
	return (SKILL_IDS as readonly string[]).includes(norm) ? (norm as SkillId) : null;
}

export function parseClass(value: unknown): ClassId | null {
	if (typeof value !== "string") return null;
	const norm = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
	return (CLASS_IDS as readonly string[]).includes(norm) ? (norm as ClassId) : null;
}

export function parseDifficulty(value: unknown): DifficultyId | null {
	if (typeof value !== "string") return null;
	const norm = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
	return (DIFFICULTY_IDS as readonly string[]).includes(norm) ? (norm as DifficultyId) : null;
}

const DAY_NAMES = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"] as const;
export const DAY_LABELS = DAY_NAMES;
/** Ordre d'affichage : lundi → dimanche. */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Accepte ["lun","mar"], ["Lundi"], [1,2], "tous", "semaine"… Renvoie null si rien d'exploitable. */
export function parseDays(value: unknown): number[] | null {
	const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,;]+/) : [];
	const out = new Set<number>();
	for (const raw of list) {
		if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 6) {
			out.add(raw);
			continue;
		}
		if (typeof raw !== "string") continue;
		const norm = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
		if (!norm) continue;
		if (norm === "tous" || norm === "tout" || norm === "quotidien") [0, 1, 2, 3, 4, 5, 6].forEach((d) => out.add(d));
		else if (norm === "semaine" || norm === "ouvres" || norm === "ouvre") [1, 2, 3, 4, 5].forEach((d) => out.add(d));
		else if (/^\d$/.test(norm) && Number(norm) <= 6) out.add(Number(norm));
		else {
			const idx = DAY_NAMES.findIndex((d) => norm.startsWith(d));
			if (idx >= 0) out.add(idx);
		}
	}
	return out.size ? [...out].sort((a, b) => a - b) : null;
}

/** Représentation canonique et lisible pour les propriétés des notes. */
export function formatDays(days: readonly number[]): string[] {
	return DISPLAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d] as string);
}
