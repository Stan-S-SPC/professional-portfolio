/*
 * Moteur de progression. Fonctions pures : tout (XP, niveaux, séries, boss, succès) est recalculé
 * à partir des quêtes et de l'historique de validations, jamais stocké.
 */
import { addDays, dayNumber, fromDayNumber, startOfWeek, weekday } from "./dates.ts";
import {
	BOSSES,
	BOSS_BONUS,
	BOSS_MIN_SLOTS,
	BOSS_THRESHOLD,
	CLASSES,
	CLASS_BONUS,
	DIFFICULTIES,
	HERO_TITLES,
	PERFECT_DAY_BONUS,
	SKILL_IDS,
	SKILLS,
	SKILL_RANKS,
	STREAK_TIERS,
	type BossDef,
	type ClassId,
	type DifficultyId,
	type SkillId,
} from "./rules.ts";

/* ------------------------------------------------------------------ */
/* Modèle                                                              */
/* ------------------------------------------------------------------ */

/** Période d'activité [from, to[ ; `to: null` = en cours. */
export interface Period {
	from: string;
	to: string | null;
}

export interface Quest {
	/** Nom de la note de quête (unique dans son dossier) : sert d'identifiant dans les liens du journal. */
	id: string;
	name: string;
	icon: string;
	skill: SkillId;
	difficulty: DifficultyId;
	days: number[];
	periods: Period[];
}

export interface World {
	quests: Quest[];
	/** date → identifiants des quêtes validées */
	log: Record<string, string[]>;
	/** jours de repos / congés */
	offDays: string[];
	heroClass: ClassId | null;
	/** succès débloqués : id → date de déblocage */
	badges: Record<string, string>;
}

export const emptyWorld = (): World => ({ quests: [], log: {}, offDays: [], heroClass: null, badges: {} });

export function isActiveOn(quest: Quest, key: string): boolean {
	return quest.periods.some((p) => key >= p.from && (p.to === null || key < p.to));
}

export const isArchived = (quest: Quest): boolean => !quest.periods.some((p) => p.to === null);

export function firstActiveDay(quest: Quest): string {
	let min = quest.periods[0]?.from ?? "9999-12-31";
	for (const p of quest.periods) if (p.from < min) min = p.from;
	return min;
}

/** Prévue ce jour-là : active, jour de semaine choisi, et pas un jour de repos. */
export function isScheduled(quest: Quest, key: string, offDays: ReadonlySet<string>): boolean {
	return isActiveOn(quest, key) && quest.days.includes(weekday(key)) && !offDays.has(key);
}

/* ------------------------------------------------------------------ */
/* XP & niveaux                                                        */
/* ------------------------------------------------------------------ */

export function streakMultiplier(streak: number): number {
	for (const tier of STREAK_TIERS) if (streak >= tier.min) return tier.mult;
	return 1;
}

export function isFavored(heroClass: ClassId | null, skill: SkillId): boolean {
	return heroClass !== null && CLASSES[heroClass].favored.includes(skill);
}

/** XP d'une validation ; `streak` = longueur de la série en comptant cette validation. */
export function completionXp(quest: Quest, streak: number, heroClass: ClassId | null): number {
	const mult = streakMultiplier(streak) * (isFavored(heroClass, quest.skill) ? CLASS_BONUS : 1);
	return Math.round(DIFFICULTIES[quest.difficulty].xp * mult);
}

/** Niveau N demande k × (N − 1) × N XP cumulés. */
function levelFor(xp: number, k: number): number {
	const total = (l: number): number => k * (l - 1) * l;
	let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / k)) / 2));
	while (total(level + 1) <= xp) level++;
	while (level > 1 && total(level) > xp) level--;
	return level;
}

/** XP cumulée pour atteindre un niveau de héros : 0, 100, 300, 600, 1000… */
export const xpForLevel = (level: number): number => 50 * (level - 1) * level;
/** XP cumulée pour atteindre un niveau de compétence : 0, 50, 150, 300, 500… */
export const xpForSkillLevel = (level: number): number => 25 * (level - 1) * level;

export interface LevelInfo {
	level: number;
	xp: number;
	title: string;
	gear: string;
	/** Rang d'équipement (0 = tenue de voyage) selon le titre. */
	tier: number;
	into: number;
	needed: number;
	toNext: number;
	progress: number;
	nextTitle: { title: string; level: number } | null;
}

export function levelInfo(xpRaw: number): LevelInfo {
	const xp = Math.max(0, Math.floor(xpRaw));
	const level = levelFor(xp, 50);
	const base = xpForLevel(level);
	const needed = xpForLevel(level + 1) - base;
	let tier = 0;
	HERO_TITLES.forEach((t, i) => {
		if (level >= t.from) tier = i;
	});
	const current = HERO_TITLES[tier] ?? HERO_TITLES[0]!;
	const next = HERO_TITLES.find((t) => t.from > level) ?? null;
	return {
		level,
		xp,
		title: current.title,
		gear: current.gear,
		tier,
		into: xp - base,
		needed,
		toNext: needed - (xp - base),
		progress: (xp - base) / needed,
		nextTitle: next ? { title: next.title, level: next.from } : null,
	};
}

export interface SkillProgress {
	id: SkillId;
	xp: number;
	level: number;
	rank: string;
	into: number;
	needed: number;
	progress: number;
	/** nombre de validations dans cette compétence */
	count: number;
	favored: boolean;
}

export function skillLevelInfo(xpRaw: number): Pick<SkillProgress, "xp" | "level" | "rank" | "into" | "needed" | "progress"> {
	const xp = Math.max(0, Math.floor(xpRaw));
	const level = levelFor(xp, 25);
	const base = xpForSkillLevel(level);
	const needed = xpForSkillLevel(level + 1) - base;
	let rank = SKILL_RANKS[0]!.rank;
	for (const r of SKILL_RANKS) if (level >= r.from) rank = r.rank;
	return { xp, level, rank, into: xp - base, needed, progress: (xp - base) / needed };
}

/* ------------------------------------------------------------------ */
/* Progression globale                                                 */
/* ------------------------------------------------------------------ */

export interface QuestStat {
	current: number;
	best: number;
	/** longueur de la série à la date de chaque validation prévue */
	streakAt: Record<string, number>;
	scheduled: number;
	done: number;
}

export interface DayInfo {
	scheduled: number;
	done: number;
	perfect: boolean;
	off: boolean;
}

export interface BossWeek {
	weekStart: string;
	boss: BossDef;
	/** quêtes prévues sur la semaine entière */
	slots: number;
	/** quêtes validées (points de dégâts) */
	damage: number;
	required: number;
	defeated: boolean;
	/** jour du coup fatal */
	defeatedOn: string | null;
	current: boolean;
}

export interface Progress {
	today: string;
	totalXp: number;
	xpBreakdown: { completions: number; perfectDays: number; bosses: number };
	level: LevelInfo;
	skills: Record<SkillId, SkillProgress>;
	totalCompletions: number;
	activeDays: number;
	xpByDay: Record<string, number>;
	skillXpByDay: Record<string, Partial<Record<SkillId, number>>>;
	questStats: Record<string, QuestStat>;
	days: Record<string, DayInfo>;
	perfectDays: number;
	perfectStreak: { current: number; best: number };
	bestStreak: number;
	currentStreak: number;
	bosses: BossWeek[];
	bossesDefeated: number;
}

export function bossForWeek(weekStart: string): BossDef {
	const index = Math.floor(dayNumber(weekStart) / 7) % BOSSES.length;
	return BOSSES[index] ?? BOSSES[0]!;
}

export function computeProgress(world: World, today: string): Progress {
	const offDays = new Set(world.offDays);
	const questsById = new Map(world.quests.map((q) => [q.id, q]));
	const doneByDay = new Map<string, Set<string>>();
	for (const [key, ids] of Object.entries(world.log)) if (key <= today) doneByDay.set(key, new Set(ids));
	const isDone = (id: string, key: string): boolean => doneByDay.get(key)?.has(id) ?? false;

	// 1. Séries par quête
	const questStats: Record<string, QuestStat> = {};
	let bestStreak = 0;
	let currentStreak = 0;
	for (const quest of world.quests) {
		const stat: QuestStat = { current: 0, best: 0, streakAt: {}, scheduled: 0, done: 0 };
		let streak = 0;
		for (let n = dayNumber(firstActiveDay(quest)); n <= dayNumber(today); n++) {
			const key = fromDayNumber(n);
			if (!isScheduled(quest, key, offDays)) continue;
			stat.scheduled++;
			if (isDone(quest.id, key)) {
				streak++;
				stat.done++;
				stat.streakAt[key] = streak;
				if (streak > stat.best) stat.best = streak;
			} else if (key !== today) {
				streak = 0;
			}
		}
		stat.current = streak;
		questStats[quest.id] = stat;
		if (stat.best > bestStreak) bestStreak = stat.best;
		if (stat.current > currentStreak) currentStreak = stat.current;
	}

	// 2. XP des validations, par jour et par compétence
	let completionsXp = 0;
	let totalCompletions = 0;
	const xpByDay: Record<string, number> = {};
	const skillXpByDay: Record<string, Partial<Record<SkillId, number>>> = {};
	const skillXp = Object.fromEntries(SKILL_IDS.map((s) => [s, 0])) as Record<SkillId, number>;
	const skillCount = Object.fromEntries(SKILL_IDS.map((s) => [s, 0])) as Record<SkillId, number>;
	const activeDays = new Set<string>();
	for (const [key, ids] of doneByDay) {
		for (const id of ids) {
			const quest = questsById.get(id);
			if (!quest) continue;
			const xp = completionXp(quest, questStats[id]?.streakAt[key] ?? 0, world.heroClass);
			completionsXp += xp;
			totalCompletions++;
			activeDays.add(key);
			xpByDay[key] = (xpByDay[key] ?? 0) + xp;
			skillXp[quest.skill] += xp;
			skillCount[quest.skill]++;
			const perDay = (skillXpByDay[key] ??= {});
			perDay[quest.skill] = (perDay[quest.skill] ?? 0) + xp;
		}
	}

	// 3. Journées parfaites
	const days: Record<string, DayInfo> = {};
	let perfectDays = 0;
	let perfectStreak = 0;
	let bestPerfectStreak = 0;
	let perfectXp = 0;
	let firstDay = today;
	for (const q of world.quests) if (firstActiveDay(q) < firstDay) firstDay = firstActiveDay(q);
	if (world.quests.length) {
		for (let n = dayNumber(firstDay); n <= dayNumber(today); n++) {
			const key = fromDayNumber(n);
			let scheduled = 0;
			let done = 0;
			for (const quest of world.quests) {
				if (!isScheduled(quest, key, offDays)) continue;
				scheduled++;
				if (isDone(quest.id, key)) done++;
			}
			const perfect = scheduled > 0 && done === scheduled;
			days[key] = { scheduled, done, perfect, off: offDays.has(key) };
			if (perfect) {
				perfectDays++;
				perfectXp += PERFECT_DAY_BONUS;
				xpByDay[key] = (xpByDay[key] ?? 0) + PERFECT_DAY_BONUS;
				perfectStreak++;
				if (perfectStreak > bestPerfectStreak) bestPerfectStreak = perfectStreak;
			} else if (scheduled > 0 && key !== today) {
				perfectStreak = 0;
			}
		}
	}

	// 4. Boss hebdomadaires
	const bosses: BossWeek[] = [];
	let bossXp = 0;
	if (world.quests.length) {
		const thisWeek = startOfWeek(today);
		for (let week = startOfWeek(firstDay); week <= thisWeek; week = addDays(week, 7)) {
			let slots = 0;
			for (let i = 0; i < 7; i++) {
				const key = addDays(week, i);
				for (const quest of world.quests) if (isScheduled(quest, key, offDays)) slots++;
			}
			if (slots === 0) continue;
			const required = Math.ceil(slots * BOSS_THRESHOLD);
			let damage = 0;
			let defeatedOn: string | null = null;
			for (let i = 0; i < 7; i++) {
				const key = addDays(week, i);
				if (key > today) break;
				damage += days[key]?.done ?? 0;
				if (defeatedOn === null && slots >= BOSS_MIN_SLOTS && damage >= required) defeatedOn = key;
			}
			const defeated = defeatedOn !== null;
			if (defeatedOn) {
				bossXp += BOSS_BONUS;
				xpByDay[defeatedOn] = (xpByDay[defeatedOn] ?? 0) + BOSS_BONUS;
			}
			bosses.push({ weekStart: week, boss: bossForWeek(week), slots, damage, required, defeated, defeatedOn, current: week === thisWeek });
		}
	}

	const totalXp = completionsXp + perfectXp + bossXp;
	const skills = Object.fromEntries(
		SKILL_IDS.map((id) => [id, { id, count: skillCount[id], favored: isFavored(world.heroClass, id), ...skillLevelInfo(skillXp[id]) }]),
	) as Record<SkillId, SkillProgress>;

	return {
		today,
		totalXp,
		xpBreakdown: { completions: completionsXp, perfectDays: perfectXp, bosses: bossXp },
		level: levelInfo(totalXp),
		skills,
		totalCompletions,
		activeDays: activeDays.size,
		xpByDay,
		skillXpByDay,
		questStats,
		days,
		perfectDays,
		perfectStreak: { current: perfectStreak, best: bestPerfectStreak },
		bestStreak,
		currentStreak,
		bosses,
		bossesDefeated: bosses.filter((b) => b.defeated).length,
	};
}

/** XP que rapporterait (ou a rapporté) cette quête ce jour-là, pour l'affichage. */
export function xpPreview(quest: Quest, progress: Progress, key: string, done: boolean, heroClass: ClassId | null): number {
	const stat = progress.questStats[quest.id];
	if (!stat) return completionXp(quest, 0, heroClass);
	if (done) return completionXp(quest, stat.streakAt[key] ?? 0, heroClass);
	if (key === progress.today) return completionXp(quest, stat.current + 1, heroClass);
	return completionXp(quest, 0, heroClass);
}

export function currentBoss(progress: Progress): BossWeek | null {
	return progress.bosses.find((b) => b.current) ?? null;
}

/* ------------------------------------------------------------------ */
/* Bilan d'une semaine (revue hebdomadaire)                            */
/* ------------------------------------------------------------------ */

export interface WeekSummary {
	weekStart: string;
	weekEnd: string;
	perQuest: { quest: Quest; scheduled: number; done: number }[];
	scheduled: number;
	done: number;
	rate: number | null;
	perfectDays: number;
	restDays: number;
	xp: number;
	skillXp: Record<SkillId, number>;
	boss: BossWeek | null;
}

export function weekSummary(world: World, progress: Progress, anyDayOfWeek: string): WeekSummary {
	const weekStart = startOfWeek(anyDayOfWeek);
	const weekEnd = addDays(weekStart, 6);
	const offDays = new Set(world.offDays);
	const perQuest = world.quests
		.map((quest) => {
			let scheduled = 0;
			let done = 0;
			for (let i = 0; i < 7; i++) {
				const key = addDays(weekStart, i);
				if (key > progress.today || !isScheduled(quest, key, offDays)) continue;
				scheduled++;
				if (world.log[key]?.includes(quest.id)) done++;
			}
			return { quest, scheduled, done };
		})
		.filter((r) => r.scheduled > 0);
	const skillXp = Object.fromEntries(SKILL_IDS.map((s) => [s, 0])) as Record<SkillId, number>;
	let xp = 0;
	let perfectDays = 0;
	let restDays = 0;
	for (let i = 0; i < 7; i++) {
		const key = addDays(weekStart, i);
		xp += progress.xpByDay[key] ?? 0;
		if (progress.days[key]?.perfect) perfectDays++;
		if (offDays.has(key) && key <= progress.today) restDays++;
		for (const [skill, value] of Object.entries(progress.skillXpByDay[key] ?? {})) skillXp[skill as SkillId] += value ?? 0;
	}
	const scheduled = perQuest.reduce((s, r) => s + r.scheduled, 0);
	const done = perQuest.reduce((s, r) => s + r.done, 0);
	return {
		weekStart,
		weekEnd,
		perQuest,
		scheduled,
		done,
		rate: scheduled ? done / scheduled : null,
		perfectDays,
		restDays,
		xp,
		skillXp,
		boss: progress.bosses.find((b) => b.weekStart === weekStart) ?? null,
	};
}

/* ------------------------------------------------------------------ */
/* Succès                                                              */
/* ------------------------------------------------------------------ */

export interface BadgeDef {
	id: string;
	icon: string;
	name: string;
	desc: string;
	target: number;
	value: (p: Progress) => number;
}

const maxSkillLevel = (p: Progress): number => Math.max(...SKILL_IDS.map((s) => p.skills[s].level));
const minSkillLevel = (p: Progress): number => Math.min(...SKILL_IDS.map((s) => p.skills[s].level));

export const BADGES: readonly BadgeDef[] = [
	{ id: "first_step", icon: "🌱", name: "Premier pas", desc: "Valider une première quête", target: 1, value: (p) => p.totalCompletions },
	{ id: "completions_50", icon: "✅", name: "Régularité", desc: "Valider 50 quêtes", target: 50, value: (p) => p.totalCompletions },
	{ id: "completions_250", icon: "⚙️", name: "Rouleau compresseur", desc: "Valider 250 quêtes", target: 250, value: (p) => p.totalCompletions },
	{ id: "completions_1000", icon: "🏅", name: "Marathon", desc: "Valider 1 000 quêtes", target: 1000, value: (p) => p.totalCompletions },
	{ id: "streak_3", icon: "✨", name: "Échauffement", desc: "Série de 3 jours sur une quête", target: 3, value: (p) => p.bestStreak },
	{ id: "streak_7", icon: "🔥", name: "Semaine de feu", desc: "Série de 7 jours sur une quête", target: 7, value: (p) => p.bestStreak },
	{ id: "streak_14", icon: "💪", name: "Double semaine", desc: "Série de 14 jours sur une quête", target: 14, value: (p) => p.bestStreak },
	{ id: "streak_30", icon: "🛡️", name: "Mois d'acier", desc: "Série de 30 jours sur une quête", target: 30, value: (p) => p.bestStreak },
	{ id: "streak_100", icon: "👑", name: "Centurion", desc: "Série de 100 jours sur une quête", target: 100, value: (p) => p.bestStreak },
	{ id: "perfect_1", icon: "⭐", name: "Journée parfaite", desc: "Valider toutes les quêtes prévues en un jour", target: 1, value: (p) => p.perfectDays },
	{ id: "perfect_streak_3", icon: "🎩", name: "Triplé", desc: "3 journées parfaites d'affilée", target: 3, value: (p) => p.perfectStreak.best },
	{ id: "perfect_streak_7", icon: "🌟", name: "Sans faute", desc: "7 journées parfaites d'affilée", target: 7, value: (p) => p.perfectStreak.best },
	{ id: "boss_1", icon: "🗡️", name: "Tueur de boss", desc: "Vaincre un premier boss hebdomadaire", target: 1, value: (p) => p.bossesDefeated },
	{ id: "boss_5", icon: "🐉", name: "Chasseur de dragons", desc: "Vaincre 5 boss hebdomadaires", target: 5, value: (p) => p.bossesDefeated },
	{ id: "level_5", icon: "📈", name: "Montée en puissance", desc: "Atteindre le niveau 5", target: 5, value: (p) => p.level.level },
	{ id: "level_10", icon: "🏆", name: "Cap des dix", desc: "Atteindre le niveau 10", target: 10, value: (p) => p.level.level },
	{ id: "level_20", icon: "💎", name: "Élite", desc: "Atteindre le niveau 20", target: 20, value: (p) => p.level.level },
	{ id: "skill_10", icon: "🔮", name: "Virtuose", desc: "Une compétence au niveau 10", target: 10, value: maxSkillLevel },
	{ id: "skill_all_3", icon: "🧩", name: "Polyvalent", desc: "Les six compétences au niveau 3", target: 3, value: minSkillLevel },
	...(
		[
			["savoir", "🧠", "Esprit curieux"],
			["charisme", "🌐", "Réseau actif"],
			["concentration", "🔭", "Mode focus"],
			["vitalite", "🌿", "Équilibre"],
			["ambition", "🧭", "Cap sur la carrière"],
			["methode", "📐", "Bien organisé"],
		] as const
	).map(
		([skill, icon, name]): BadgeDef => ({
			id: `skill_${skill}_25`,
			icon,
			name,
			desc: `Valider 25 quêtes de ${SKILLS[skill].label}`,
			target: 25,
			value: (p) => p.skills[skill].count,
		}),
	),
];

export interface BadgeStatus {
	id: string;
	icon: string;
	name: string;
	desc: string;
	target: number;
	value: number;
	reached: boolean;
}

export function evaluateBadges(progress: Progress): BadgeStatus[] {
	return BADGES.map((b) => {
		const value = b.value(progress);
		return { id: b.id, icon: b.icon, name: b.name, desc: b.desc, target: b.target, value, reached: value >= b.target };
	});
}

/** Succès atteints mais pas encore enregistrés dans la note du héros. */
export function newlyReached(stored: Record<string, string>, progress: Progress): BadgeStatus[] {
	return evaluateBadges(progress).filter((b) => b.reached && !stored[b.id]);
}
